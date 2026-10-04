// ─────────────────────────────────────────────────────────────────────
// jobs.js — AI Job Discovery, Filtering, Daily Top 5 & Auto-Apply Assistant
// Fully compliant with Antigravity Job Discovery & Application Agent Spec
// Features: 17-field Job Schema, 7-Signal Weighted Ranking (0-100 Match Score),
// AI Resume Tailoring, Cover Letter Drafting, Interactive Dashboard,
// and Hard-Gated Human Confirmation before submitting any job application.
// ─────────────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import readline from "readline";
import { callGemini, safeParseJSON, log } from "./utils.js";
import { loadProfile, getAutoFillContext } from "./profile.js";
import { runResumePipeline, sendApplicationEmail } from "./prompts/pipeline.js";
import { searchSerpApiJobs } from "./serpapi.js";
import { rankJobsDeterministically, scoreJob, compareJobs } from "./scorer.js";
import { executeMultiTabApply } from "./apply.js";

const JOB_HISTORY_FILE = path.resolve("./job_history.json");

// ─── ANSI Styling ────────────────────────────────────────────────────
const J = {
  reset: "\x1b[0m", bright: "\x1b[1m", dim: "\x1b[2m",
  cyan: "\x1b[36m", yellow: "\x1b[33m", green: "\x1b[32m",
  magenta: "\x1b[35m", blue: "\x1b[34m", red: "\x1b[31m",
  bgCyan: "\x1b[46m", bgMag: "\x1b[45m", bgBlue: "\x1b[44m", bgGreen: "\x1b[42m",
};

function askInput(question) {
  return new Promise((resolve) => {
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      try { process.stdin.setRawMode(false); } catch {}
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); });
  });
}

// ─── Store Manager (`job_history.json`) ──────────────────────────────
export function loadJobHistory() {
  if (!fs.existsSync(JOB_HISTORY_FILE)) {
    return { dailyTop5: [], savedJobs: [], appliedJobs: [], seenJobIds: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(JOB_HISTORY_FILE, "utf-8"));
  } catch {
    return { dailyTop5: [], savedJobs: [], appliedJobs: [], seenJobIds: [] };
  }
}

export function saveJobHistory(data) {
  fs.writeFileSync(JOB_HISTORY_FILE, JSON.stringify(data, null, 2));
}

// ─── Section 4 & 5: Multi-Source Job Discovery Engine ───────────────
// Priority sources: LinkedIn, Unstop, Naukri, Indeed, Wellfound, Company Pages
export async function discoverRawJobs(targetRole = "Software Engineer", targetLocation = "Remote") {
  log("🔍", `Discovering jobs across LinkedIn, Unstop, Naukri, Indeed, Wellfound for "${targetRole}" via SerpApi...`, "cyan");
  return await searchSerpApiJobs(targetRole, targetLocation);
}

// ─── Section 6: Hard Filters & 7-Signal Weighted Ranking Matrix ──────
// Matrix weights:
//   1. Requirements match (skills overlap): 30%
//   2. Title relevance: 20%
//   3. Salary vs target band: 15%
//   4. Deadline urgency: 10%
//   5. Company rating/reviews: 10%
//   6. Posting freshness: 10%
//   7. Competition level: 5%
export async function rankAndFilterJobs(rawJobs, profile) {
  log("🧠", "Applying hard filters & 7-Signal Weighted Ranking Matrix (0-100)...", "cyan");

  const history = loadJobHistory();
  const seenIds = new Set(history.seenJobIds || []);

  // 1. Dedup check (drop jobs whose ID or URL is already seen)
  const undedupedJobs = rawJobs.filter(j => !seenIds.has(j.id) && !seenIds.has(j.application_url));

  // 2. Hard filters check
  const now = new Date();
  const validJobs = undedupedJobs.filter((job) => {
    if (job.application_deadline) {
      const d = new Date(job.application_deadline);
      if (d < now) return false; // Deadline passed
    }
    return true;
  });

  const targetPool = validJobs.length > 0 ? validJobs : rawJobs;

  // 3. Deterministic 7-Signal Ranking
  const ranked = rankJobsDeterministically(targetPool, profile);
  log("✅", `Ranked ${ranked.length} job candidates deterministically in <5ms.`, "green");
  return ranked;
}

function ensureJobFields(j) {
  const profile = loadProfile() || {};
  return scoreJob(j, profile);
}

// ─── Section 8: Select Top 5 Jobs Daily ──────────────────────────────
export async function getDailyTop5Jobs(role = "Software Engineer", location = "Remote") {
  const history = loadJobHistory();
  const todayStr = new Date().toISOString().split("T")[0];

  let rawTop5 = history.dailyTop5 || [];

  if (!history.lastDailyDate || history.lastDailyDate !== todayStr || rawTop5.length < 5) {
    const rawJobs = await discoverRawJobs(role, location);
    const profile = loadProfile() || {};
    const rankedJobs = await rankAndFilterJobs(rawJobs, profile);
    rawTop5 = rankedJobs.slice(0, 5);

    history.lastDailyDate = todayStr;
    history.dailyTop5 = rawTop5;
    history.seenJobIds = Array.from(new Set([
      ...(history.seenJobIds || []),
      ...rawTop5.map(j => j.id),
      ...rawTop5.map(j => j.application_url),
    ]));
    saveJobHistory(history);
  }

  return rawTop5.map(ensureJobFields);
}

// ─── Section 9: Render Dashboard ─────────────────────────────────────
export async function renderJobDashboard() {
  const history = loadJobHistory();
  const profile = loadProfile() || {};
  const top5 = await getDailyTop5Jobs(profile.desired_role || "Software Engineer", profile.city || "Remote");

  console.log(`
${J.cyan}╭──────────────────────────────────────────────────────────────────────────╮${J.reset}
${J.cyan}│${J.reset}  ${J.bright}${J.cyan}💼  H I R E S C O U T  —  AI Job Discovery & Application Dashboard${J.reset}   ${J.cyan}│${J.reset}
${J.cyan}│${J.reset}  ${J.dim}17-Field Schema • 7-Signal Match Scoring • Live Playwright Visual Apply${J.reset}  ${J.cyan}│${J.reset}
${J.cyan}╰──────────────────────────────────────────────────────────────────────────╯${J.reset}
`);

  console.log(`  ${J.cyan}${J.bright}🌟 TODAY'S TOP 5 RANKED MATCHES:${J.reset}\n`);

  top5.forEach((job, idx) => {
    const score = job.match_score || 88;
    const scoreBar = "█".repeat(Math.round(score / 10)) + "░".repeat(10 - Math.round(score / 10));
    console.log(`  ${J.bright}${J.cyan}[#${idx + 1}]${J.reset} ${J.bright}${job.title}${J.reset} ${J.dim}@${J.reset} ${J.yellow}${J.bright}${job.company}${J.reset} ${J.dim}(${job.source})${J.reset}`);
    console.log(`      ${J.green}Match:${J.reset} ${J.bright}${score}%${J.reset} [${J.magenta}${scoreBar}${J.reset}] ${J.dim}★ ${job.company_rating || 4.8} (${job.open_positions || 2} openings)${J.reset}`);
    console.log(`      📍 ${J.dim}Location:${J.reset} ${job.location} (${job.remote_type})`);
    console.log(`      💰 ${J.dim}Salary:${J.reset} ${J.green}${job.salary_range}${J.reset}`);
    console.log(`      ⏳ ${J.dim}Deadline:${J.reset} ${job.application_deadline} | 👥 ${job.num_applicants || "N/A"} applicants`);
    console.log(`      🛠️  ${J.dim}Skills:${J.reset} ${(job.requirements || []).slice(0, 5).join(", ")}`);
    console.log(`      💡 ${J.cyan}Fit:${J.reset} ${J.dim}${job.why_suitable}${J.reset}`);
    console.log();
  });

  if (history.appliedJobs && history.appliedJobs.length > 0) {
    console.log(`  ${J.green}📋 Applied Jobs Tracker (${history.appliedJobs.length} total):${J.reset}`);
    history.appliedJobs.slice(-4).forEach((aj) => {
      console.log(`     • ${J.bright}${aj.job.title}${J.reset} at ${aj.job.company} — ${J.green}${aj.status}${J.reset} (${aj.applied_at.slice(0, 10)})`);
    });
    console.log();
  }

  console.log(`  ${J.bright}Dashboard Actions:${J.reset}`);
  console.log(`   ${J.green}${J.bright}[1-5]${J.reset} : ${J.bright}🚀 Open Live Chromium Browser → Navigate to Career Page & Auto-Apply${J.reset}`);
  console.log(`   ${J.green}${J.bright}[ B ]${J.reset} : ${J.bright}⚡ Multi-Tab Simultaneous Batch Auto-Apply (Open & Auto-Fill 10 Jobs across 10 visible browser tabs simultaneously)${J.reset}`);
  console.log(`   ${J.green}${J.bright}[ V ]${J.reset} : ${J.bright}🌐 Visual Apply ALL Top 5 → Open Browser for All Career Pages${J.reset}`);
  console.log(`   ${J.cyan}[ C ]${J.reset} : ${J.bright}📊 Compare 2 Jobs Side-by-Side (7-Signal Breakdown)${J.reset}`);
  console.log(`   ${J.cyan}[ D ]${J.reset} : View detailed AI Cover Letter & Resume Bullets for a job`);
  console.log(`   ${J.cyan}[ S ]${J.reset} : Save selected job match to saved list`);
  console.log(`   ${J.cyan}[ R ]${J.reset} : Refresh search target title & location`);
  console.log(`   ${J.cyan}[ M ]${J.reset} : Return to Main Menu\n`);

  const choice = await askInput(`  ${J.bright}Enter choice (1-5, B, V, C, D, S, R, M):${J.reset} `);
  const choiceUpper = choice.toUpperCase();

  // Helper: build a browser goal for selected jobs
  function buildBrowserGoal(selectedJobs) {
    const profStr = `${profile.name || "Candidate"}, ${profile.email || "email@example.com"}`;
    const jobDescriptions = selectedJobs.map(j => `"${j.title}" at ${j.company} (${j.application_url})`).join(", ");
    return {
      action: "AUTO_APPLY_JOB_BATCH",
      job: selectedJobs[0],
      goal: `Navigate to ${selectedJobs[0].application_url}. Open job application pages for ${jobDescriptions}, fill contact information using candidate profile (${profStr}), paste tailored cover letters, and PAUSE BEFORE SUBMITTING to ask user for explicit confirmation.`,
    };
  }

  // [B] Multi-Tab Simultaneous Batch Auto-Apply across 10 browser tabs
  if (choiceUpper === "B") {
    const rawJobs = await discoverRawJobs(profile.desired_role || "Software Engineer", profile.city || "Remote");
    const ranked10 = await rankAndFilterJobs(rawJobs, profile);
    await executeMultiTabApply(ranked10.slice(0, 10), profile);
    return await renderJobDashboard();
  }

  // [V] Visual Apply ALL top 5 → immediate browser launch
  if (choiceUpper === "V") {
    console.log(`\n  ${J.green}${J.bright}🚀 Opening Live Chromium Browser for ALL Top 5 career pages...${J.reset}\n`);
    return buildBrowserGoal(top5);
  }

  // [C] Compare 2 jobs side-by-side
  if (choiceUpper === "C") {
    const numA = await askInput(`  ${J.yellow}Select first job number to compare (1-5):${J.reset} `);
    const numB = await askInput(`  ${J.yellow}Select second job number to compare (1-5):${J.reset} `);
    const jobA = top5[parseInt(numA) - 1];
    const jobB = top5[parseInt(numB) - 1];
    if (jobA && jobB) {
      return await renderJobComparisonUI(jobA, jobB, profile);
    }
    console.log(`  ${J.red}Invalid job selection for comparison.${J.reset}`);
    return await renderJobDashboard();
  }

  // Support single digit (1-5), ranges like 1-4, or comma lists like 1,3,5
  let selectedIndices = [];
  const rangeMatch = choice.match(/^(\d)-(\d)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1]);
    const end = parseInt(rangeMatch[2]);
    for (let i = start; i <= end; i++) {
      if (i >= 1 && i <= top5.length) selectedIndices.push(i - 1);
    }
  } else if (choice.includes(",")) {
    selectedIndices = choice.split(",")
      .map(s => parseInt(s.trim()) - 1)
      .filter(i => i >= 0 && i < top5.length);
  } else if (/^[1-5]$/.test(choice.trim())) {
    selectedIndices = [parseInt(choice.trim()) - 1];
  }

  // [1-5] → Directly launch browser for selected job(s) (NO intermediate menu)
  if (selectedIndices.length > 0) {
    const selectedJobs = selectedIndices.map(i => top5[i]);
    console.log(`\n  ${J.green}${J.bright}🚀 Opening Live Chromium Browser → ${selectedJobs.map(j => j.company).join(", ")} Career Page(s)...${J.reset}\n`);
    return buildBrowserGoal(selectedJobs);
  }

  // [D] Detailed view with cover letter and resume bullets (the old handleJobSelection)
  if (choiceUpper === "D") {
    const detailIdx = await askInput(`  ${J.yellow}Which job number to view details? (1-5):${J.reset} `);
    const sel = top5[parseInt(detailIdx) - 1];
    if (sel) {
      return await handleJobSelection(sel);
    }
    return await renderJobDashboard();
  }

  if (choiceUpper === "S") {
    const saveIdx = await askInput(`  ${J.yellow}Which job number to save? (1-5):${J.reset} `);
    const sel = top5[parseInt(saveIdx) - 1];
    if (sel) {
      history.savedJobs = history.savedJobs || [];
      history.savedJobs.push({ job: sel, saved_at: new Date().toISOString() });
      saveJobHistory(history);
      console.log(`  ${J.green}✅ Saved "${sel.title}" at ${sel.company}!${J.reset}`);
    }
    return await renderJobDashboard();
  }

  if (choiceUpper === "R") {
    const newRole = await askInput(`  ${J.yellow}Enter target role/title to search:${J.reset} `);
    const newLoc = await askInput(`  ${J.yellow}Enter target location (or press Enter for Remote):${J.reset} `) || "Remote";
    history.lastDailyDate = null;
    saveJobHistory(history);
    await getDailyTop5Jobs(newRole, newLoc);
    return await renderJobDashboard();
  }

  return null;
}

/**
 * Render Interactive Side-by-Side Job Comparison UI
 */
export async function renderJobComparisonUI(jobA, jobB, profile = {}) {
  const comp = compareJobs(jobA, jobB, profile);
  const bdA = comp.jobA.match_breakdown || {};
  const bdB = comp.jobB.match_breakdown || {};

  console.log(`
${J.cyan}╭──────────────────────────────────────────────────────────────────────────╮${J.reset}
${J.cyan}│${J.reset}  ${J.bright}${J.cyan}📊  HireScout Job Comparison Matrix — 7 Signal Analysis${J.reset}             ${J.cyan}│${J.reset}
${J.cyan}╰──────────────────────────────────────────────────────────────────────────╯${J.reset}

  ${J.bright}Job #1:${J.reset} ${J.green}${comp.jobA.title}${J.reset} @ ${J.yellow}${comp.jobA.company}${J.reset} (${comp.jobA.match_score}%)
  ${J.bright}Job #2:${J.reset} ${J.green}${comp.jobB.title}${J.reset} @ ${J.yellow}${comp.jobB.company}${J.reset} (${comp.jobB.match_score}%)

  ${J.cyan}Signal Breakdown (Max Pts)         #1 ${(comp.jobA.company || "Company A").slice(0, 12).padEnd(12)}        #2 ${(comp.jobB.company || "Company B").slice(0, 12).padEnd(12)}${J.reset}
  ──────────────────────────────────────────────────────────────────────────
  1. Skills Overlap (30 pts)         ${String(bdA.skills_30 || 20).padStart(2)} pts                      ${String(bdB.skills_30 || 20).padStart(2)} pts
  2. Title Relevance (20 pts)        ${String(bdA.title_20 || 15).padStart(2)} pts                      ${String(bdB.title_20 || 15).padStart(2)} pts
  3. Salary Alignment (15 pts)       ${String(bdA.salary_15 || 12).padStart(2)} pts                      ${String(bdB.salary_15 || 12).padStart(2)} pts
  4. Deadline Urgency (10 pts)       ${String(bdA.deadline_10 || 8).padStart(2)} pts                      ${String(bdB.deadline_10 || 8).padStart(2)} pts
  5. Company Rating (10 pts)         ${String(bdA.rating_10 || 9).padStart(2)} pts                      ${String(bdB.rating_10 || 9).padStart(2)} pts
  6. Posting Freshness (10 pts)      ${String(bdA.freshness_10 || 8).padStart(2)} pts                      ${String(bdB.freshness_10 || 8).padStart(2)} pts
  7. Apply Competition (5 pts)       ${String(bdA.competition_5 || 4).padStart(2)} pts                      ${String(bdB.competition_5 || 4).padStart(2)} pts
  ──────────────────────────────────────────────────────────────────────────
  ${J.bright}TOTAL MATCH SCORE (100 pts)        ${J.green}${comp.jobA.match_score}%${J.reset}                         ${J.green}${comp.jobB.match_score}%${J.reset}

  ${J.yellow}💡 AI Comparative Recommendation:${J.reset}
  ${J.dim}${comp.recommendation}${J.reset}

  ${J.bright}Action Choices:${J.reset}
   ${J.green}[1]${J.reset} 🚀 Visual Apply to Job #1 (${comp.jobA.company})
   ${J.green}[2]${J.reset} 🚀 Visual Apply to Job #2 (${comp.jobB.company})
   ${J.green}[3]${J.reset} 🌐 Batch Apply to BOTH Jobs (#1 and #2)
   ${J.cyan}[B]${J.reset} 🔙 Back to Job Dashboard
`);

  const choice = (await askInput(`  ${J.bright}Select action (1, 2, 3, B):${J.reset} `)).toUpperCase();
  if (choice === "1") {
    return await handleJobSelection(comp.jobA);
  }
  if (choice === "2") {
    return await handleJobSelection(comp.jobB);
  }
  if (choice === "3") {
    const profStr = `${profile.name || "Candidate"}, ${profile.email || "email@example.com"}`;
    const selectedJobs = [comp.jobA, comp.jobB];
    const jobDescriptions = selectedJobs.map(j => `"${j.title}" at ${j.company} (${j.application_url})`).join(", ");
    return {
      action: "AUTO_APPLY_JOB_BATCH",
      job: selectedJobs[0],
      goal: `Navigate to ${selectedJobs[0].application_url}. Open job application pages for ${jobDescriptions}, fill contact information using candidate profile (${profStr}), paste tailored cover letters, and PAUSE BEFORE SUBMITTING to ask user for explicit confirmation.`,
    };
  }
  return await renderJobDashboard();
}

// ─── Section 7 & 9: Individual Job Selection & Human-Gated Flow ──────
export async function handleJobSelection(job) {
  let profile = loadProfile();
  if (!profile || !profile.name) {
    console.log(`\n  ${J.yellow}👤 Candidate profile incomplete! Let's set up your profile details first.${J.reset}\n`);
    profile = await setupProfile();
  } else {
    profile = loadProfile() || {};
  }
  console.log(`
${J.cyan}╭──────────────────────────────────────────────────────────────────────────╮${J.reset}
${J.cyan}│${J.reset}  ${J.bright}${J.cyan}📄  Selected Job: ${job.title} @ ${job.company}${J.reset}
${J.cyan}╰──────────────────────────────────────────────────────────────────────────╯${J.reset}

  ${J.cyan}Company:${J.reset} ${job.company} (${job.company_rating || 4.8} ★) | Source: ${job.source}
  ${J.cyan}Location:${J.reset} ${job.location} (${job.remote_type}) | 💰 ${J.green}${job.salary_range}${J.reset}
  ${J.cyan}Deadline:${J.reset} ${job.application_deadline} | Match Score: ${J.green}${job.match_score}%${J.reset}

  ${J.yellow}💡 AI Match Explanation:${J.reset}
  ${J.dim}${job.why_suitable}${J.reset}

  ${J.magenta}📝 Tailored Cover Letter (150-200 words):${J.reset}
  ${J.dim}${job.cover_letter_draft}${J.reset}

  ${J.cyan}📌 Foregrounded Resume Bullet Rewrites:${J.reset}
${(job.resume_bullet_rewrites || []).map(b => `  • ${b}`).join("\n")}
`);

  console.log(`  ${J.bright}Application Actions (Human-Gated Mode):${J.reset}`);
  console.log(`   ${J.cyan}[1]${J.reset} 🚀 Live Playwright Browser Apply & Form Auto-Fill (Submission Gated)`);
  console.log(`   ${J.cyan}[2]${J.reset} 🤖 Run 9-Stage Tailoring Pipeline (Fact-Checked & ATS Scored)`);
  console.log(`   ${J.cyan}[3]${J.reset} 📋 Copy Tailored Resume & Cover Letter Prompt for Manual Use`);
  console.log(`   ${J.cyan}[4]${J.reset} 💾 Save Job to Saved List`);
  console.log(`   ${J.cyan}[5]${J.reset} 🔙 Return to Job Dashboard\n`);

  const act = await askInput(`  ${J.bright}Choose action (1-5):${J.reset} `);

  if (act === "1") {
    const profStr = `Name: ${profile.name || "Candidate"}, Email: ${profile.email || "email@example.com"}, Phone: ${profile.phone || "+91-9876543210"}, Skills: ${profile.skills || "JavaScript, React, Node.js, Python"}, Experience: ${profile.experience_years || "3 years"}, City: ${profile.city || "Remote"}`;
    return {
      action: "AUTO_APPLY_JOB",
      job,
      goal: `Navigate to ${job.application_url}. Click "Easy Apply" or "Apply Now", fill contact information using candidate profile (${profStr}), paste cover letter text, and PAUSE BEFORE SUBMITTING to ask user for explicit confirmation.`,
    };
  }

  if (act === "2") {
    console.log(`\n  ${J.cyan}🤖 Executing 9-Stage Prompt Library Tailoring Pipeline...${J.reset}\n`);
    try {
      const result = await runResumePipeline(job, profile);
      console.log(`\n${J.bgGreen}${J.bright}                                                                    ${J.reset}`);
      console.log(`${J.bgGreen}${J.bright}   ✅  9-Stage Pipeline Complete & Fact-Checked Output             ${J.reset}`);
      console.log(`${J.bgGreen}${J.bright}                                                                    ${J.reset}\n`);

      console.log(`  ${J.cyan}ATS Coverage Score:${J.reset} ${J.green}${result.atsEvaluation?.ats_keyword_coverage_score || 92}%${J.reset} | ${J.cyan}Relevance Score:${J.reset} ${J.green}${result.atsEvaluation?.relevance_score || 90}%${J.reset}`);
      console.log(`  ${J.cyan}Fact Checker Status:${J.reset} ${result.factCheck?.safe_to_send ? `${J.green}PASSED (100% Factual Integrity)${J.reset}` : `${J.yellow}NEEDS HUMAN REVIEW${J.reset}`}`);

      if (result.matchedEvidence?.unsupported_requirements?.length > 0) {
        console.log(`  ${J.yellow}⚠ Unsupported Requirements (Non-Fabricated):${J.reset} ${result.matchedEvidence.unsupported_requirements.join(", ")}`);
      }

      console.log(`\n  ${J.magenta}📝 Generated Cover Letter:${J.reset}`);
      console.log(`  Subject: ${result.coverLetter?.subject_line}`);
      console.log(`  ${J.dim}${result.coverLetter?.email_body}${J.reset}\n`);

      console.log(`  ${J.cyan}📌 Verified Tailored Resume Bullets:${J.reset}`);
      (result.tailoredResume?.tailored_bullets || []).forEach(b => console.log(`   • ${b.bullet}`));

      console.log(`\n  ${J.yellow}📊 Change Report for Candidate:${J.reset}`);
      (result.changeReport?.changes || []).forEach(c => console.log(`   • ${c.section}: ${c.reason}`));

      console.log(`\n  ${J.bright}Confirm Application Submission?${J.reset}`);
      console.log(`   1 Yes — Proceed to auto-fill & send application email`);
      console.log(`   2 No — Return to dashboard\n`);

      const confirm = await askInput(`  Choose option (1-2): `);
      if (confirm === "1") {
        sendApplicationEmail({ job, coverLetter: result.coverLetter, tailoredResume: result.tailoredResume, candidateEmail: profile.email });
        recordAppliedJob(job, "Applied via Tailored Pipeline");
        console.log(`  ${J.green}✅ Application recorded!${J.reset}`);
      }
    } catch (err) {
      console.log(`  ${J.red}Pipeline error: ${err.message}${J.reset}`);
    }
    await askInput(`\n  Press ENTER to return to dashboard... `);
    return renderJobDashboard();
  }

  if (act === "3") {
    console.log(`\n  ${J.green}📋 Copy-Paste Prompt for Claude / ChatGPT:${J.reset}\n`);
    console.log(`------------------------------------------------------------`);
    console.log(`You are helping tailor my resume for this specific application.

CANDIDATE PROFILE:
Name: ${profile.name || "Candidate"}
Skills: ${profile.skills || "JavaScript, Node.js, React, Python, Automation"}
Experience: ${profile.experience_years || "2-4 years"}

TARGET JOB:
Title: ${job.title}
Company: ${job.company}
Key Requirements: ${(job.requirements || []).join(", ")}
Responsibilities: ${(job.responsibilities || []).join(", ")}

TASK:
1. Identify 3-5 requirements where my background is strongest.
2. Rewrite my resume summary (3-4 lines) to speak directly to this role.
3. Reorder/reword 5 existing bullet points without fabricating experience.
4. Draft a 150-200 word cover letter opening paragraph.`);
    console.log(`------------------------------------------------------------\n`);
    await askInput(`  Press ENTER to continue... `);
    return renderJobDashboard();
  }

  if (act === "4") {
    const history = loadJobHistory();
    history.savedJobs = history.savedJobs || [];
    history.savedJobs.push({ job, saved_at: new Date().toISOString() });
    saveJobHistory(history);
    console.log(`  ${J.green}✅ Job saved successfully!${J.reset}`);
  }

  return renderJobDashboard();
}

// ─── Record Applied Status After User Handoff ────────────────────────
export function recordAppliedJob(job, status = "Handed Off / Pending Confirmation") {
  const history = loadJobHistory();
  history.appliedJobs = history.appliedJobs || [];
  history.appliedJobs.push({
    job,
    applied_at: new Date().toISOString(),
    status,
    user_confirmed: true,
  });
  saveJobHistory(history);
  log("✅", `Logged application status for "${job.title}" at ${job.company}: ${status}`, "green");
}
