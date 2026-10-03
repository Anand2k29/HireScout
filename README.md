# 💼 HireScout — Autonomous AI Job Discovery & Application Agent

> **SerpApi India Hackathon 2026 Submission**  
> **Track 1:** AI Agents (Search, Compare & Act)  
> **License:** MIT

HireScout is an autonomous AI agent built in Node.js that transforms job searching and application automation into a single-command stream. Powered by **SerpApi's Google Jobs engine**, a **deterministic 7-signal weighted matching matrix**, a **Real-First Playwright visual auto-fill scanner**, and an optional **OmniRoute local LLM gateway**, HireScout continuously searches, evaluates, compares, and applies to top engineering roles with 100% factual integrity and hard-gated human confirmation.

---

## 🌟 Key Innovations & Architecture

```
                               ┌──────────────────────────┐
                               │   User Search Intent     │
                               └────────────┬─────────────┘
                                            │
                                            ▼
                               ┌──────────────────────────┐
                               │     SerpApi Engine       │
                               │  (google_jobs + web fallback)
                               └────────────┬─────────────┘
                                            │ (17-Field Schema)
                                            ▼
                               ┌──────────────────────────┐
                               │   7-Signal Scorer        │
                               │   (Deterministic 0-100)  │
                               └────────────┬─────────────┘
                                            │
                      ┌─────────────────────┴─────────────────────┐
                      ▼                                           ▼
          ┌───────────────────────┐                   ┌───────────────────────┐
          │  Job Comparison UI    │                   │   Real-First Scanner  │
          │ (Side-by-side 7-signal)│                   │ (12s preflight limit) │
          └───────────────────────┘                   └───────────┬───────────┘
                                                                  │
                                            ┌─────────────────────┴─────────────────────┐
                                            ▼                                           ▼
                                ┌───────────────────────┐                   ┌───────────────────────┐
                                │ USABLE Real Career Pg │                   │ ALL Links Blocked     │
                                │ (Greenhouse/Lever/etc)│                   │ (Login/Captcha/403)   │
                                └───────────┬───────────┘                   └───────────┬───────────┘
                                            │                                           │
                                            ▼                                           ▼
                                ┌───────────────────────┐                   ┌───────────────────────┐
                                │ Section 9 Typed Gate  │                   │ Local Demo Form       │
                                │ "This is a REAL app"  │                   │ (demo_site/apply.html)│
                                └───────────────────────┘                   └───────────────────────┘
```

### 1. 🌐 Live SerpApi Job Search (`serpapi.js`)
- **Primary Engine**: Queries SerpApi's Google Jobs engine (`engine=google_jobs`) in real-time.
- **Web Fallback**: If Google Jobs returns 0 results, automatically falls back to SerpApi web search (`site:unstop.com`, `site:naukri.com`, `site:linkedin.com/jobs`).
- **17-Field Schema Normalization**: Normalizes raw job listings into a complete 17-field schema (`id`, `title`, `company`, `location`, `source`, `posted_date`, `application_url`, `apply_type`, `salary_range`, `job_type`, `experience_level`, `required_skills`, `role_summary`, `full_description`, `match_score`, `why_suitable`, `cover_letter_draft`).
- **30-Minute Caching**: Caches search results locally in `.hirescout_temp/serpapi_cache.json` for 30 minutes to optimize API credit usage.
- **Keyless Mock Mode**: Automatically falls back to a realistic mock job pool if `SERPAPI_KEY` is omitted, ensuring HireScout runs out-of-the-box.

### 2. 🧠 Deterministic 7-Signal Weighted Scorer (`scorer.js`)
Evaluates candidate jobs in **<1ms** with zero network latency and 0% randomness:
1. **Skills Match (30 pts max)**: Jaccard overlap between candidate profile skills and job requirements.
2. **Title Relevance (20 pts max)**: Token match ratio for target role.
3. **Salary Alignment (15 pts max)**: Parsed compensation band vs target.
4. **Deadline Urgency (10 pts max)**: Application closing date recency.
5. **Company Rating (10 pts max)**: 1–5 star rating mapped to score scale.
6. **Posting Freshness (10 pts max)**: Recency scoring ("today", "1 day ago", "3 days ago").
7. **Apply Competition (5 pts max)**: Direct Apply bonus and position count.

### 3. 📊 Side-by-Side Job Comparison Matrix (`compareJobs`)
Allows candidates to pick any 2 jobs from top matches and renders a side-by-side terminal matrix comparing all 7 signals, producing an AI-backed winner recommendation with 1-click apply triggers.

### 4. 🚀 Real-First Playwright Apply Flow & Demo Fallback (`apply.js`)
- **Real-First Preflight**: Prioritizes ATS & direct career portals (`Greenhouse`, `Lever`, `Workday`, `Ashby`, `SmartRecruiters`).
- **12-Second Hard Preflight Limit**: Evaluates link usability without attempting captcha solving, stealth plugins, or account creation.
- **Section 9 Typed Gate**: Pauses before final submission and prompts:
  `"This will submit a REAL application to <company> for <role>. Type yes to submit, or no to stop."`
- **Demo Site Fallback**: If all top candidate links require logins or captchas, HireScout falls back to `demo_site/apply.html` clearly labeled with a **"DEMO FORM"** overlay badge and status `"demo"`.
- **Mode Router (`APPLY_TARGET`)**:
  - `APPLY_TARGET=auto`: Real-first apply with demo fallback (default).
  - `APPLY_TARGET=real`: Real application pages only.
  - `APPLY_TARGET=demo`: Forces demo page for rehearsals.

### 5. 🔀 Multi-Tier LLM Waterfall & Optional OmniRoute Gateway (`llm_omniroute.js`, `utils.js`)
- **Tier 0 (Optional)**: OmniRoute local LLM gateway (`http://localhost:20128/v1`) — off by default (`OMNIROUTE_ENABLED=false`).
- **Tier 1**: Groq sub-300ms ultra-fast inference (`llama-3.3-70b-versatile`).
- **Tier 2**: Google Gemini API key rotation across models (`gemini-2.5-flash`, `gemini-1.5-flash`).
- **Tier 3**: OpenRouter fallback models.
- **Tier 4 & 5**: Local Claude proxy and Ollama local models.

### 6. 🎙️ Windows Voice Layer (`voice.js`, `tts.js`, `grammar.js`, `listen_space_global.ps1`)
- Continuous background listener for wake phrase **"Hey Scout"** or **3x Rapid Spacebar**.
- Persistent SAPI speech output process queue with half-duplex mic suppression during speech output.
- Closed command grammar for fast intent parsing.

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18 or higher
- Windows 10/11 (for native voice layer & background listener)
- Playwright Chromium browser (`npm run install-browsers`)

### Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Anand2k29/HireScout.git
   cd HireScout
   ```

2. **Install dependencies and Chromium browser**:
   ```bash
   npm install
   npm run install-browsers
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   copy .env.example .env
   ```
   Add your API keys:
   ```env
   SERPAPI_KEY=your_serpapi_key_here
   GEMINI_API_KEY=your_gemini_key_here
   ```

4. **Launch HireScout**:
   ```bash
   npm start
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

## 🔬 Test Suite Coverage

Run all unit tests:
```bash
npm test
```

Test suites include:
- `test/omniroute.test.js`: 12 test cases covering gateway health caching, circuit breaker, 429 handling, and remote URL security.
- `test/serpapi.test.js`: 6 test cases covering live job extraction, keyword skill extraction, 17-field normalization, and 30-min caching.
- `test/scorer.test.js`: 5 test cases covering 7-signal deterministic scoring, reproducibility, and rank sorting.
- `test/apply.test.js`: 3 test cases covering local file URL resolution, `demo_site/apply.html` DOM elements, and audit logging.
- `test/real_apply.test.js`: 6 test cases covering ATS link ordering, preflight block classifiers, trace logging, and real vs demo gate execution.

---

## 📄 License
MIT License. Built for SerpApi India Hackathon 2026.
