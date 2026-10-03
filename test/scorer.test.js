// ─────────────────────────────────────────────────────────────────────
// test/scorer.test.js — Deterministic 7-Signal Job Scorer Unit Tests
// ─────────────────────────────────────────────────────────────────────

import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateSkillsScore,
  calculateTitleScore,
  calculateSalaryScore,
  calculateDeadlineScore,
  calculateRatingScore,
  calculateFreshnessScore,
  calculateCompetitionScore,
  scoreJob,
  rankJobsDeterministically,
  compareJobs
} from "../scorer.js";

test("Deterministic 7-Signal Scorer Suite", async (t) => {

  await t.test("calculateSkillsScore computes accurate overlap points (max 30)", () => {
    const userSkills = ["TypeScript", "Node.js", "React", "SQL"];
    const jobSkills = ["TypeScript", "Node.js", "GraphQL"];

    const score = calculateSkillsScore(userSkills, jobSkills);
    // 2 matching out of 3 = 66% ratio -> ~20 points
    assert.ok(score >= 18 && score <= 30);
  });

  await t.test("calculateTitleScore matches role tokens (max 20)", () => {
    const score1 = calculateTitleScore("Software Engineer", "Senior Software Engineer");
    const score2 = calculateTitleScore("Software Engineer", "Graphic Designer");

    assert.equal(score1, 20);
    assert.ok(score2 < score1);
  });

  await t.test("scoreJob returns exact identical score when called twice (100% deterministic)", () => {
    const sampleJob = {
      id: "job-1",
      title: "Senior Full Stack Developer",
      company: "Stripe",
      required_skills: ["TypeScript", "Node.js", "React"],
      salary_range: "$150,000 - $180,000",
      posted_date: "1 day ago",
      company_rating: 4.8,
      apply_type: "Direct Apply"
    };

    const userProfile = {
      desired_role: "Software Engineer",
      skills: ["TypeScript", "Node.js", "React", "Python"]
    };

    const res1 = scoreJob(sampleJob, userProfile);
    const res2 = scoreJob(sampleJob, userProfile);

    assert.equal(res1.match_score, res2.match_score);
    assert.deepEqual(res1.match_breakdown, res2.match_breakdown);
    assert.equal(res1.why_suitable, res2.why_suitable);
  });

  await t.test("rankJobsDeterministically sorts job candidates descending by score", () => {
    const jobs = [
      { id: "low", title: "Marketing Specialist", required_skills: ["SEO"], company: "Corp A" },
      { id: "high", title: "Senior Software Engineer", required_skills: ["TypeScript", "Node.js", "React"], company: "Corp B" },
      { id: "mid", title: "Frontend Developer", required_skills: ["React"], company: "Corp C" }
    ];

    const profile = {
      desired_role: "Software Engineer",
      skills: ["TypeScript", "Node.js", "React"]
    };

    const ranked = rankJobsDeterministically(jobs, profile);

    assert.equal(ranked[0].id, "high");
    assert.ok(ranked[0].match_score >= ranked[1].match_score);
    assert.ok(ranked[1].match_score >= ranked[2].match_score);
  });

  await t.test("compareJobs evaluates two jobs side-by-side and returns winner + recommendation", () => {
    const jobA = { id: "1", title: "Senior Software Engineer", company: "Stripe", required_skills: ["Node.js", "React"] };
    const jobB = { id: "2", title: "Graphic Designer", company: "DesignCo", required_skills: ["Photoshop"] };

    const comp = compareJobs(jobA, jobB, { desired_role: "Software Engineer", skills: ["Node.js", "React"] });

    assert.equal(comp.winner.id, "1");
    assert.ok(comp.scoreDiff > 0);
    assert.ok(comp.recommendation.includes("Stripe"));
  });

});
