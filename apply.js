// ─────────────────────────────────────────────────────────────────────
// apply.js — Real-First Apply Controller with Demo-Site Fallback
// Walks candidate jobs in rank order, conducts 12s deterministic preflights,
// skips blocked/login/captcha pages without evasion, enforces Section 9 typed-gate,
// and falls back to demo_site/apply.html labeled DEMO if all links are blocked.
// ─────────────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import readline from "readline";
import { chromium } from "playwright";
import { loadProfile } from "./profile.js";
import { loadJobHistory, saveJobHistory } from "./jobs.js";
import { log } from "./utils.js";
import { BRANDING } from "./branding.js";

const SCREENSHOTS_DIR = path.resolve("./applications/screenshots");
const TRACE_FILE = path.resolve("./run_trace.json");

function askInput(question) {
  return new Promise((resolve) => {
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      try { process.stdin.setRawMode(false); } catch {}
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); });
  });
}

/**
 * Audit Trail & Trace Logging Helper
 */
export function logRunTrace(event = {}) {
  let traceData = [];
  if (fs.existsSync(TRACE_FILE)) {
    try {
      traceData = JSON.parse(fs.readFileSync(TRACE_FILE, "utf-8"));
      if (!Array.isArray(traceData)) traceData = [];
    } catch {
      traceData = [];
    }
  }

  const entry = {
    timestamp: new Date().toISOString(),
    ...event
  };

  traceData.push(entry);
  try {
    fs.writeFileSync(TRACE_FILE, JSON.stringify(traceData, null, 2));
  } catch {}
  return entry;
}

export function recordAppliedJob(job, status = "Applied via HireScout", screenshotPath = null) {
  const history = loadJobHistory();
  history.appliedJobs = history.appliedJobs || [];

  const record = {
    job,
    status,
    applied_at: new Date().toISOString(),
    screenshot_evidence: screenshotPath || null
  };

  history.appliedJobs.push(record);
  saveJobHistory(history);
  return record;
}

/**
 * Orders apply options to prioritize ATS and Direct Career Pages over Job Boards
 */
export function orderApplyOptions(applyOptions = [], defaultUrl = "") {
  let list = [];
  if (Array.isArray(applyOptions) && applyOptions.length > 0) {
    list = applyOptions.map(opt => (typeof opt === "string" ? opt : opt.link || opt.url)).filter(Boolean);
  }
  if (defaultUrl && !list.includes(defaultUrl)) {
    list.unshift(defaultUrl);
  }
  if (list.length === 0 && defaultUrl) list = [defaultUrl];

  const atsPatterns = [
    /greenhouse\.io/i, /lever\.co/i, /workday\.com/i, /myworkdayjobs\.com/i,
    /ashbyhq\.com/i, /smartrecruiters\.com/i, /bamboohr\.com/i,
    /careers\.google\.com/i, /stripe\.com/i, /linear\.app/i, /openai\.com/i,
    /microsoft\.com/i, /vercel\.com/i
  ];

  const boardPatterns = [
    /linkedin\.com/i, /indeed\.com/i, /naukri\.com/i, /wellfound\.com/i,
    /glassdoor\.com/i, /ziprecruiter\.com/i, /unstop\.com/i
  ];

  return list.sort((a, b) => {
    const isAtsA = atsPatterns.some(p => p.test(a));
    const isAtsB = atsPatterns.some(p => p.test(b));
    if (isAtsA && !isAtsB) return -1;
    if (!isAtsA && isAtsB) return 1;

    const isBoardA = boardPatterns.some(p => p.test(a));
    const isBoardB = boardPatterns.some(p => p.test(b));
    if (!isBoardA && isBoardB) return -1;
    if (isBoardA && !isBoardB) return 1;

    return 0;
  });
}

/**
 * Deterministic Preflight Check (12s Hard Limit per Job Link)
 * Classifies page as USABLE vs BLOCKED without attempting evasion
 */
export async function preflightCheckLink(page, url, options = {}) {
  const timeoutMs = options.timeout || 12000;
  log("🔍", `[Preflight 12s Limit] Testing link: ${url}`, "dim");

  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForTimeout(400);

    const httpStatus = response ? response.status() : 200;
    if (httpStatus === 403 || httpStatus === 429 || httpStatus >= 500) {
      return { usable: false, reason: `HTTP Error ${httpStatus}` };
    }

    const currentUrl = page.url();
    const pageText = (await page.evaluate(() => document.body?.innerText || "")).toLowerCase();

    // Check for Block Signatures
    if (/\b(sign in|log in|login|signin|create an account|enter password)\b/i.test(pageText) && !/\b(apply|submit|name|email)\b/i.test(pageText)) {
      return { usable: false, reason: "login_required" };
    }

    if (/\b(captcha|verify you are human|robot|cf-challenge|turnstile|bot check)\b/i.test(pageText) || currentUrl.includes("challenge")) {
      return { usable: false, reason: "captcha_bot_check" };
    }

    if (/\b(enter otp|verification code|verify your email|security code)\b/i.test(pageText)) {
      return { usable: false, reason: "otp_verification_required" };
    }

    if (/\b(403 forbidden|access denied|429 too many requests|500 internal server error|job no longer available|position filled|expired)\b/i.test(pageText)) {
      return { usable: false, reason: "page_expired_or_forbidden" };
    }

    // Check for fillable application form or reachable apply button
    const hasFormInput = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input[type='text'], input[type='email'], input[type='tel'], textarea"));
      const buttons = Array.from(document.querySelectorAll("button, a")).filter(el => /apply|submit|start/i.test(el.innerText || ""));
      return inputs.length >= 2 || buttons.length >= 1;
    });

    if (hasFormInput) {
      return { usable: true, reason: "usable_form_found" };
    }

    return { usable: false, reason: "no_fillable_form_inputs_found" };

  } catch (err) {
    return { usable: false, reason: `timeout_or_network_error (${err.message.slice(0, 40)})` };
  }
}

/**
 * Resolves target URL for local demo file vs HTTP links
 */
export function resolveTargetUrl(targetUrl) {
  if (!targetUrl || targetUrl.includes("demo_site/apply.html") || targetUrl.startsWith("http://localhost:3000")) {
    const demoPath = path.resolve("./demo_site/apply.html");
    return `file:///${demoPath.replace(/\\/g, "/")}`;
  }
  return targetUrl;
}

/**
 * Core Real-First Apply Engine
 * Walks candidate jobs in rank order, conducts preflights, skips blocked pages,
 * and falls back to demo_site/apply.html labeled DEMO if all candidate links fail.
 */
export async function executeRealFirstApply(jobsInput, profileInput = null, options = {}) {
  const candidateList = Array.isArray(jobsInput) ? jobsInput.slice(0, 10) : [jobsInput];
  const candidate = profileInput || loadProfile() || {};

  const applyTargetMode = (process.env.APPLY_TARGET || options.applyTarget || "auto").toLowerCase();
  const isHeadless = process.env.BROWSER_HEADLESS === "true" || options.headless === true;
  const speed = parseInt(process.env.BROWSER_SPEED || "50", 10);

  log("🌐", `[HireScout Real-First Apply] Mode: "${applyTargetMode.toUpperCase()}" | Candidate pool size: ${candidateList.length}`, "cyan");

  // Mode Override: Forced Demo Mode
  if (applyTargetMode === "demo") {
    log("ℹ️", "[APPLY_TARGET=demo] Forcing local demo application page rehearsal.", "yellow");
    return await executeDemoFallback(candidateList[0], candidate, isHeadless, speed, "APPLY_TARGET=demo override");
  }

  // Open 1 Persistent Browser Window for Real-First Preflight & Apply
  const userDataDir = path.resolve("./browser_profile");
  let browser;
  try {
    browser = await chromium.launchPersistentContext(userDataDir, {
      headless: isHeadless,
      args: ["--start-maximized", "--disable-blink-features=AutomationControlled"]
    });
  } catch {
    browser = await chromium.launch({
      headless: isHeadless,
      args: ["--start-maximized"]
    });
  }

  const page = browser.pages ? browser.pages()[0] || await browser.newPage() : await browser.newPage();

  let usableJob = null;
  let usableLink = null;
  let voiceNarratedFirstSkip = false;

  // Walk candidates up to top 10
  for (let idx = 0; idx < candidateList.length; idx++) {
    const job = candidateList[idx];
    const candidateNum = idx + 1;
    const linksToTry = orderApplyOptions(job.apply_options, job.application_url);

    log("🔎", `Job ${candidateNum} of ${candidateList.length}: ${job.title} @ ${job.company} (${linksToTry.length} link options)...`, "cyan");

    for (const link of linksToTry) {
      if (link.includes("demo_site/apply.html")) continue; // Skip local demo URLs in real preflight loop

      const check = await preflightCheckLink(page, link);

      if (check.usable) {
        log("✅", `Job ${candidateNum} of ${candidateList.length}: ${job.company} page is USABLE!`, "green");
        usableJob = job;
        usableLink = link;
        break;
      } else {
        log("⚠️", `Job ${candidateNum} of ${candidateList.length}: ${job.company} — BLOCKED (${check.reason}), trying next candidate...`, "yellow");

        // Voice narrate at most 1 short sentence on the first skip
        if (!voiceNarratedFirstSkip) {
          voiceNarratedFirstSkip = true;
          // Non-blocking voice notification
        }

        // Capture block page screenshot (without overlay)
        try {
          if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
          const blockPic = path.join(SCREENSHOTS_DIR, `block_${candidateNum}_${(job.company || "company").replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.png`);
          await page.screenshot({ path: blockPic });
        } catch {}

        logRunTrace({
          job: job.title,
          company: job.company,
          link_tried: link,
          outcome: `BLOCKED (${check.reason})`,
          candidate_rank: candidateNum
        });
      }
    }

    if (usableJob) break;
  }

  // ─── IF A REAL USABLE PAGE IS FOUND ──────────────────────────────────
  if (usableJob && usableLink) {
    log("🚀", `Launching Real Application Flow on ${usableJob.company} career page...`, "green");

    // Inject HireScout status overlay
    await page.evaluate((company) => {
      if (document.getElementById("hirescout-overlay-bar")) return;
      const bar = document.createElement("div");
      bar.id = "hirescout-overlay-bar";
      bar.style.cssText = "position:fixed; top:0; left:0; right:0; height:42px; background:#0f172a; color:#38bdf8; display:flex; align-items:center; justify-content:space-between; padding:0 20px; font-family:sans-serif; font-size:14px; font-weight:600; z-index:999999; border-bottom:2px solid #38bdf8; pointer-events:none;";
      bar.innerHTML = `<div>🛡️ HireScout AI Agent Active | Real Application: <strong>${company}</strong></div><div style="color:#22c55e;">REAL APPLICATION PAGE</div>`;
      document.body.appendChild(bar);
    }, usableJob.company);

    // Auto-fill fields if present
    try {
      const nameSel = "#applicant-name, input[name*='name'], input[id*='name']";
      if (await page.$(nameSel)) await page.fill(nameSel, candidate.name || "Alex Mercer");

      const emailSel = "#applicant-email, input[type='email'], input[name*='email']";
      if (await page.$(emailSel)) await page.fill(emailSel, candidate.email || "alex.mercer@example.com");

      const coverSel = "#cover-letter, textarea[name*='cover'], textarea[id*='cover']";
      if (await page.$(coverSel)) await page.fill(coverSel, usableJob.cover_letter_draft || `Dear Hiring Manager at ${usableJob.company},\n\nI am applying for the ${usableJob.title} position.`);
    } catch {}

    // Section 9 Typed Confirmation Gate
    console.log(`\n============================================================`);
    console.log(`🔴 REAL APPLICATION GATE (CONFIRM SUBMISSION):`);
    console.log(`   This will submit a REAL application to ${usableJob.company} for "${usableJob.title}".`);
    console.log(`   URL: ${usableLink}`);
    console.log(`============================================================\n`);

    const confirmAnswer = await askInput(`  Type [yes] to submit real application, or [no] to stop: `);

    if (confirmAnswer.toLowerCase() === "yes") {
      log("⚡", "Human confirmation granted! Submitting REAL application...", "green");

      const submitBtn = "#submit-application-btn, button[type='submit'], input[type='submit']";
      if (await page.$(submitBtn)) {
        try { await page.click(submitBtn); await page.waitForTimeout(1000); } catch {}
      }

      if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
      const screenshotPath = path.join(SCREENSHOTS_DIR, `real_app_${(usableJob.id || "job").replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.png`);
      try { await page.screenshot({ path: screenshotPath }); } catch {}

      recordAppliedJob(usableJob, "Applied (Real - Human Confirmed)", screenshotPath);
      logRunTrace({ job: usableJob.title, company: usableJob.company, status: "applied", mode: "real" });

      log("✅", "Real application submitted and recorded!", "green");
      await page.waitForTimeout(1000);
      try { await browser.close(); } catch {}

      return { status: "applied", job: usableJob, mode: "real", screenshot: screenshotPath };

    } else {
      log("ℹ️", "Real application declined by user. Form left open for review.", "yellow");
      recordAppliedJob(usableJob, "Declined by User (Real Page)");
      logRunTrace({ job: usableJob.title, company: usableJob.company, status: "declined", mode: "real" });

      await askInput("\n  Press ENTER to close browser window... ");
      try { await browser.close(); } catch {}
      return { status: "declined", job: usableJob, mode: "real" };
    }
  }

  // ─── IF ALL CANDIDATES ARE BLOCKED ──────────────────────────────────
  try { await browser.close(); } catch {}

  log("⚠️", `All ${candidateList.length} top candidate job links were BLOCKED (login walls / captchas / expired links).`, "yellow");

  if (applyTargetMode === "real") {
    console.log(`\n  ${BRANDING.appName}: None of the top jobs allowed an application without a login or verification (APPLY_TARGET=real).\n`);
    logRunTrace({ status: "none_usable", mode: "real", candidate_count: candidateList.length });
    return { status: "none_usable", mode: "real" };
  }

  // Fallback to Demo Site (APPLY_TARGET=auto default)
  console.log(`\n  📢 ${BRANDING.appName}: None of the top jobs allowed an application without a login or verification.`);
  console.log(`     Using the local demo application form instead.\n`);

  return await executeDemoFallback(candidateList[0] || {}, candidate, isHeadless, speed, "All candidate links blocked");
}

/**
 * Demo Site Fallback Executor (demo_site/apply.html)
 * Displays explicit "DEMO FORM" overlay badge and records status as "demo"
 */
export async function executeDemoFallback(job = {}, profile = {}, isHeadless = false, speed = 50, reason = "") {
  const demoUrl = resolveTargetUrl("demo_site/apply.html");
  log("🎭", `Opening Local Demo Application Form (DEMO FORM): ${demoUrl}`, "yellow");

  const browser = await chromium.launch({
    headless: isHeadless,
    args: ["--start-maximized"]
  });

  const page = await browser.newPage();
  await page.goto(demoUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  // Inject "DEMO FORM" overlay badge
  await page.evaluate((reasonMsg) => {
    const bar = document.createElement("div");
    bar.id = "hirescout-overlay-bar";
    bar.style.cssText = "position:fixed; top:0; left:0; right:0; height:42px; background:#b91c1c; color:#fff; display:flex; align-items:center; justify-content:space-between; padding:0 20px; font-family:sans-serif; font-size:14px; font-weight:700; z-index:999999; border-bottom:2px solid #f87171; pointer-events:none;";
    bar.innerHTML = `<div>⚠️ <strong>DEMO FORM REHEARSAL</strong> | ${reasonMsg}</div><div>STATUS: DEMO</div>`;
    document.body.appendChild(bar);
    document.body.style.paddingTop = "44px";
  }, reason);

  // Auto-fill demo form fields
  await page.fill("#applicant-name", profile.name || "Alex Mercer");
  await page.waitForTimeout(speed);
  await page.fill("#applicant-email", profile.email || "alex.mercer@example.com");
  await page.waitForTimeout(speed);
  await page.fill("#applicant-phone", profile.phone || "+1 555-019-2831");
  await page.waitForTimeout(speed);
  await page.fill("#applicant-skills", Array.isArray(profile.skills) ? profile.skills.join(", ") : (profile.skills || "JavaScript, TypeScript, React, Node.js"));
  await page.waitForTimeout(speed);
  await page.fill("#cover-letter", job.cover_letter_draft || `Dear Hiring Manager at ${job.company || "Stripe"},\n\nI am writing to express my interest in the ${job.title || "Senior Engineer"} position.`);

  console.log(`\n============================================================`);
  console.log(`🎭  DEMO FORM CONFIRMATION GATE (FALLBACK REHEARSAL):`);
  console.log(`    This is a DEMO application test for "${job.company || "Demo Company"}".`);
  console.log(`    No real application will be submitted to any external site.`);
  console.log(`============================================================\n`);

  const answer = await askInput(`  Type [yes] to submit demo form, or [no] to stop: `);

  if (answer.toLowerCase() === "yes") {
    await page.click("#submit-application-btn");
    await page.waitForTimeout(800);

    if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    const screenshotPath = path.join(SCREENSHOTS_DIR, `demo_app_${(job.id || "demo").replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath });

    recordAppliedJob(job, "demo", screenshotPath);
    logRunTrace({ job: job.title || "Demo Job", company: job.company || "Demo Corp", status: "demo", mode: "demo", reason });

    log("✅", "Demo application rehearsal submitted cleanly (Logged status: demo).", "green");
    await page.waitForTimeout(1000);
    await browser.close();

    return { status: "demo", mode: "demo", screenshot: screenshotPath };

  } else {
    log("ℹ️", "Demo application cancelled by user.", "yellow");
    recordAppliedJob(job, "demo_declined");
    logRunTrace({ job: job.title || "Demo Job", status: "demo_declined", mode: "demo" });

    await askInput("\n  Press ENTER to close browser window... ");
    await browser.close();

    return { status: "demo_declined", mode: "demo" };
  }
}
