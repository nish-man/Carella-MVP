# Carella MVP

**Buy the car. Not the hassle.**

AI-powered UK car discovery. Ella asks the questions you don't know to ask.

---

## Deploy to Vercel (5 minutes)

### Step 1 — Push to GitHub
Make sure your repo root looks exactly like this:
```
your-repo/
├── api/
│   └── ella.js          ← Ella serverless function
├── public/
│   └── index.html       ← Full frontend
├── package.json
├── vercel.json
└── README.md
```

**The files must be at the repo root — not inside a subfolder.**

### Step 2 — Connect to Vercel
1. Go to [vercel.com](https://vercel.com) → Add New Project
2. Import your GitHub repo
3. Framework Preset: **Other** (not Next.js)
4. Root Directory: **leave blank** (it should auto-detect `vercel.json`)
5. Click Deploy

### Step 3 — Add your Anthropic API key
1. In Vercel dashboard → your project → Settings → Environment Variables
2. Add: `ANTHROPIC_API_KEY` = `sk-ant-...`
3. Get your key at [console.anthropic.com](https://console.anthropic.com)
4. Redeploy (Deployments → Redeploy)

Without the key, Ella runs in smart demo mode — still fully functional, just uses rule-based parsing instead of Claude.

---

## Run locally

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... node -e "
const http = require('http');
const handler = require('./api/ella.js');
http.createServer((req, res) => {
  // serve public files
  if (!req.url.startsWith('/api')) {
    const fs = require('fs'), path = require('path');
    const file = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200); res.end(data);
    });
    return;
  }
  // parse body for POST
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    if (body) try { req.body = JSON.parse(body); } catch {}
    res.json = (d) => { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify(d)); };
    handler(req, res);
  });
}).listen(3000, () => console.log('Running at http://localhost:3000'));
"
```

---

## Project structure

| File | Purpose |
|------|---------|
| `api/ella.js` | Single Vercel serverless function. Handles all `/api/*` routes: Ella search, car inventory, health check. |
| `public/index.html` | Complete frontend. Landing page, 5-screen onboarding quiz, Ella chat panel, results grid, car detail modal, garage. |
| `vercel.json` | Routes all `/api/*` requests to `api/ella.js`. Serves `public/` as static files. |
| `package.json` | Only `@anthropic-ai/sdk` — minimal dependencies. |

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Recommended | Live Ella AI (Claude). Get at console.anthropic.com. Without it, demo mode works fine for testing. |
| `MARKETCHECK_UK_KEY` | Phase 2 | Real UK car listings (680k+ daily). Apply at marketcheck.uk |
| `APIFY_KEY` | Phase 2 | AutoTrader scraper fallback. Sign up at apify.com |

---

## Inventory

The MVP ships with 27 realistic UK car listings (22 used + 5 brand new) covering all segments from a £7,995 Ford Fiesta (insurance group 10) to a £59,900 BMW i4. Replace with Marketcheck UK API by swapping the `searchInventory()` function in `api/ella.js`.

---

*Carella MVP v1.1 · Built for UK drivers*
# Carella MVP - Sun Apr 26 13:22:43 UTC 2026
