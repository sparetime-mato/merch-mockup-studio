# Merch Mockup Studio — Phase 1

Client-side web app for bulk-creating merch mockups (t-shirts, hoodies, caps).
Upload garment photos + a logo, place the logo, batch-apply to all garments,
export as ZIP. Runs 100% in the browser — no backend, no API costs.

## Local development

You need **Node.js 18+** installed (https://nodejs.org).

```bash
npm install
npm run dev
```

Open the URL shown (usually http://localhost:5173).

## Deploying to GitHub Pages (recommended for testing)

This repo includes a GitHub Actions workflow that auto-deploys on every push
to `main`. To set it up:

1. **Create a new GitHub repo** (public or private — Pages works on both for
   free accounts as of 2024).
2. **Push this code** to the repo (`git init`, `git add .`, `git commit`, `git remote add origin …`, `git push -u origin main`).
3. **In GitHub**, go to `Settings → Pages` and set **Source** to
   **"GitHub Actions"** (not "Deploy from a branch").
4. **Push any commit** (or re-run the workflow from the Actions tab). It will
   build and deploy automatically.
5. After ~1–2 minutes, your app is live at
   `https://<your-username>.github.io/<repo-name>/`.

### Important: set the base path

Because GitHub Pages serves at `/<repo-name>/`, relative asset paths are
already handled by `base: './'` in `vite.config.js`. You do NOT need to
change anything — it just works.

If you later move to a **custom domain** or a subdomain on websupport.sk
(e.g. `mockups.yourdomain.com`), keep `base: './'` — it works in both cases.

## Deploying to websupport.sk

Once you've tested on GitHub Pages and want to move to your own domain:

1. Run `npm run build` locally — this creates a `dist/` folder.
2. Upload the **contents of `dist/`** (not the folder itself) to your
   websupport.sk hosting via FTP or their File Manager. Put the files in
   `public_html/` (or the document root of your subdomain).
3. Done. The app is pure static files, so the cheapest shared hosting plan
   works fine.

## Tech stack

- React 18 + Vite
- Tailwind CSS
- lucide-react for icons
- Canvas API for compositing
- Custom ZIP writer (no external dep, keeps bundle small)
