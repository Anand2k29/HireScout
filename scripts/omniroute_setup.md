# Optional: OmniRoute Local LLM Gateway Setup

> OmniRoute is **not required**. HireScout works fully without it.
> When enabled, OmniRoute acts as an optional "Tier 0" LLM backend
> that routes requests across multiple providers with automatic fallback.

## 1. Install OmniRoute

```bash
# Option A: npm (recommended)
npm install -g omniroute

# Option B: Docker
docker run -d -p 20128:20128 diegosouzapw/omniroute
```

OmniRoute starts on **http://localhost:20128** by default.
Open the dashboard at http://localhost:20128 in your browser.

## 2. Create a HireScout Combo

In the OmniRoute dashboard:

1. Go to **Combos** → **Create Combo**
2. Name it: `hirescout-fast`
3. Strategy: **`priority`** (fast models first, strong fallback)
4. Add targets in order:
   - **Target 1:** A fast, cheap model (e.g. `groq/llama-3.3-70b`, `oc/gpt-4o-mini`, or any free model)
   - **Target 2:** A strong model as fallback (e.g. `cc/claude-sonnet-4-6`, `gemini/gemini-2.0-flash`)
   - **Target 3:** (Optional) Another fallback for resilience
5. Save the combo

Alternatively, just use `auto/fast` — OmniRoute will auto-route
to the fastest available model from your connected providers.

## 3. Set Environment Variables in HireScout

Add these to your `.env` file:

```env
OMNIROUTE_ENABLED=true
OMNIROUTE_URL=http://localhost:20128/v1
OMNIROUTE_API_KEY=your-omniroute-api-key
OMNIROUTE_MODEL=hirescout-fast
```

- `OMNIROUTE_API_KEY`: Get from OmniRoute dashboard → Settings → API Keys
- `OMNIROUTE_MODEL`: Your combo name, or `auto/fast`, `auto/cheap`, etc.

## 4. Verify

```bash
# Check OmniRoute is running
curl http://localhost:20128/v1/models

# Run HireScout with debug logging
DEBUG_LOGS=1 node index.js
```

Look for `[OmniRoute] ✓` in the debug output to confirm it's being used.

## Privacy Note

When OmniRoute is enabled, HireScout sends LLM prompts (JD parsing,
resume drafting, etc.) through OmniRoute, which forwards them to
whichever providers you configured in the OmniRoute dashboard.

**Only use provider accounts and API keys you are permitted to use
this way.** HireScout does not control or audit OmniRoute's provider
routing — that is your responsibility.

SerpApi remains the sole data source for job/news search.
OmniRoute is used only for text generation tasks.
