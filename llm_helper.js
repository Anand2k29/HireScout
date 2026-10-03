// ─────────────────────────────────────────────────────────────────────
// llm_helper.js — Shared LLM 429 Resiliency, Circuit Breaker & Rate Limiter
// Provides exponential backoff with full jitter, rate limiting, and circuit breaker
// to prevent thundering herd 429 errors across LLM providers.
// ─────────────────────────────────────────────────────────────────────

import { log } from "./utils.js";

const circuitBreakers = new Map(); // providerKey -> { openUntil: number, failureCount: number }
const lastCallTimes = new Map();   // providerKey -> number (timestamp)
const MIN_CALL_INTERVAL_MS = 250;  // 250ms token bucket minimum gap

/**
 * Calculates exponential backoff with full jitter
 * @param {number} attempt Attempt number (1-based)
 * @param {number} baseMs Base delay in milliseconds (default 1000)
 * @param {number} maxMs Max cap in milliseconds (default 8000)
 * @returns {number} Backoff delay in milliseconds
 */
export function calculateBackoffJitter(attempt = 1, baseMs = 1000, maxMs = 8000) {
  const expDelay = Math.min(maxMs, baseMs * Math.pow(2, attempt - 1));
  // Full jitter: random between 0 and expDelay
  return Math.floor(Math.random() * expDelay);
}

/**
 * Checks if circuit breaker is open for a provider/model
 * @param {string} providerKey 
 * @returns {boolean} True if open (skip provider), False if healthy
 */
export function isCircuitOpen(providerKey = "default") {
  const cb = circuitBreakers.get(providerKey);
  if (!cb) return false;
  if (Date.now() < cb.openUntil) return true;
  // Reset after cooldown expires
  circuitBreakers.delete(providerKey);
  return false;
}

/**
 * Records an error and trips circuit breaker if threshold reached
 * @param {string} providerKey 
 * @param {number} cooldownMs Cooldown period in ms (default 30000ms = 30s)
 */
export function recordFailure(providerKey = "default", cooldownMs = 30000) {
  const cb = circuitBreakers.get(providerKey) || { failureCount: 0, openUntil: 0 };
  cb.failureCount++;
  if (cb.failureCount >= 2) {
    cb.openUntil = Date.now() + cooldownMs;
    log("⚡", `[Circuit Breaker Opened] Endpoint "${providerKey}" paused for ${cooldownMs / 1000}s due to errors.`, "yellow");
  }
  circuitBreakers.set(providerKey, cb);
}

/**
 * Resets failure count on success
 * @param {string} providerKey 
 */
export function recordSuccess(providerKey = "default") {
  circuitBreakers.delete(providerKey);
}

/**
 * Token Bucket Minimum Rate Limiting Gap
 * @param {string} providerKey 
 */
export async function enforceRateLimitGap(providerKey = "default") {
  const lastTime = lastCallTimes.get(providerKey) || 0;
  const now = Date.now();
  const elapsed = now - lastTime;
  if (elapsed < MIN_CALL_INTERVAL_MS) {
    const waitTime = MIN_CALL_INTERVAL_MS - elapsed;
    await new Promise(res => setTimeout(res, waitTime));
  }
  lastCallTimes.set(providerKey, Date.now());
}

/**
 * Shared Resilient Execution Wrapper with Retry & Jitter
 * @param {Function} fn Function returning promise
 * @param {Object} options Options { maxRetries, providerKey, baseMs }
 */
export async function executeResilientLlmCall(fn, options = {}) {
  const maxRetries = options.maxRetries || 2;
  const providerKey = options.providerKey || "llm_default";
  const baseMs = options.baseMs || 1000;

  if (isCircuitOpen(providerKey)) {
    return null;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    await enforceRateLimitGap(providerKey);
    try {
      const result = await fn();
      if (result) {
        recordSuccess(providerKey);
        return result;
      }
    } catch (err) {
      const is429 = err.response?.status === 429 || /429|rate limit/i.test(err.message || "");
      if (is429) {
        log("⚡", `[LLM 429 Rate Limit] Attempt ${attempt}/${maxRetries} on "${providerKey}". Applying backoff jitter...`, "yellow");
        recordFailure(providerKey, 20000);
      }
      if (attempt < maxRetries) {
        const jitterDelay = calculateBackoffJitter(attempt, baseMs);
        await new Promise(res => setTimeout(res, jitterDelay));
      }
    }
  }

  recordFailure(providerKey, 15000);
  return null;
}
