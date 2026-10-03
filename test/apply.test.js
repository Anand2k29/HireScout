// ─────────────────────────────────────────────────────────────────────
// test/apply.test.js — Apply Flow & Audit Trail Unit Tests
// ─────────────────────────────────────────────────────────────────────

import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { resolveTargetUrl, recordAppliedJob } from "../apply.js";
import { loadJobHistory } from "../jobs.js";

test("Apply Flow & Audit Trail Suite", async (t) => {

  await t.test("resolveTargetUrl correctly handles demo site and external URLs", () => {
    const resolvedLocal = resolveTargetUrl("http://localhost:3000/demo_site/apply.html");
    const resolvedNull = resolveTargetUrl(null);
    const resolvedExternal = resolveTargetUrl("https://stripe.com/jobs");

    assert.ok(resolvedLocal.startsWith("file:///"));
    assert.ok(resolvedLocal.includes("demo_site/apply.html"));
    assert.ok(resolvedNull.startsWith("file:///"));
    assert.equal(resolvedExternal, "https://stripe.com/jobs");
  });

  await t.test("demo_site/apply.html exists and includes required form fields", () => {
    const demoPath = path.resolve("./demo_site/apply.html");
    assert.ok(fs.existsSync(demoPath), "demo_site/apply.html must exist");

    const html = fs.readFileSync(demoPath, "utf-8");
    assert.ok(html.includes("id=\"applicant-name\""));
    assert.ok(html.includes("id=\"applicant-email\""));
    assert.ok(html.includes("id=\"applicant-phone\""));
    assert.ok(html.includes("id=\"cover-letter\""));
    assert.ok(html.includes("id=\"submit-application-btn\""));
  });

  await t.test("recordAppliedJob appends timestamped evidence record to job_history.json", () => {
    const dummyJob = {
      id: "test-apply-job-99",
      title: "Test Engineer",
      company: "Test Corp",
      application_url: "http://localhost:3000/demo_site/apply.html"
    };

    const record = recordAppliedJob(dummyJob, "Applied via Unit Test", "/fake/path.png");

    assert.equal(record.job.id, "test-apply-job-99");
    assert.equal(record.status, "Applied via Unit Test");
    assert.ok(record.applied_at);
    assert.equal(record.screenshot_evidence, "/fake/path.png");

    const history = loadJobHistory();
    assert.ok(Array.isArray(history.appliedJobs));
    const found = history.appliedJobs.find(aj => aj.job.id === "test-apply-job-99");
    assert.ok(found, "Record must be written to job_history.json");
  });

});
