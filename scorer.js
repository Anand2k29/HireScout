// ─────────────────────────────────────────────────────────────────────
// scorer.js — Deterministic 7-Signal Job Scorer & 17-Field Schema Parser
// Computes 0-100 match scores, breakdowns, fit summaries, and draft templates
// strictly deterministically (0ms network latency, zero Math.random()).
// ─────────────────────────────────────────────────────────────────────

/**
 * 7-Signal Weight Definitions
 * Total max score = 30 + 20 + 15 + 10 + 10 + 10 + 5 = 100
 */

/**
 * Signal 1: Skills Match (Max 30 pts)
 */
export function calculateSkillsScore(userSkills = [], jobSkills = []) {
  if (!jobSkills || jobSkills.length === 0) return 20; // Default baseline if job lists no specific skills
  if (!userSkills || userSkills.length === 0) {
    userSkills = ["JavaScript", "TypeScript", "Node.js", "React", "Python", "SQL", "Git"];
  }
  // Handle skills stored as comma-separated string (from user_profile.json)
  if (typeof userSkills === "string") userSkills = userSkills.split(",").map(s => s.trim()).filter(Boolean);
  if (typeof jobSkills === "string") jobSkills = jobSkills.split(",").map(s => s.trim()).filter(Boolean);

  const normalizedUser = userSkills.map(s => String(s).toLowerCase().trim());
  const normalizedJob = jobSkills.map(s => String(s).toLowerCase().trim());

  let matches = 0;
  normalizedJob.forEach(js => {
    if (normalizedUser.some(us => us.includes(js) || js.includes(us))) {
      matches++;
    }
  });

  const matchRatio = matches / Math.max(1, normalizedJob.length);
  // Scale to 30 pts, minimum 12 pts for baseline engineering overlap
  return Math.min(30, Math.max(12, Math.round(matchRatio * 30)));
}

/**
 * Signal 2: Title Relevance (Max 20 pts)
 */
export function calculateTitleScore(targetRole = "Software Engineer", jobTitle = "") {
  if (!jobTitle) return 10;
  const targetTokens = targetRole.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const titleLower = jobTitle.toLowerCase();

  let matchedTokens = 0;
  targetTokens.forEach(token => {
    if (titleLower.includes(token)) matchedTokens++;
  });

  const ratio = matchedTokens / Math.max(1, targetTokens.length);
  return Math.min(20, Math.max(8, Math.round(ratio * 20)));
}

/**
 * Signal 3: Salary Alignment (Max 15 pts)
 */
export function calculateSalaryScore(salaryRange = "") {
  if (!salaryRange || salaryRange.toLowerCase().includes("competitive") || salaryRange.toLowerCase().includes("market")) {
    return 12; // Standard default
  }
  // Check for six-figure or ₹20L+ numbers
  const hasHighNumber = /\$?1[0-9]{2},[0-9]{3}|\$2[0-9]{2},[0-9]{3}|₹[1-9][0-9]L|₹[1-9][0-9],00,000/i.test(salaryRange);
  return hasHighNumber ? 15 : 13;
}

/**
 * Signal 4: Application Deadline / Urgency (Max 10 pts)
 */
export function calculateDeadlineScore(deadline = "", postedDate = "") {
  if (deadline) {
    const d = new Date(deadline);
    const now = new Date();
    const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 0; // Expired
    if (diffDays <= 7) return 10; // High urgency
    if (diffDays <= 14) return 9;
    return 7;
  }
  return 8;
}

/**
 * Signal 5: Company Rating (Max 10 pts)
 */
export function calculateRatingScore(rating = 4.5) {
  const numericRating = typeof rating === "number" ? rating : parseFloat(rating) || 4.5;
  return Math.min(10, Math.max(4, Math.round(numericRating * 2)));
}

/**
 * Signal 6: Posting Freshness (Max 10 pts)
 */
export function calculateFreshnessScore(postedDate = "") {
  const p = (postedDate || "").toLowerCase();
  if (p.includes("just now") || p.includes("today") || p.includes("1 day") || p.includes("hour")) return 10;
  if (p.includes("2 day") || p.includes("3 day")) return 9;
  if (p.includes("4 day") || p.includes("5 day") || p.includes("6 day")) return 8;
  if (p.includes("week")) return 7;
  return 6;
}

/**
 * Signal 7: Competition & Apply Type (Max 5 pts)
 */
export function calculateCompetitionScore(applyType = "", openPositions = 2) {
  let score = 3;
  if (applyType === "Direct Apply") score += 1;
  if (openPositions > 1) score += 1;
  return Math.min(5, score);
}

/**
 * Main Deterministic Scorer Function
 * Evaluates a single job object against user profile
 * @param {Object} job 17-field HireScout job object
 * @param {Object} profile User profile object
 * @returns {Object} Evaluated job with match_score, match_breakdown, why_suitable, cover_letter_draft
 */
export function scoreJob(job = {}, profile = {}) {
  let userSkills = profile.skills || profile.skills_array || [
    "JavaScript", "TypeScript", "Node.js", "React", "Python", "SQL", "Git", "Playwright"
  ];
  // Handle skills stored as comma-separated string (from user_profile.json)
  if (typeof userSkills === "string") userSkills = userSkills.split(",").map(s => s.trim()).filter(Boolean);
  const targetRole = profile.desired_role || profile.role || "Software Engineer";
  const userName = profile.name || profile.full_name || "Candidate";

  let jobSkills = job.required_skills || job.requirements || [];
  if (typeof jobSkills === "string") jobSkills = jobSkills.split(",").map(s => s.trim()).filter(Boolean);

  const skills_30 = calculateSkillsScore(userSkills, jobSkills);
  const title_20 = calculateTitleScore(targetRole, job.title || "");
  const salary_15 = calculateSalaryScore(job.salary_range || "");
  const deadline_10 = calculateDeadlineScore(job.application_deadline, job.posted_date);
  const rating_10 = calculateRatingScore(job.company_rating || 4.6);
  const freshness_10 = calculateFreshnessScore(job.posted_date);
  const competition_5 = calculateCompetitionScore(job.apply_type, job.open_positions || 2);

  const totalScore = skills_30 + title_20 + salary_15 + deadline_10 + rating_10 + freshness_10 + competition_5;
  const matchScore = Math.min(99, Math.max(50, totalScore));

  const topSkillsStr = jobSkills.slice(0, 3).join(", ") || "core web development";
  const companyName = job.company || "the company";
  const jobTitle = job.title || "Software Engineer";

  const whySuitable = `Strong match (${matchScore}%) for your background in ${topSkillsStr}. Fits your ${targetRole} target with competitive salary (${job.salary_range || "Market Standard"}) and high company rating.`;

  const coverLetterDraft = `Dear Hiring Manager at ${companyName},\n\nI am writing to express my strong interest in the ${jobTitle} position. With my expertise in ${userSkills.slice(0, 4).join(", ")}, I have built resilient web applications and high-throughput backend services. I admire ${companyName}'s engineering standards and look forward to contributing to your team's success.`;

  const resumeBulletRewrites = [
    `Architected scalable Node.js and frontend features matching ${companyName}'s stack`,
    `Optimized asynchronous application workflows, reducing end-to-end processing latency`,
    `Engineered resilient automated tools and API integrations for production services`
  ];

  return {
    ...job,
    match_score: matchScore,
    match_breakdown: {
      skills_30,
      title_20,
      salary_15,
      deadline_10,
      rating_10,
      freshness_10,
      competition_5
    },
    why_suitable: job.why_suitable || whySuitable,
    cover_letter_draft: job.cover_letter_draft || coverLetterDraft,
    resume_bullet_rewrites: job.resume_bullet_rewrites || resumeBulletRewrites
  };
}

/**
 * Compares two job candidates side-by-side on 7 signals
 * @param {Object} jobA 
 * @param {Object} jobB 
 * @param {Object} profile 
 * @returns {Object} Analytical comparison result
 */
export function compareJobs(jobA = {}, jobB = {}, profile = {}) {
  const scoredA = scoreJob(jobA, profile);
  const scoredB = scoreJob(jobB, profile);

  const scoreDiff = scoredA.match_score - scoredB.match_score;
  const winner = scoreDiff >= 0 ? scoredA : scoredB;
  const runnerUp = scoreDiff >= 0 ? scoredB : scoredA;

  let recommendation = "";
  if (Math.abs(scoreDiff) <= 2) {
    recommendation = `Both ${scoredA.company} (${scoredA.title}) and ${scoredB.company} (${scoredB.title}) are virtually equal matches (~${scoredA.match_score}%). Choose based on salary vs location preference.`;
  } else {
    recommendation = `${winner.company} (${winner.title}) ranks ${Math.abs(scoreDiff)}% higher overall than ${runnerUp.company} due to stronger match on key required skills (${(winner.required_skills || []).slice(0, 3).join(", ")}) and title relevance.`;
  }

  return {
    jobA: scoredA,
    jobB: scoredB,
    scoreDiff,
    winner,
    runnerUp,
    recommendation
  };
}

/**
 * Scores and ranks an array of raw jobs deterministically
 * @param {Object[]} rawJobs 
 * @param {Object} profile 
 * @returns {Object[]} Ranked jobs sorted descending by match_score
 */
export function rankJobsDeterministically(rawJobs = [], profile = {}) {
  if (!Array.isArray(rawJobs) || rawJobs.length === 0) return [];
  const scored = rawJobs.map(job => scoreJob(job, profile));
  return scored.sort((a, b) => b.match_score - a.match_score);
}
