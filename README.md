# 💼 HireScout — Autonomous AI Job Discovery & Application Agent

> **SerpApi India Hackathon 2026 Submission**  
> **Track 1:** AI Agents (Search, Compare & Act)  
> **Team Name:** Binary  
> **License:** MIT  

---

## 🎬 Live Product Video Demonstration

<div align="center">
  <iframe width="100%" height="450" src="https://www.youtube.com/embed/Fde3cAimGYY" title="HireScout Live Demo — SerpApi India Hackathon 2026" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
</div>

<div align="center">
  <a href="https://www.youtube.com/watch?v=Fde3cAimGYY" target="_blank">
    <img src="https://img.youtube.com/vi/Fde3cAimGYY/maxresdefault.jpg" alt="Click to Play HireScout Video Demo on YouTube" width="100%" style="border-radius: 12px; border: 2px solid #38bdf8;" />
  </a>
  <p>▶️ <strong><a href="https://www.youtube.com/watch?v=Fde3cAimGYY" target="_blank">Click Here to Play Full Demo Video on YouTube (https://youtu.be/Fde3cAimGYY)</a></strong></p>
</div>

> ⚡ *Features live SerpApi Google Jobs query, 7-Signal deterministic match scoring, side-by-side terminal matrix comparison, simultaneous 10-tab parallel Playwright auto-apply, and Section 9 human confirmation gate.*

---


## 🚨 1. Problem Statement (PS)

Modern technical job hunting is fragmented, time-consuming, and inefficient:
- **Search Fragmentation**: Candidates waste hours manually toggling across 10+ portals (LinkedIn, Google Jobs, Naukri, Unstop, Glassdoor, Greenhouse, Lever).
- **Keyword Blindness & Low Accuracy**: Portal search algorithms rely on simplistic title keywords, flooding candidates with irrelevant roles that do not match their true tech stack, experience level, or salary requirements.
- **Comparison Friction**: Evaluating trade-offs between two job opportunities (compensation, tech stack, remote policy, growth) requires manual spreadsheet comparisons and guesswork.
- **Application Fatigue & Form Failures**: Traditional auto-fill browser extensions crash on dynamic Single Page Applications (SPAs), struggle with custom ATS forms, solve captchas unsafely, get trapped in login loops, or submit applications without candidate approval.

---

## 💡 2. The Solution

**HireScout** is an autonomous AI agent built in Node.js that unifies job discovery, factual candidate-job matching, side-by-side matrix comparison, and visual Playwright auto-fill applications into a single-command autonomous workflow.

Powered by **SerpApi's Google Jobs engine**, HireScout fetches live job listings, normalizes them into a unified **17-Field Schema**, ranks them deterministically with a **7-Signal Scoring Matrix**, offers 1-click side-by-side job comparisons, features **Simultaneous 10-Tab Parallel Auto-Apply**, and executes visual Playwright form preflights with hard-gated human confirmation.

---

## 🌐 3. How SerpApi Solved the Core Problem & How It Was Used

### The Problem SerpApi Solves
Traditional web scraping for jobs breaks constantly due to anti-bot protections, shifting HTML DOM structures, and fragmented portal formats.

### How SerpApi is Leveraged in HireScout (`serpapi.js`)
1. **Live Google Jobs Engine (`engine=google_jobs`)**: Queries SerpApi's Google Jobs API in real time across global & regional locations (`gl=us`, `gl=in`).
2. **Organic Web Search Fallback (`engine=google`)**: If Google Jobs returns 0 results for hyper-niche role queries, HireScout automatically cascades to SerpApi web search targeted at `site:unstop.com`, `site:naukri.com`, and `site:linkedin.com/jobs`.
3. **17-Field Schema Normalization**: Normalizes raw SerpApi responses into a 100% predictable 17-field HireScout Schema (`id`, `title`, `company`, `location`, `source`, `posted_date`, `application_url`, `apply_type`, `salary_range`, `job_type`, `experience_level`, `required_skills`, `role_summary`, `full_description`, `match_score`, `why_suitable`, `cover_letter_draft`).
4. **Intelligent 30-Minute Caching**: Saves search queries locally in `.kairo_temp/serpapi_cache.json` with MD5 query hashing to prevent redundant API calls and optimize API credits.
5. **Zero-Break Mock Fallback**: If `SERPAPI_KEY` is absent or network fails, HireScout seamlessly uses a realistic 10-company mock pool so demos and testing never break.

---

## 🔄 4. System Architecture & Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            User Command / Voice                             │
│                         "Find Senior Node.js Jobs"                          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    🌐 SerpApi Core Live Search Engine                        │
│               (Google Jobs API + Organic Web Fallback)                      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ (17-Field Schema Normalization)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 🧠 Deterministic 7-Signal Weighted Scorer                   │
│          (Skills 30pt | Title 20pt | Salary 15pt | Freshness 10pt ...)      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
│ 📊 Side-by-Side │           │ ⚡ Simultaneous  │           │ 🚀 Real-First   │
│   Matrix Match  │           │ 10-Tab Apply [B]│           │ Playwright Apply│
└─────────────────┘           └────────┬────────┘           └────────┬────────┘
                                       │                             │
                                       └──────────────┬──────────────┘
                                                      │
                                                      ▼
                                       ┌─────────────────────────────┐
                                       │   🛡️ On-Screen Visual Bar   │
                                       │  (Status Overlay Injection) │
                                       └──────────────┬──────────────┘
                                                      │
                                                      ▼
                                       ┌─────────────────────────────┐
                                       │ 🔒 Section 9 Human Gate     │
                                       │  ("Type yes to submit")     │
                                       └─────────────────────────────┘
```

---

## ✨ 5. Key Features

### 🌐 1. Live SerpApi Job Search (`serpapi.js`)
- Real-time Google Jobs integration powered by SerpApi REST endpoints.
- Automated web fallback for platform-specific listings (Unstop, Naukri, LinkedIn).
- Automatic tech skill keyword extraction & experience level inference.

### 🧠 2. Deterministic 7-Signal Weighted Scorer (`scorer.js`)
Evaluates candidate jobs in **<1ms** with zero network latency and 0% randomness:
1. **Skills Match (30 pts max)**: Jaccard overlap between candidate profile skills and job requirements.
2. **Title Relevance (20 pts max)**: Token match ratio for target role.
3. **Salary Alignment (15 pts max)**: Parsed compensation band vs target.
4. **Deadline Urgency (10 pts max)**: Application closing date recency.
5. **Company Rating (10 pts max)**: 1–5 star rating mapped to score scale.
6. **Posting Freshness (10 pts max)**: Recency scoring ("today", "1 day ago", "3 days ago").
7. **Apply Competition (5 pts max)**: Direct Apply bonus and position count.

### 📊 3. Side-by-Side Job Comparison Matrix (`compareJobs`)
Renders a side-by-side terminal matrix comparing any 2 job opportunities across all 7 signals, producing an AI-backed winner recommendation with 1-click apply triggers.

### ⚡ 4. Simultaneous 10-Tab Parallel Auto-Apply Engine (`Option B`)
- **Multi-Tab Parallel Execution**: Opens **10 visible browser tabs simultaneously** across top candidate companies (*Stripe, Google, Linear, Zephyr Labs, Vercel, Microsoft, Amazon, OpenAI, Meta, Netflix*).
- **On-Screen High-Tech Banner**: Injects live status overlay banners (`🛡️ HireScout AI Agent | Multi-Tab Batch Apply (Tab 1/10): Stripe`) on every tab.
- **Sequential Tab Auto-Fill**: Switches focus across open tabs, auto-filling candidate details, contact info, tech skills, and tailored cover letters in real time.
- **Batch Confirmation Gate**: Asks for Section 9 human approval (`Type yes to submit ALL 10 applications`) before executing simultaneous batch submission.

### 🔐 5. Interactive Login Wall Skip & Domain Memory (`index.js`)
- When encountering a login-walled site, HireScout offers interactive choices:
  `[1] Log in manually in browser & press ENTER` | `[2] Skip this website & try next job`
- **Domain Session Tracking (`loggedInDomains`)**: Remembers authenticated domains per session so users are never trapped in repetitive login loops.

### 🚀 6. Real-First Playwright Apply Flow & Safety Gate (`apply.js`)
- Prioritizes direct company ATS portals (`Greenhouse`, `Lever`, `Workday`, `Ashby`, `SmartRecruiters`).
- **12-Second Hard Preflight Limit**: Assesses link usability without attempting unsafe captcha solving.
- **Section 9 Typed Gate**: Hard-gates final submission behind explicit human confirmation:
  `"This will submit a REAL application to <company> for <role>. Type yes to submit, or no to stop."`
- **Demo Site Fallback**: If all top candidate links require logins or captchas, HireScout falls back to `demo_site/apply.html` clearly labeled with a **"DEMO FORM"** overlay badge.

### 🔀 7. Multi-Tier LLM Waterfall & Optional OmniRoute Gateway (`llm_omniroute.js`, `utils.js`)
- **Tier 0 (Optional)**: OmniRoute local LLM gateway (`http://localhost:20128/v1`) — off by default (`OMNIROUTE_ENABLED=false`).
- **Tier 1**: Groq sub-300ms ultra-fast inference (`llama-3.3-70b-versatile`).
- **Tier 2**: Google Gemini API key rotation (`gemini-2.5-flash`, `gemini-1.5-flash`).
- **Tier 3**: OpenRouter fallback models.

### 🎙️ 8. Windows Voice Layer (`voice.js`, `tts.js`)
Continuous background listener for wake phrase **"Hey Scout"** or **3x Rapid Spacebar** with SAPI speech synthesis.

---

## 🌟 6. Innovation & Uniqueness

1. **Simultaneous 10-Tab Auto-Apply Engine**: Opens and auto-fills 10 separate company job applications in 10 visible browser tabs in parallel.
2. **Real-First Playwright Auto-Fill with Safety Gate**: Unlike dangerous form-spammers, HireScout checks real company career sites first and strictly gates submission behind explicit human confirmation.
3. **Deterministic 0–100 Matching**: Uses mathematical Jaccard skill overlaps, token relevance, and parsed salary bands rather than hallucination-prone LLM scoring.
4. **Interactive Login Bailing & Domain Memory**: Prevents browser navigation traps by offering instant site skipping and tracking authenticated domain sessions.
5. **JARVIS-Style Windows Voice Persona**: Integrated hands-free SAPI voice synthesis with continuous wake-word listening ("Hey Scout") and 3x Spacebar shortcut.
6. **Local Demo Rehearsal Site (`demo_site/apply.html`)**: Provides a sandbox environment for testing auto-fill and visual scanning without touching live corporate databases.

---

## ⚡ 7. Latency, Performance & Scalability

- **<1ms Deterministic Scoring**: The 7-Signal scoring algorithm evaluates and ranks candidate jobs in under 1 millisecond with zero API latency or randomness.
- **30-Minute SerpApi Cache**: Prevents duplicate search latency by storing MD5 query signatures locally.
- **Sub-300ms LLM Router**: Multi-tier LLM waterfall featuring Groq sub-300ms inference (`llama-3.3-70b-versatile`), Gemini key rotation, and OpenRouter fallbacks.
- **12-Second Preflight Timeout**: Playwright visual scanner enforces a strict 12-second limit on external preflight link checking to prevent hanging browsers.
- **High Scalability**: Asynchronous event-driven architecture handles hundreds of job listings simultaneously without memory leaks.

---

## 🏆 8. Why Us? (Comparison Table)

| Feature | HireScout (Team Binary) | Traditional Job Portals | Generic Auto-Fill Extensions |
| :--- | :--- | :--- | :--- |
| **Search Coverage** | 🌐 **Unified via SerpApi** (Google Jobs + Web) | ❌ Single portal silo | ❌ Manual browsing required |
| **Matching Algorithm** | 🎯 **Deterministic 7-Signal Matrix (0-100)** | ❌ Naive keyword matching | ❌ None |
| **Simultaneous 10-Tab Apply** | ⚡ **Yes — 10 Browser Tabs Parallel Auto-Fill [B]** | ❌ None | ❌ Single tab only |
| **Side-by-Side Matrix** | 📊 **1-Click Terminal Matrix Comparison** | ❌ Manual spreadsheets | ❌ None |
| **Apply Safety Gate** | 🔒 **Section 9 Typed Human Gate ("yes/no")** | ❌ N/A | ⚠️ Uncontrolled auto-submit |
| **Login Bailing & Memory** | 🔐 **Interactive Skip + Domain Session Memory** | ❌ Trapped in loops | ❌ Trapped in loops |
| **Voice Interface** | 🎙️ **Native SAPI + "Hey Scout" Wake-Word** | ❌ Text only | ❌ None |
| **Inference Speed** | ⚡ **<1ms Scorer & Sub-300ms LLM Router** | 🐌 Slow portal reloads | 🐌 Slow browser extension DOM parsing |

---

## ⚡ 9. Quick Start & How to Run

### Prerequisites
- **Node.js 18+** installed
- **Windows 10/11** (recommended for SAPI voice output and global spacebar wake listener)
- **SerpApi API Key** (Get a free key at [serpapi.com](https://serpapi.com))

---

### Step-by-Step Installation & Execution

#### 1. Clone the Repository
```bash
git clone https://github.com/Anand2k29/HireScout.git
cd HireScout
```

#### 2. Install Dependencies & Playwright Browser
```bash
npm install
npm run install-browsers
```

#### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
copy .env.example .env
```
Open `.env` and set your **SerpApi Key**:
```env
# ─── Core Engine: SerpApi Live Search API Key (REQUIRED) ────────────────
SERPAPI_KEY=your_serpapi_key_here
```

#### 4. Run HireScout

##### Option A: Interactive Command Line (CLI)
```bash
npm start
```
1. Select **`Option [1]`** (Interactive AI Job Discovery & Application Dashboard).
2. Select **`Option [B]`** (**`⚡ Multi-Tab Simultaneous Batch Auto-Apply`**) to watch HireScout open & auto-fill 10 job applications simultaneously across 10 visible browser tabs!

##### Option B: Windows Quick Launcher
Double-click `Start_HireScout.bat` or run in CMD:
```cmd
.\Start_HireScout.bat
```

##### Option C: Run Full Automated Test Suite
```bash
npm test
```

---

## 🧪 NPM Command Reference

| Command | Action |
|---|---|
| `npm start` | Launch HireScout interactive terminal dashboard |
| `npm run demo` | Run HireScout standard mode |
| `npm run demo:live` | Launch HireScout in forced demo page mode (`APPLY_TARGET=demo`) |
| `npm test` | Run complete Node test suite across all test files (36+ tests) |
| `npm run voice:test` | Test SAPI persistent speech synthesis layer |

---

## 👥 Team Binary

> **SerpApi India Hackathon 2026 Submission**

| Member Name | GitHub Profile |
| :--- | :--- |
| **Anand Minejes** | [@Anand2k29](https://github.com/Anand2k29) |
| **Jyotasana** | [@Jyotasana17](https://github.com/Jyotasana17) |


<br/>

```
  ____  _                               
 | __ )(_)_ __   __ _ _ __ _   _        
 |  _ \| | '_ \ / _` | '__| | | |       
 | |_) | | | | | (_| | |  | |_| |  _ _ 
 |____/|_|_| |_|\__,_|_|   \__, | (_|_)
                           |___/        
```

*“Transforming job discovery & application workflows into an autonomous 1-command stream.”*

---

## 📄 License
MIT License. Built with ❤️ for **SerpApi India Hackathon 2026**.
