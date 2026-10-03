// ─────────────────────────────────────────────────────────────────────
// llm_omniroute.js — Optional OmniRoute LLM Gateway Client
//
// OmniRoute (MIT, github.com/diegosouzapw/OmniRoute) is a local AI
// gateway that exposes one OpenAI-compatible endpoint with routing,
// fallback, retries, and multi-account rotation.
//
// This module is OPTIONAL and OFF by default (OMNIROUTE_ENABLED=false).
// It uses built-in fetch (Node 18+) — zero new dependencies.
//
// IMPORTANT: This module ONLY calls /v1/chat/completions.
// It MUST NEVER call /v1/search or any other OmniRoute endpoint.
// All web/job/news search MUST go through SerpApi (serpapi.js).
// ─────────────────────────────────────────────────────────────────────

const OMNIROUTE_TIMEOUT_MS = 6000;
const HEALTH_CACHE_TTL_MS = 30_000;
const CIRCUIT_BREAKER_OPEN_MS = 5 * 60 * 1000; // 5 minutes

// ─── State ───────────────────────────────────────────────────────────
let _healthCacheResult = null;
let _healthCacheExpiry = 0;
let _circuitBreakerOpenUntil = 0;

// ─── Config ──────────────────────────────────────────────────────────
function getConfig() {
  const enabled = (process.env.OMNIROUTE_ENABLED || "false").toLowerCase() === "true";
  const baseUrl = (process.env.OMNIROUTE_URL || "http://localhost:20128/v1").replace(/\/+$/, "");
  const apiKey = process.env.OMNIROUTE_API_KEY || "";
  const model = process.env.OMNIROUTE_MODEL || "auto/fast";
  const allowRemote = (process.env.OMNIROUTE_ALLOW_REMOTE || "false").toLowerCase() === "true";
  return { enabled, baseUrl, apiKey, model, allowRemote };
}

// ─── Security: localhost-only guard ──────────────────────────────────
function isLocalUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

// ─── Circuit Breaker ─────────────────────────────────────────────────
export function isCircuitBreakerOpen() {
  return Date.now() < _circuitBreakerOpenUntil;
}

function openCircuitBreaker() {
  _circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_OPEN_MS;
}

/** Reset circuit breaker (for testing). */
export function resetCircuitBreaker() {
  _circuitBreakerOpenUntil = 0;
  _healthCacheResult = null;
  _healthCacheExpiry = 0;
}

// ─── Health Check (cached 30s) ───────────────────────────────────────
export async function checkHealth(cfg) {
  const now = Date.now();
  if (_healthCacheResult !== null && now < _healthCacheExpiry) {
    return _healthCacheResult;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);

    const resp = await fetch(`${cfg.baseUrl}/models`, {
      method: "GET",
      headers: cfg.apiKey ? { "Authorization": `Bearer ${cfg.apiKey}` } : {},
      signal: controller.signal,
    });
    clearTimeout(timer);

    _healthCacheResult = resp.ok;
    _healthCacheExpiry = now + HEALTH_CACHE_TTL_MS;
    return _healthCacheResult;
  } catch {
    _healthCacheResult = false;
    _healthCacheExpiry = now + HEALTH_CACHE_TTL_MS;
    return false;
  }
}

// ─── Chat Completions Call ───────────────────────────────────────────
// ONLY calls POST /v1/chat/completions. Never /v1/search or other paths.
export async function callOmniRoute(prompt, systemPrompt = "", options = {}) {
  const cfg = getConfig();

  // Gate 1: disabled
  if (!cfg.enabled) return null;

  // Gate 2: circuit breaker open
  if (isCircuitBreakerOpen()) return null;

  // Gate 3: security — localhost only unless explicitly allowed
  if (!cfg.allowRemote && !isLocalUrl(cfg.baseUrl)) {
    if (process.env.DEBUG_LOGS) {
      console.log(`  \x1b[2m[OmniRoute] Refused non-local URL: ${cfg.baseUrl} (set OMNIROUTE_ALLOW_REMOTE=true to override)\x1b[0m`);
    }
    return null;
  }

  // Gate 4: health check
  const healthy = await checkHealth(cfg);
  if (!healthy) {
    openCircuitBreaker();
    return null;
  }

  // Build request body — standard OpenAI chat completions format
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const body = {
    model: cfg.model,
    messages,
    temperature: options.temperature ?? 0.2,
    stream: false,
  };

  // Support JSON mode if caller requests it
  if (options.response_format) {
    body.response_format = options.response_format;
  }

  const startMs = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OMNIROUTE_TIMEOUT_MS);

    const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey ? { "Authorization": `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const latencyMs = Date.now() - startMs;

    // ── 429: honor Retry-After, do NOT retry, open circuit breaker ──
    if (resp.status === 429) {
      const retryAfter = resp.headers.get("retry-after");
      if (process.env.DEBUG_LOGS) {
        console.log(`  \x1b[33m[OmniRoute] 429 rate-limited (retry-after: ${retryAfter || "none"}) — falling through to existing waterfall\x1b[0m`);
      }
      openCircuitBreaker();
      return null;
    }

    // ── 5xx: server error ──
    if (resp.status >= 500) {
      if (process.env.DEBUG_LOGS) {
        console.log(`  \x1b[33m[OmniRoute] ${resp.status} server error — falling through\x1b[0m`);
      }
      openCircuitBreaker();
      return null;
    }

    // ── Non-2xx ──
    if (!resp.ok) {
      if (process.env.DEBUG_LOGS) {
        console.log(`  \x1b[33m[OmniRoute] HTTP ${resp.status} — falling through\x1b[0m`);
      }
      openCircuitBreaker();
      return null;
    }

    // ── Parse response ──
    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content;

    if (!content) {
      if (process.env.DEBUG_LOGS) {
        console.log(`  \x1b[33m[OmniRoute] Empty response — falling through\x1b[0m`);
      }
      openCircuitBreaker();
      return null;
    }

    // ── Success: log latency in DEBUG mode ──
    if (process.env.DEBUG_LOGS) {
      const provider = resp.headers.get("x-omniroute-provider") || "unknown";
      const model = resp.headers.get("x-omniroute-model") || cfg.model;
      const upstreamMs = resp.headers.get("x-omniroute-latency-ms") || "?";
      const fallbacks = resp.headers.get("x-omniroute-fallback-attempts") || "0";
      console.log(
        `  \x1b[2m[OmniRoute] ✓ ${latencyMs}ms total (upstream: ${upstreamMs}ms) ` +
        `provider=${provider} model=${model} fallbacks=${fallbacks}\x1b[0m`
      );
    }

    return content;
  } catch (err) {
    const latencyMs = Date.now() - startMs;

    if (process.env.DEBUG_LOGS) {
      const reason = err.name === "AbortError" ? "timeout" : "connection error";
      console.log(`  \x1b[33m[OmniRoute] ${reason} after ${latencyMs}ms — falling through\x1b[0m`);
    }

    openCircuitBreaker();
    return null;
  }
}
