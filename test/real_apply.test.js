// ─────────────────────────────────────────────────────────────────────
// test/real_apply.test.js — Real-First Apply & Fallback Unit Tests
// ─────────────────────────────────────────────────────────────────────

import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  orderApplyOptions,
  preflightCheckLink,
  executeRealFirstApply,
  executeDemoFallback,
  logRunTrace
} from "../apply.js";

test("Real-First Apply Engine Suite", async (t) => {

  await t.test("orderApplyOptions prioritizes ATS / Direct Company links over aggregators", () => {
    const rawOptions = [
      "https://linkedin.com/jobs/view/123",
      "https://boards.greenhouse.io/acme/jobs/456",
      "https://indeed.com/viewjob?id=789",
      "https://jobs.lever.co/stripe/abc"
    ];

    const ordered = orderApplyOptions(rawOptions);

    // Greenhouse or Lever should come first before LinkedIn / Indeed
    assert.ok(ordered[0].includes("greenhouse.io") || ordered[0].includes("lever.co"));
    assert.ok(ordered[1].includes("greenhouse.io") || ordered[1].includes("lever.co"));
    assert.ok(ordered[2].includes("linkedin.com") || ordered[2].includes("indeed.com"));
  });

  await t.test("preflightCheckLink classifies login-wall text as BLOCKED", async () => {
    const mockPage = {
      goto: async () => ({ status: () => 200 }),
      waitForTimeout: async () => {},
      url: () => "https://example.com/login",
      evaluate: async () => "Please Sign In to your account. Enter Password to continue."
    };

    const res = await preflightCheckLink(mockPage, "https://example.com/login");
    assert.equal(res.usable, false);
    assert.equal(res.reason, "login_required");
  });

  await t.test("preflightCheckLink classifies captcha / bot check as BLOCKED", async () => {
    const mockPage = {
      goto: async () => ({ status: () => 200 }),
      waitForTimeout: async () => {},
      url: () => "https://example.com/challenge",
      evaluate: async () => "Verify you are human. Complete the CAPTCHA to continue."
    };

    const res = await preflightCheckLink(mockPage, "https://example.com/challenge");
    assert.equal(res.usable, false);
    assert.equal(res.reason, "captcha_bot_check");
  });

  await t.test("preflightCheckLink classifies HTTP 403 / 429 as BLOCKED", async () => {
    const mockPage = {
      goto: async () => ({ status: () => 403 }),
      waitForTimeout: async () => {}
    };

    const res = await preflightCheckLink(mockPage, "https://example.com/forbidden");
    assert.equal(res.usable, false);
    assert.equal(res.reason, "HTTP Error 403");
  });

  await t.test("preflightCheckLink classifies fillable form page as USABLE", async () => {
    let callCount = 0;
    const mockPage = {
      goto: async () => ({ status: () => 200 }),
      waitForTimeout: async () => {},
      url: () => "https://stripe.com/jobs/apply",
      evaluate: async () => {
        callCount++;
        if (callCount === 1) return "Job Application Form: Please enter your full name, email address, and phone.";
        return true; // 2+ form inputs found
      }
    };

    const res = await preflightCheckLink(mockPage, "https://stripe.com/jobs/apply");
    assert.equal(res.usable, true);
    assert.equal(res.reason, "usable_form_found");
  });

  await t.test("logRunTrace records trace event entry to run_trace.json", () => {
    const traceEntry = logRunTrace({
      job: "Senior Fullstack Engineer",
      company: "Stripe",
      status: "unit_test_trace"
    });

    assert.equal(traceEntry.job, "Senior Fullstack Engineer");
    assert.equal(traceEntry.status, "unit_test_trace");
    assert.ok(traceEntry.timestamp);

    const tracePath = path.resolve("./run_trace.json");
    assert.ok(fs.existsSync(tracePath));
  });

});
