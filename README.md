# Merch Mockup Studio — Phase 2

Client-side web app for bulk merch mockup creation. Users place logos on
garment photos with a Canvas-based editor, then optionally run each mockup
through an AI harmonization pass that blends the logo naturally into the
fabric (lighting, shadows, wrinkles).

## Architecture

- **Frontend**: React + Vite + Tailwind (static assets)
- **Canvas placement**: 100% in the browser, no backend needed
- **AI harmonization**: two tiny serverless functions in `/api/` that proxy to
  the Replicate API. The Replicate token stays on the server (Vercel env var).
  It is **never** shipped to the browser.
- **AI model**: `google/nano-banana` (Gemini 2.5 Flash Image) on Replicate.
  Swap to another model by editing `api/harmonize.js`.

## Local development

```bash
npm install
npm run dev
```

To test the AI features locally, install the Vercel CLI and run
`vercel dev` instead — this runs the serverless functions too.

## Deploy to Vercel (required for AI features)

### Step 1 — Get a Replicate API token
1. Go to https://replicate.com and sign up (free, ~1 min)
2. Open https://replicate.com/account/api-tokens
3. Click "Create token", copy the long string starting with `r8_...`
4. Keep this tab open — you'll paste it into Vercel next

### Step 2 — Import the repo into Vercel
1. Go to https://vercel.com and sign up with your GitHub account (free)
2. Click **Add New → Project**
3. Find this repo in the list, click **Import**
4. Framework preset should auto-detect as **Vite** — leave defaults
5. **Before clicking Deploy**, expand **Environment Variables**
6. Add a new variable:
   - **Name**: `REPLICATE_API_TOKEN`
   - **Value**: the token you copied in Step 1 (`r8_...`)
7. Click **Deploy**

### Step 3 — Wait ~1 min
Vercel builds and deploys. You'll get a URL like
`https://merch-mockup-studio.vercel.app/`. The AI buttons will now work.

Every `git push` to `main` automatically redeploys.

### Step 4 — (Optional) Custom domain
- Vercel Dashboard → your project → Settings → Domains
- Add your websupport.sk domain (e.g. `mockups.yourdomain.com`)
- In websupport.sk DNS, add the CNAME record Vercel tells you to
- HTTPS is auto-provisioned

## Costs (as of April 2026)

- **Vercel**: free tier is fine for internal use (100 GB-hours/month of
  function execution)
- **Replicate / nano-banana**: ~$0.039 per harmonization. Start with their
  free credit ($0 payment required). A €50/mo budget buys ~1,200 renders.
- Canvas-only exports (no AI) remain free.

## Using AI responsibly

- AI results are cached per garment — unless you change the placement,
  re-hitting **Harmonize** will regenerate but not show any new cost-saving
  behaviour. (We don't re-call the API for unchanged garments in batch mode.)
- Changing placement invalidates the cached AI result. The app flags this
  automatically.
- You can toggle between Canvas and AI version per-garment in the left panel
  (the `AI` / `Canvas` button that appears under each garment that has an AI
  result).
- If an AI call fails mid-batch, the rest continue. Check browser console for
  the specific error.

## Keep GitHub Pages as a fallback (optional)

The GitHub Actions workflow at `.github/workflows/deploy.yml` still works —
it'll build and deploy the static frontend to GitHub Pages. AI features will
gracefully disable there (a banner tells the user to use the Vercel URL).
