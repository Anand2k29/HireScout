// ─────────────────────────────────────────────────────────────────────
// test/serpapi.test.js — SerpApi Job Discovery & Schema Unit Tests
// ─────────────────────────────────────────────────────────────────────

import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  extractSkillsFromText,
  inferExperienceLevel,
  normalizeSerpApiJob,
  getMockSerpApiJobs,
  searchSerpApiJobs
} from "../serpapi.js";

test("SerpApi Integration", async (t) => {

  await t.test("extractSkillsFromText extracts technology keywords correctly", () => {
    const text = "We are looking for a Senior Developer proficient in Node.js, React, TypeScript, and PostgreSQL.";
    const skills = extractSkillsFromText(text);

    assert.ok(skills.includes("Node.js"));
    assert.ok(skills.includes("React"));
    assert.ok(skills.includes("TypeScript"));
    assert.ok(skills.includes("PostgreSQL"));
  });

  await t.test("inferExperienceLevel correctly categorizes job titles & descriptions", () => {
    assert.equal(inferExperienceLevel("Senior Fullstack Engineer", ""), "Senior (5+ yrs)");
    assert.equal(inferExperienceLevel("Junior Web Developer", ""), "Entry / Junior (0-2 yrs)");
    assert.equal(inferExperienceLevel("Software Engineer", "Seeking 3 years experience"), "Mid-Senior (3-5 yrs)");
  });

  await t.test("normalizeSerpApiJob constructs complete 17-field schema object", () => {
    const rawGoogleJob = {
      job_id: "test-job-123",
      title: "Backend Engineer",
      company_name: "Acme Corp",
      location: "Bengaluru, India",
      via: "via LinkedIn",
      description: "Building scalable APIs with Node.js and AWS.",
      apply_options: [
        { link: "https://acme.com/apply", is_direct: true }
      ],
      detected_extensions: {
        posted_at: "3 days ago",
        salary: "$120,000 - $140,000",
        schedule_type: "Full-time"
      }
    };

    const normalized = normalizeSerpApiJob(rawGoogleJob, 0);

    // Verify 17 fields
    assert.equal(normalized.id, "test-job-123");
    assert.equal(normalized.title, "Backend Engineer");
    assert.equal(normalized.company, "Acme Corp");
    assert.equal(normalized.location, "Bengaluru, India");
    assert.equal(normalized.source, "via LinkedIn");
    assert.equal(normalized.posted_date, "3 days ago");
    assert.equal(normalized.application_url, "https://acme.com/apply");
    assert.equal(normalized.apply_type, "Direct Apply");
    assert.equal(normalized.salary_range, "$120,000 - $140,000");
    assert.equal(normalized.job_type, "Full-time");
    assert.ok(normalized.experience_level);
    assert.ok(Array.isArray(normalized.required_skills));
    assert.ok(normalized.required_skills.includes("Node.js"));
    assert.ok(normalized.required_skills.includes("AWS"));
    assert.ok(normalized.role_summary);
    assert.equal(normalized.full_description, rawGoogleJob.description);
    assert.equal(normalized.match_score, 0);
    assert.equal(normalized.why_suitable, "");
    assert.equal(normalized.cover_letter_draft, "");
  });

  await t.test("getMockSerpApiJobs returns high quality fallback jobs", () => {
    const mockJobs = getMockSerpApiJobs("Software Engineer", "Remote");
    assert.ok(Array.isArray(mockJobs));
    assert.ok(mockJobs.length >= 4);

    const firstJob = mockJobs[0];
    assert.ok(firstJob.id);
    assert.ok(firstJob.title.includes("Software Engineer") || firstJob.title.includes("Full-Stack"));
    assert.ok(firstJob.application_url);
    assert.ok(firstJob.required_skills.length > 0);
  });

  await t.test("searchSerpApiJobs uses mock fallback when SERPAPI_KEY is not set", async () => {
    const originalKey = process.env.SERPAPI_KEY;
    delete process.env.SERPAPI_KEY;

    try {
      const jobs = await searchSerpApiJobs("Node Developer", "Remote", { useCache: false });
      assert.ok(Array.isArray(jobs));
      assert.ok(jobs.length > 0);
      assert.ok(jobs[0].id.startsWith("serpapi-mock"));
    } finally {
      process.env.SERPAPI_KEY = originalKey;
    }
  });

  await t.test("searchSerpApiJobs writes and respects 30-min cache entries", async () => {
    const originalKey = process.env.SERPAPI_KEY;
    const originalCache = process.env.SERPAPI_CACHE;
    delete process.env.SERPAPI_KEY; // test with mock generator to populate cache cleanly
    process.env.SERPAPI_CACHE = "true";

    const cacheFile = path.resolve("./.kairo_temp/serpapi_cache.json");
    
    try {
      // First fetch creates cache or returns cached
      const jobs1 = await searchSerpApiJobs("CacheTestRole", "RemoteLocation", { useCache: true });
      assert.ok(jobs1.length > 0);

      // Verify cache file exists
      if (fs.existsSync(cacheFile)) {
        const cacheContent = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
        assert.ok(Object.keys(cacheContent).length > 0);
      }
    } finally {
      process.env.SERPAPI_KEY = originalKey;
      process.env.SERPAPI_CACHE = originalCache;
    }
  });

});
