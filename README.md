# 💼 HireScout — Autonomous AI Job Discovery & Application Agent

> **SerpApi India Hackathon 2026 Submission**  
> **Track 1:** AI Agents (Search, Compare & Act)  
> **Team Name:** Binary  
> **License:** MIT  

---

## 🚨 1. Problem Statement (PS)

Modern technical job hunting is fragmented, time-consuming, and inefficient:
- **Search Fragmentation**: Candidates waste hours manually toggling across 10+ portals (LinkedIn, Google Jobs, Naukri, Unstop, Glassdoor, Greenhouse, Lever).
- **Keyword Blindness & Low Accuracy**: Portal search algorithms rely on simplistic title keywords, flooding candidates with irrelevant roles that do not match their true tech stack, experience level, or salary requirements.
- **Comparison Friction**: Evaluating trade-offs between two job opportunities (compensation, tech stack, remote policy, growth) requires manual spreadsheet comparisons and guesswork.
- **Application Fatigue & Form Failures**: Traditional auto-fill browser extensions crash on dynamic Single Page Applications (SPAs), struggle with custom ATS forms, solve captchas unsafely, or submit applications without candidate approval.

---

## 💡 2. The Solution

**HireScout** is an autonomous AI agent built in Node.js that unifies job discovery, factual candidate-job matching, side-by-side matrix comparison, and visual Playwright auto-fill applications into a single-command autonomous workflow.

Powered by **SerpApi's Google Jobs engine**, HireScout fetches live job listings, normalizes them into a unified **17-Field Schema**, ranks them deterministically with a **7-Signal Scoring Matrix**, offers 1-click side-by-side job comparisons, and executes real-first visual Playwright form preflights with hard-gated human confirmation.

---

## 🌐 3. How SerpApi Solved the Core Problem & How It Was Used

### The Problem SerpApi Solves
Traditional web scraping for jobs breaks constantly due to anti-bot protections, shifting HTML DOM structures, and fragmented portal formats.

### How SerpApi is Leveraged in HireScout (`serpapi.js`)
1. **Live Google Jobs Engine (`engine=google_jobs`)**: Queries SerpApi's Google Jobs API in real time across global & regional locations (`gl=us`, `gl=in`).
2. **Organic Web Search Fallback (`engine=google`)**: If Google Jobs returns 0 results for hyper-niche role queries, HireScout automatically cascades to SerpApi web search targeted at `site:unstop.com`, `site:naukri.com`, and `site:linkedin.com/jobs`.
3. **17-Field Schema Normalization**: Normalizes raw SerpApi responses into a 100% predictable 17-field HireScout Schema (`id`, `title`, `company`, `location`, `source`, `posted_date`, `application_url`, `apply_type`, `salary_range`, `job_type`, `experience_level`, `required_skills`, `role_summary`, `full_description`, `match_score`, `why_suitable`, `cover_letter_draft`).
4. **Intelligent 30-Minute Caching**: Saves search queries locally in `.hirescout_temp/serpapi_cache.json` with MD5 query hashing to prevent redundant API calls and optimize API credits.

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
         ┌─────────────────────────────┴─────────────────────────────┐
         ▼                                                           ▼
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│  📊 Side-by-Side Comparison     │                 │ 🚀 Real-First Playwright Scanner│
│  (Pick 2 jobs & rank signals)   │                 │ (12s preflight ATS link order)  │
└─────────────────────────────────┘                 └────────────────┬────────────────┘
                                                                     │
                                             ┌───────────────────────┴───────────────────────┐
                                             ▼                                               ▼
                                 ┌───────────────────────┐                       ┌───────────────────────┐
                                 │ USABLE Real Career Pg │                       │ Blocked / Form Wall   │
                                 │ (Greenhouse/Lever/etc)│                       │ (Login/Captcha/403)   │
                                 └───────────┬───────────┘                       └───────────┬───────────┘
                                             │                                               │
                                             ▼                                               ▼
                                 ┌───────────────────────┐                       ┌───────────────────────┐
                                 │ Section 9 Typed Gate  │                       │ Local Demo Site       │
                                 │ "Type yes to submit"  │                       │ (demo_site/apply.html)│
                                 └───────────────────────┘                       └───────────────────────┘
```

---

## ✨ 5. Key Features

### 🌐 1. Live SerpApi Job Search (`serpapi.js`)
- Real-time Google Jobs integration powered by SerpApi.
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

### 🚀 4. Real-First Playwright Apply Flow & Safety Gate (`apply.js`)
- Prioritizes direct company ATS portals (`Greenhouse`, `Lever`, `Workday`, `Ashby`, `SmartRecruiters`).
- **12-Second Hard Preflight Limit**: Assesses link usability without attempting captcha solving or login bypass.
- **Section 9 Typed Gate**: Hard-gates final submission behind explicit human confirmation:
  `"This will submit a REAL application to <company> for <role>. Type yes to submit, or no to stop."`
- **Demo Site Fallback**: If all top candidate links require logins or captchas, HireScout falls back to `demo_site/apply.html` clearly labeled with a **"DEMO FORM"** overlay badge.

### 🔀 5. Multi-Tier LLM Waterfall & Optional OmniRoute Gateway (`llm_omniroute.js`, `utils.js`)
- **Tier 0 (Optional)**: OmniRoute local LLM gateway (`http://localhost:20128/v1`) — off by default (`OMNIROUTE_ENABLED=false`).
- **Tier 1**: Groq sub-300ms ultra-fast inference (`llama-3.3-70b-versatile`).
- **Tier 2**: Google Gemini API key rotation (`gemini-2.5-flash`, `gemini-1.5-flash`).
- **Tier 3**: OpenRouter fallback models.

### 🎙️ 6. Windows Voice Layer (`voice.js`, `tts.js`)
Continuous background listener for wake phrase **"Hey Scout"** or **3x Rapid Spacebar** with SAPI speech synthesis.

---

## 🌟 6. Innovation & Uniqueness

1. **Real-First Playwright Auto-Fill with Safety Gate**: Unlike dangerous form-spammers, HireScout checks real company career sites first and strictly gates submission behind explicit human confirmation.
2. **Deterministic 0–100 Matching**: Uses mathematical Jaccard skill overlaps, token relevance, and parsed salary bands rather than hallucination-prone LLM scoring.
3. **JARVIS-Style Windows Voice Persona**: Integrated hands-free SAPI voice synthesis with continuous wake-word listening ("Hey Scout") and 3x Spacebar shortcut.
4. **Local Demo Rehearsal Site (`demo_site/apply.html`)**: Provides a sandbox environment for testing auto-fill and visual scanning without touching live corporate databases.

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
| **Side-by-Side Matrix** | 📊 **1-Click Terminal Matrix Comparison** | ❌ Manual spreadsheets | ❌ None |
| **Apply Safety Gate** | 🔒 **Section 9 Typed Human Gate ("yes/no")** | ❌ N/A | ⚠️ Uncontrolled auto-submit |
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
| `npm test` | Run complete Node test suite across all 5 test files (36+ tests) |
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
