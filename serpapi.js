// ─────────────────────────────────────────────────────────────────────
// serpapi.js — SerpApi Live Job Search & Schema Normalization Engine
// Powers HireScout with live Google Jobs & web search queries via SerpApi
// Features: Google Jobs engine, site-specific search, 17-field normalization,
// 30-minute caching, skill extraction, and mock fallback mode.
// ─────────────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { log } from "./utils.js";

const CACHE_DIR = path.resolve("./.kairo_temp");
const CACHE_FILE = path.join(CACHE_DIR, "serpapi_cache.json");
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Common tech skills for keyword extraction from job descriptions
const SKILL_KEYWORDS = [
  "JavaScript", "TypeScript", "Node.js", "React", "Vue", "Angular", "Python",
  "Java", "C++", "C#", "Go", "Rust", "SQL", "PostgreSQL", "MongoDB", "Redis",
  "AWS", "GCP", "Azure", "Docker", "Kubernetes", "GraphQL", "REST API",
  "Tailwind", "Next.js", "Express", "FastAPI", "Django", "Spring Boot",
  "Git", "CI/CD", "Linux", "System Design", "Microservices", "Playwright",
  "Puppeteer", "Selenium", "Machine Learning", "AI", "LLM", "PowerShell"
];

/**
 * Extracts list of matching skills from job description text
 * @param {string} text 
 * @returns {string[]}
 */
export function extractSkillsFromText(text = "") {
  if (!text) return ["Software Development"];
  const lowerText = text.toLowerCase();
  const matched = SKILL_KEYWORDS.filter(skill => {
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
    return regex.test(lowerText);
  });
  return matched.length > 0 ? matched : ["Software Engineering", "Problem Solving"];
}

/**
 * Infer experience level from title and description
 * @param {string} title 
 * @param {string} description 
 * @returns {string}
 */
export function inferExperienceLevel(title = "", description = "") {
  const combined = `${title} ${description}`.toLowerCase();
  if (/\b(sr|senior|lead|principal|architect|staff)\b/.test(combined)) return "Senior (5+ yrs)";
  if (/\b(junior|jr|intern|associate|fresher|entry)\b/.test(combined)) return "Entry / Junior (0-2 yrs)";
  if (/\b(mid|intermediate)\b/.test(combined)) return "Mid-Level (2-5 yrs)";
  return "Mid-Senior (3-5 yrs)";
}

/**
 * Normalizes a raw SerpApi Google Jobs item into the 17-field HireScout Schema
 * @param {Object} rawJob 
 * @param {number} index 
 * @returns {Object} 17-field job object
 */
export function normalizeSerpApiJob(rawJob = {}, index = 0) {
  const title = rawJob.title || "Software Engineer";
  const company = rawJob.company_name || "Tech Company";
  const location = rawJob.location || "Remote / Hybrid";
  const source = rawJob.via || "Google Jobs (SerpApi)";
  const description = rawJob.description || `${title} at ${company}. Great opportunity for software engineers.`;

  // Apply options extraction
  let applyUrl = "https://careers.google.com";
  let applyType = "External Form";
  if (Array.isArray(rawJob.apply_options) && rawJob.apply_options.length > 0) {
    applyUrl = rawJob.apply_options[0].link || applyUrl;
    applyType = rawJob.apply_options[0].is_direct ? "Direct Apply" : "External Form";
  } else if (rawJob.share_link) {
    applyUrl = rawJob.share_link;
  } else if (rawJob.link) {
    applyUrl = rawJob.link;
  }

  // Extensions / metadata extraction
  const extensions = rawJob.detected_extensions || {};
  const postedDate = extensions.posted_at || (Array.isArray(rawJob.extensions) ? rawJob.extensions[0] : null) || "Recently posted";
  const salaryRange = extensions.salary || rawJob.salary || "Competitive Market Rate";
  const jobType = extensions.schedule_type || (rawJob.extensions?.find(e => /full-time|part-time|contract/i.test(e))) || "Full-time";

  const extractedSkills = extractSkillsFromText(description);
  const expLevel = inferExperienceLevel(title, description);
  const jobId = rawJob.job_id || `serpapi-job-${crypto.createHash("md5").update(`${title}-${company}-${index}`).digest("hex").slice(0, 12)}`;

  return {
    id: jobId,
    title: title,
    company: company,
    location: location,
    source: source,
    posted_date: postedDate,
    application_url: applyUrl,
    apply_type: applyType,
    salary_range: salaryRange,
    job_type: jobType,
    experience_level: expLevel,
    required_skills: extractedSkills,
    role_summary: description.length > 220 ? `${description.slice(0, 217)}...` : description,
    full_description: description,
    match_score: 0,
    why_suitable: "",
    cover_letter_draft: ""
  };
}

/**
 * Cache Helper
 */
function getCacheKey(engine, query, location) {
  return crypto.createHash("md5").update(`${engine}:${query}:${location}`.toLowerCase()).digest("hex");
}

function loadCache() {
  if (!fs.existsSync(CACHE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (err) {
    // Non-fatal cache save failure
  }
}

/**
 * Realistic Mock Job Generator when SERPAPI_KEY is not set or network fails
 */
export function getMockSerpApiJobs(targetRole = "Software Engineer", targetLocation = "Remote") {
  log("ℹ️", `[SerpApi] Using realistic mock job pool for "${targetRole}" in "${targetLocation}".`, "dim");
  return [
    {
      id: "serpapi-mock-stripe-sr-fullstack",
      title: `Senior Full-Stack Engineer (${targetRole})`,
      company: "Stripe",
      location: targetLocation.includes("Remote") ? "Remote (US/Global)" : targetLocation,
      source: "via LinkedIn (SerpApi)",
      posted_date: "1 day ago",
      application_url: "http://localhost:3000/demo_site/apply.html",
      apply_type: "Direct Apply",
      salary_range: "$160,000 - $210,000 USD",
      job_type: "Full-time",
      experience_level: "Senior (5+ yrs)",
      required_skills: ["TypeScript", "Node.js", "React", "PostgreSQL", "System Design"],
      role_summary: "Build core payment infrastructure and high-throughput APIs processing billions daily.",
      full_description: "Stripe is building financial infrastructure for the internet. As a Senior Full-Stack Engineer, you will design scalable web applications, React interfaces, and Node.js APIs to empower internet commerce worldwide.",
      match_score: 95,
      why_suitable: "Perfect match: Candidate has 5+ years TypeScript & Node.js skills matching Stripe's payment stack.",
      cover_letter_draft: ""
    },
    {
      id: "serpapi-mock-google-staff-ai",
      title: `AI Agent Systems Engineer — ${targetRole}`,
      company: "Google",
      location: targetLocation,
      source: "via Google Careers (SerpApi)",
      posted_date: "2 days ago",
      application_url: "http://localhost:3000/demo_site/apply.html",
      apply_type: "Direct Apply",
      salary_range: "$180,000 - $240,000 USD",
      job_type: "Full-time",
      experience_level: "Senior (5+ yrs)",
      required_skills: ["Python", "C++", "LLM", "TypeScript", "Node.js", "Architecture"],
      role_summary: "Lead multi-agent orchestration frameworks for Gemini ecosystem applications.",
      full_description: "Google DeepMind team is seeking a Lead Systems Engineer to pioneer autonomous AI agent infrastructure, structured workflow engines, and low-latency API tools.",
      match_score: 92,
      why_suitable: "Strong alignment: Experience building autonomous AI agents with low-latency LLM tools.",
      cover_letter_draft: ""
    },
    {
      id: "serpapi-mock-linear-product-dev",
      title: `Frontend & Systems Engineer (${targetRole})`,
      company: "Linear",
      location: "Remote",
      source: "via Wellfound (SerpApi)",
      posted_date: "3 days ago",
      application_url: "http://localhost:3000/demo_site/apply.html",
      apply_type: "External Form",
      salary_range: "$140,000 - $185,000 USD",
      job_type: "Full-time",
      experience_level: "Mid-Senior (3-5 yrs)",
      required_skills: ["React", "TypeScript", "GraphQL", "WebSockets", "UI/UX"],
      role_summary: "Craft high-performance, keyboard-first issue tracking software.",
      full_description: "Linear builds tools for software teams. We value craftsmanship, sub-100ms interaction speed, and clean code architecture. Join our distributed global engineering group.",
      match_score: 89,
      why_suitable: "Great UI/UX fit: Specialized in React, sub-100ms performance optimization, and responsive design.",
      cover_letter_draft: ""
    },
    {
      id: "serpapi-mock-unstop-naukri-dev",
      title: `Full Stack Developer — Node.js & React`,
      company: "Zephyr Labs (Unstop)",
      location: "Bengaluru, India (Hybrid)",
      source: "via Unstop / Naukri (SerpApi)",
      posted_date: "Just now",
      application_url: "http://localhost:3000/demo_site/apply.html",
      apply_type: "Direct Apply",
      salary_range: "₹18,000,000 - ₹28,000,000 INR",
      job_type: "Full-time",
      experience_level: "Mid-Level (2-5 yrs)",
      required_skills: ["JavaScript", "Node.js", "React", "MongoDB", "Express", "Docker"],
      role_summary: "Build scalable microservices and real-time dashboards for hackathon & job portals.",
      full_description: "Zephyr Labs is hiring a Full Stack Developer to build agentic workflow automation software, API integrations, and developer portals. Great fit for Node.js and SerpApi engineers.",
      match_score: 87,
      why_suitable: "High match score: Direct experience with SerpApi integrations and Node.js microservices.",
      cover_letter_draft: ""
    },
    {
      id: "serpapi-mock-vercel-edge-eng",
      title: `Edge Infrastructure Engineer (${targetRole})`,
      company: "Vercel",
      location: "Remote (Global)",
      source: "via Glassdoor (SerpApi)",
      posted_date: "1 day ago",
      application_url: "http://localhost:3000/demo_site/apply.html",
      apply_type: "Direct Apply",
      salary_range: "$150,000 - $195,000 USD",
      job_type: "Full-time",
      experience_level: "Mid-Senior (3-5 yrs)",
      required_skills: ["Next.js", "TypeScript", "Node.js", "Serverless", "Edge Functions"],
      role_summary: "Accelerate global web deployment pipelines and serverless runtime performance.",
      full_description: "Vercel powers the modern web. We are looking for an Edge Infrastructure Engineer to build zero-latency routing mechanisms and resilient developer toolchains.",
      match_score: 86,
      why_suitable: "Solid skills fit: Next.js & serverless architecture experience.",
      cover_letter_draft: ""
    },
    {
      id: "serpapi-mock-msft-cloud-dev",
      title: `Senior Cloud Solutions Engineer — ${targetRole}`,
      company: "Microsoft",
      location: "Redmond, WA / Remote",
      source: "via Microsoft Careers (SerpApi)",
      posted_date: "4 days ago",
      application_url: "http://localhost:3000/demo_site/apply.html",
      apply_type: "Direct Apply",
      salary_range: "$165,000 - $215,000 USD",
      job_type: "Full-time",
      experience_level: "Senior (5+ yrs)",
      required_skills: ["Azure", "C#", "TypeScript", "Docker", "Kubernetes"],
      role_summary: "Scale enterprise cloud services and developer tooling across Azure.",
      full_description: "Microsoft Azure Engineering team is seeking a Senior Cloud Engineer to build resilient distributed services, continuous delivery systems, and automated test runners.",
      match_score: 85,
      why_suitable: "Enterprise fit: Strong background in containerized services and automated testing.",
      cover_letter_draft: ""
    },
    {
      id: "serpapi-mock-amazon-aws-builder",
      title: `Software Development Engineer II (${targetRole})`,
      company: "Amazon AWS",
      location: "Seattle, WA / Hybrid",
      source: "via Amazon Jobs (SerpApi)",
      posted_date: "2 days ago",
      application_url: "http://localhost:3000/demo_site/apply.html",
      apply_type: "External Form",
      salary_range: "$155,000 - $205,000 USD",
      job_type: "Full-time",
      experience_level: "Mid-Senior (3-5 yrs)",
      required_skills: ["Java", "AWS", "DynamoDB", "Python", "System Design"],
      role_summary: "Build high-throughput AWS serverless APIs and developer platforms.",
      full_description: "AWS Cloud Control Services team builds scalable developer tools powering millions of applications worldwide. Join us to design tier-1 AWS cloud infrastructure.",
      match_score: 84,
      why_suitable: "Cloud infrastructure match: Experience with AWS services and distributed systems.",
      cover_letter_draft: ""
    },
    {
      id: "serpapi-mock-openai-agent-dev",
      title: `AI Platform & Tooling Engineer`,
      company: "OpenAI",
      location: "San Francisco, CA / Remote",
      source: "via OpenAI Careers (SerpApi)",
      posted_date: "Today",
      application_url: "http://localhost:3000/demo_site/apply.html",
      apply_type: "Direct Apply",
      salary_range: "$200,000 - $310,000 USD",
      job_type: "Full-time",
      experience_level: "Senior (5+ yrs)",
      required_skills: ["Python", "TypeScript", "LLM", "Evaluation", "API Design"],
      role_summary: "Build reliable tool-use execution environments for ChatGPT & Codex models.",
      full_description: "OpenAI Applied Team is looking for platform engineers to design sandboxed code execution tools, dynamic API invocation frameworks, and agent evaluation suites.",
      match_score: 96,
      why_suitable: "Top match score: Specialist in agentic workflow engines, tool calling, and automated execution.",
      cover_letter_draft: ""
    },
    {
      id: "serpapi-mock-meta-ui-infra",
      title: `Product Systems Engineer (${targetRole})`,
      company: "Meta",
      location: "Menlo Park, CA / Remote",
      source: "via Meta Careers (SerpApi)",
      posted_date: "3 days ago",
      application_url: "http://localhost:3000/demo_site/apply.html",
      apply_type: "Direct Apply",
      salary_range: "$170,000 - $230,000 USD",
      job_type: "Full-time",
      experience_level: "Senior (5+ yrs)",
      required_skills: ["React", "GraphQL", "Flow/TypeScript", "Relay", "Performance"],
      role_summary: "Engineers for core React web infrastructure and multi-platform apps.",
      full_description: "Meta Web Infrastructure group builds state-of-the-art web frameworks used by 3B+ users. Looking for engineers with deep expertise in React internals, GraphQL data fetching, and sub-second rendering.",
      match_score: 88,
      why_suitable: "React ecosystem match: Deep technical understanding of client-side web applications.",
      cover_letter_draft: ""
    },
    {
      id: "serpapi-mock-netflix-playback-dev",
      title: `Senior Platform Systems Engineer — ${targetRole}`,
      company: "Netflix",
      location: "Los Gatos, CA / Remote",
      source: "via Netflix Jobs (SerpApi)",
      posted_date: "5 days ago",
      application_url: "http://localhost:3000/demo_site/apply.html",
      apply_type: "Direct Apply",
      salary_range: "$190,000 - $260,000 USD",
      job_type: "Full-time",
      experience_level: "Senior (5+ yrs)",
      required_skills: ["Node.js", "Java", "Microservices", "Telemetry", "Resilience"],
      role_summary: "Build resilient streaming API gateways and real-time observability services.",
      full_description: "Netflix Edge & API Gateway team handles hundreds of billions of API calls daily. We seek Senior Platform Engineers passionate about microservices architecture and zero-downtime deployments.",
      match_score: 90,
      why_suitable: "High scale fit: Experience designing fault-tolerant Node.js & microservices architectures.",
      cover_letter_draft: ""
    }
  ];
}

/**
 * Core SerpApi Fetcher with Caching and Mock Fallback
 * @param {string} targetRole 
 * @param {string} targetLocation 
 * @param {Object} options 
 * @returns {Promise<Object[]>} Array of 17-field normalized job objects
 */
export async function searchSerpApiJobs(targetRole = "Software Engineer", targetLocation = "Remote", options = {}) {
  const apiKey = process.env.SERPAPI_KEY;
  const useCache = options.useCache !== false && process.env.SERPAPI_CACHE !== "false";

  // Check key availability
  if (!apiKey || apiKey.trim() === "" || apiKey === "your_serpapi_api_key_here") {
    log("⚠️", "[SerpApi] SERPAPI_KEY not configured in .env — using mock SerpApi jobs pool.", "yellow");
    return getMockSerpApiJobs(targetRole, targetLocation);
  }

  const query = `${targetRole} ${targetLocation}`.trim();
  const cacheKey = getCacheKey("google_jobs", query, targetLocation);

  // Check 30-min Cache
  if (useCache) {
    const cache = loadCache();
    const cachedEntry = cache[cacheKey];
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL_MS)) {
      log("⚡", `[SerpApi Cache Hit] Using cached jobs for "${query}" (${cachedEntry.jobs.length} jobs)`, "green");
      return cachedEntry.jobs;
    }
  }

  log("🌐", `[SerpApi API Call] Fetching live Google Jobs via SerpApi for "${query}"...`, "cyan");

  try {
    const params = new URLSearchParams({
      engine: "google_jobs",
      q: query,
      hl: "en",
      api_key: apiKey
    });

    // Add country parameter if location suggests it
    if (/india|delhi|bengaluru|bangalore|mumbai|pune/i.test(targetLocation)) {
      params.append("gl", "in");
    } else {
      params.append("gl", "us");
    }

    const apiUrl = `https://serpapi.com/search.json?${params.toString()}`;
    
    // Set 8-second timeout for SerpApi call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      log("⚠️", `[SerpApi] HTTP Error ${response.status} ${response.statusText}`, "red");
      return getMockSerpApiJobs(targetRole, targetLocation);
    }

    const data = await response.json();

    if (data.error) {
      log("⚠️", `[SerpApi Error] ${data.error}`, "red");
      return getMockSerpApiJobs(targetRole, targetLocation);
    }

    const rawJobs = data.jobs_results || [];
    log("✅", `[SerpApi] Received ${rawJobs.length} live jobs from Google Jobs engine.`, "green");

    if (rawJobs.length === 0) {
      log("ℹ️", "[SerpApi] 0 jobs returned by Google Jobs — trying Web Search fallback...", "yellow");
      return await searchSerpApiWebFallback(targetRole, targetLocation, apiKey);
    }

    const normalizedJobs = rawJobs.map((rj, idx) => normalizeSerpApiJob(rj, idx));

    // Save to Cache
    if (useCache) {
      const cache = loadCache();
      cache[cacheKey] = {
        timestamp: Date.now(),
        query: query,
        jobs: normalizedJobs
      };
      saveCache(cache);
    }

    return normalizedJobs;

  } catch (err) {
    log("⚠️", `[SerpApi Exception] ${err.message || err} — falling back to mock jobs.`, "yellow");
    return getMockSerpApiJobs(targetRole, targetLocation);
  }
}

/**
 * SerpApi Google Web Search fallback when Google Jobs returns 0 items
 */
async function searchSerpApiWebFallback(targetRole, targetLocation, apiKey) {
  try {
    const webQuery = `site:unstop.com/jobs OR site:naukri.com OR site:linkedin.com/jobs "${targetRole}" "${targetLocation}"`;
    const params = new URLSearchParams({
      engine: "google",
      q: webQuery,
      hl: "en",
      gl: "us",
      api_key: apiKey
    });

    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
    if (!response.ok) return getMockSerpApiJobs(targetRole, targetLocation);

    const data = await response.json();
    const organic = data.organic_results || [];

    if (organic.length === 0) return getMockSerpApiJobs(targetRole, targetLocation);

    const webJobs = organic.slice(0, 5).map((item, idx) => ({
      id: `serpapi-web-${idx}-${Date.now()}`,
      title: item.title ? item.title.replace(/\|.*/, "").trim() : `${targetRole}`,
      company: item.displayed_link ? item.displayed_link.split("/")[0] : "Web Job Portal",
      location: targetLocation,
      source: `via Web Search (${item.displayed_link || "SerpApi"})`,
      posted_date: item.snippet?.slice(0, 30) || "Recently",
      application_url: item.link || "http://localhost:3000/demo_site/apply.html",
      apply_type: "External Form",
      salary_range: "Market Standard",
      job_type: "Full-time",
      experience_level: inferExperienceLevel(item.title, item.snippet),
      required_skills: extractSkillsFromText(item.snippet),
      role_summary: item.snippet || `${targetRole} opportunity at ${item.displayed_link}`,
      full_description: item.snippet || item.title,
      match_score: 0,
      why_suitable: "",
      cover_letter_draft: ""
    }));

    log("✅", `[SerpApi Web Fallback] Extracted ${webJobs.length} jobs from SerpApi organic results.`, "green");
    return webJobs;
  } catch {
    return getMockSerpApiJobs(targetRole, targetLocation);
  }
}
