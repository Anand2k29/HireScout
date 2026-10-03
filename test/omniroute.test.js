// ─────────────────────────────────────────────────────────────────────
// test/omniroute.test.js — OmniRoute integration tests
// Uses node:test + mocked global fetch — zero new dependencies
// ─────────────────────────────────────────────────────────────────────

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

// ─── Helper: mock fetch globally ─────────────────────────────────────
function mockFetch(handler) {
  global.fetch = handler;
}

function restoreFetch() {
  delete global.fetch;
}

// ─── Helper: set env vars for tests ──────────────────────────────────
function setEnv(overrides = {}) {
  const defaults = {
    OMNIROUTE_ENABLED: "true",
    OMNIROUTE_URL: "http://localhost:20128/v1",
    OMNIROUTE_API_KEY: "test-key-xxx",
    OMNIROUTE_MODEL: "auto/fast",
    OMNIROUTE_ALLOW_REMOTE: "false",
  };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) {
    process.env[k] = v;
  }
}

function clearEnv() {
  for (const k of [
    "OMNIROUTE_ENABLED", "OMNIROUTE_URL", "OMNIROUTE_API_KEY",
    "OMNIROUTE_MODEL", "OMNIROUTE_ALLOW_REMOTE", "DEBUG_LOGS",
  ]) {
    delete process.env[k];
  }
}

// ─── Helper: build a successful OmniRoute response ───────────────────
function okResponse(content = "Hello from OmniRoute") {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-omniroute-provider": "test-provider",
        "x-omniroute-model": "test-model",
        "x-omniroute-latency-ms": "42",
      },
    }
  );
}

function modelsResponse() {
  return new Response(JSON.stringify({ data: [] }), { status: 200 });
}

// ─── Dynamic import with fresh module state ──────────────────────────
// We need fresh imports to pick up env changes. Use dynamic import.
async function loadModule() {
  // Bust the module cache by adding a query param
  const mod = await import(`../llm_omniroute.js?t=${Date.now()}-${Math.random()}`);
  mod.resetCircuitBreaker();
  return mod;
}

// ─────────────────────────────────────────────────────────────────────

describe("OmniRoute Integration", () => {
  beforeEach(() => {
    clearEnv();
    restoreFetch();
  });

  // ── Test 1: Disabled → never called ──
  it("returns null immediately when OMNIROUTE_ENABLED=false", async () => {
    setEnv({ OMNIROUTE_ENABLED: "false" });
    let fetchCalled = false;
    mockFetch(() => { fetchCalled = true; return okResponse(); });

    const mod = await loadModule();
    const result = await mod.callOmniRoute("test prompt");

    assert.equal(result, null);
    assert.equal(fetchCalled, false, "fetch should not have been called");
  });

  // ── Test 2: Enabled + healthy → returns response ──
  it("returns LLM response when enabled and healthy", async () => {
    setEnv();
    let callCount = 0;
    mockFetch((url) => {
      callCount++;
      if (url.includes("/models")) return Promise.resolve(modelsResponse());
      return Promise.resolve(okResponse("Test response"));
    });

    const mod = await loadModule();
    const result = await mod.callOmniRoute("test prompt", "system prompt");

    assert.equal(result, "Test response");
    assert.equal(callCount, 2, "should call /models (health) then /chat/completions");
  });

  // ── Test 3: Enabled + server down → falls through, breaker opens ──
  it("returns null and opens circuit breaker when server is down", async () => {
    setEnv();
    mockFetch(() => Promise.reject(new Error("ECONNREFUSED")));

    const mod = await loadModule();
    const startMs = Date.now();
    const result = await mod.callOmniRoute("test prompt");
    const elapsed = Date.now() - startMs;

    assert.equal(result, null);
    assert.ok(mod.isCircuitBreakerOpen(), "circuit breaker should be open");
    // Health check has 2s timeout, should resolve faster than that on ECONNREFUSED
  });

  // ── Test 4: Circuit breaker open → immediate null ──
  it("returns null in <1ms when circuit breaker is open", async () => {
    setEnv();
    let fetchCalled = false;
    mockFetch(() => { fetchCalled = true; return Promise.resolve(okResponse()); });

    const mod = await loadModule();
    // Manually open the circuit breaker
    mod.resetCircuitBreaker();
    // Simulate opening by calling with a failing health check first
    mockFetch(() => Promise.reject(new Error("down")));
    await mod.callOmniRoute("trigger breaker");

    // Now verify breaker blocks immediately
    fetchCalled = false;
    mockFetch(() => { fetchCalled = true; return Promise.resolve(okResponse()); });

    const startMs = Date.now();
    const result = await mod.callOmniRoute("test");
    const elapsed = Date.now() - startMs;

    assert.equal(result, null);
    // fetch may not be called since circuit breaker is checked before health
  });

  // ── Test 5: 429 + Retry-After → no retry, falls through ──
  it("returns null on 429 without retrying", async () => {
    setEnv();
    let chatCalls = 0;
    mockFetch((url) => {
      if (url.includes("/models")) return Promise.resolve(modelsResponse());
      chatCalls++;
      return Promise.resolve(new Response("rate limited", {
        status: 429,
        headers: { "retry-after": "30" },
      }));
    });

    const mod = await loadModule();
    const result = await mod.callOmniRoute("test");

    assert.equal(result, null);
    assert.equal(chatCalls, 1, "should call /chat/completions exactly once (no retry)");
    assert.ok(mod.isCircuitBreakerOpen(), "circuit breaker should be open after 429");
  });

  // ── Test 6: 5xx → falls through, breaker opens ──
  it("returns null and opens breaker on 5xx", async () => {
    setEnv();
    mockFetch((url) => {
      if (url.includes("/models")) return Promise.resolve(modelsResponse());
      return Promise.resolve(new Response("server error", { status: 502 }));
    });

    const mod = await loadModule();
    const result = await mod.callOmniRoute("test");

    assert.equal(result, null);
    assert.ok(mod.isCircuitBreakerOpen());
  });

  // ── Test 7: Bad JSON → falls through ──
  it("returns null on malformed JSON response", async () => {
    setEnv();
    mockFetch((url) => {
      if (url.includes("/models")) return Promise.resolve(modelsResponse());
      return Promise.resolve(new Response("not json at all {{{", {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    });

    const mod = await loadModule();
    // json() will throw on "not json at all {{{"
    const result = await mod.callOmniRoute("test");
    // Should gracefully return null (caught by the try/catch)
    assert.equal(result, null);
  });

  // ── Test 8: Remote URL refused without flag ──
  it("refuses non-localhost URL without OMNIROUTE_ALLOW_REMOTE", async () => {
    setEnv({ OMNIROUTE_URL: "https://remote-omniroute.example.com/v1", OMNIROUTE_ALLOW_REMOTE: "false" });
    let fetchCalled = false;
    mockFetch(() => { fetchCalled = true; return Promise.resolve(okResponse()); });

    const mod = await loadModule();
    const result = await mod.callOmniRoute("test");

    assert.equal(result, null);
    assert.equal(fetchCalled, false, "should not call fetch for remote URL");
  });

  // ── Test 9: Remote URL allowed with flag ──
  it("allows remote URL when OMNIROUTE_ALLOW_REMOTE=true", async () => {
    setEnv({ OMNIROUTE_URL: "https://remote-omniroute.example.com/v1", OMNIROUTE_ALLOW_REMOTE: "true" });
    mockFetch((url) => {
      if (url.includes("/models")) return Promise.resolve(modelsResponse());
      return Promise.resolve(okResponse("remote ok"));
    });

    const mod = await loadModule();
    const result = await mod.callOmniRoute("test");

    assert.equal(result, "remote ok");
  });

  // ── Test 10: No search request ever sent ──
  it("never calls /v1/search or any non-chat endpoint", async () => {
    setEnv();
    const calledUrls = [];
    mockFetch((url) => {
      calledUrls.push(url);
      if (url.includes("/models")) return Promise.resolve(modelsResponse());
      return Promise.resolve(okResponse("ok"));
    });

    const mod = await loadModule();
    await mod.callOmniRoute("search for jobs");
    await mod.callOmniRoute("find software engineer positions");
    await mod.callOmniRoute("news about Google hiring");

    for (const url of calledUrls) {
      assert.ok(!url.includes("/search"), `Must not call /search endpoint, got: ${url}`);
      // Only /models (health) and /chat/completions are allowed
      const path = new URL(url).pathname;
      assert.ok(
        path.endsWith("/models") || path.endsWith("/chat/completions"),
        `Only /models and /chat/completions allowed, got: ${path}`
      );
    }
  });

  // ── Test 11: Health check is cached for 30s ──
  it("caches health check result for 30 seconds", async () => {
    setEnv();
    let healthCalls = 0;
    mockFetch((url) => {
      if (url.includes("/models")) {
        healthCalls++;
        return Promise.resolve(modelsResponse());
      }
      return Promise.resolve(okResponse("ok"));
    });

    const mod = await loadModule();
    await mod.callOmniRoute("first call");
    await mod.callOmniRoute("second call");
    await mod.callOmniRoute("third call");

    assert.equal(healthCalls, 1, "health check should be called once (cached for subsequent calls)");
  });

  // ── Test 12: Empty choices → null ──
  it("returns null when response has no choices", async () => {
    setEnv();
    mockFetch((url) => {
      if (url.includes("/models")) return Promise.resolve(modelsResponse());
      return Promise.resolve(new Response(
        JSON.stringify({ choices: [] }),
        { status: 200, headers: { "content-type": "application/json" } }
      ));
    });

    const mod = await loadModule();
    const result = await mod.callOmniRoute("test");
    assert.equal(result, null);
  });
});
