# CLAUDE.md — HXO Studio Dashboard

> This file is self-contained. Anyone cloning this repo should understand
> the project without needing access to any other context.

## What This Is

HXO Studio Dashboard is an internal operations dashboard for HXO Studio. It visualizes token usage across AI models and sessions, with a planned Business Metrics tab. Deployed as a static site on Cloudflare Pages.

## Current Status

- **Stage**: MVP
- **Priority**: Active
- **Last Updated**: 2026-03-04

## Energy

Levels energy — ship fast, iterate later.

## Architecture

Static single-page app. Fetches `token-usage-api.json` from `/public` (bundled at build time). Future: replace with a live endpoint (Cloudflare Worker or cron-generated JSON).

```
index.html
  └── App.tsx (tab router)
        ├── TokenUsageTab.tsx (KPI cards, 7-day chart, session table)
        └── BusinessMetricsTab.tsx (placeholder)
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend  | React + TypeScript (Vite) |
| Hosting   | Cloudflare Pages |
| Domain    | TBD (app.hobart.ai planned) |
| Data      | Static JSON (token-usage-api.json) |

## Style Guide

- **Navy Blue** `#002244` — primary brand accent, active states
- **Royal Blue** `#00338D` — links, hover, chart bars
- **Silverware** `#b7b7bf` — muted text, borders
- **Background** `#0a0a0a` — dark, not navy
- **Font** Avenir Next → Montserrat → system sans-serif

## Getting Started

```bash
git clone git@github.com:hobartxo/hxo-studio-dashboard.git
cd hxo-studio-dashboard
npm install
npm run dev
```

## Project Structure

```
hxo-studio-dashboard/
├── CLAUDE.md
├── AGENTS.md
├── index.html
├── package.json
├── vite.config.ts
├── public/
│   └── token-usage-api.json
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── App.css
    └── components/
        ├── TokenUsageTab.tsx
        └── BusinessMetricsTab.tsx
```

## Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Static JSON over API | Fastest path to deploy; pipeline generates JSON separately | 2026-03-04 |
| Inline styles in TokenUsageTab | Matches original component; avoid CSS module overhead for one component | 2026-03-04 |
| Cloudflare Pages | Free, fast, auto-deploy from GitHub | 2026-03-04 |

## Deployment

```bash
npm run build
npx wrangler pages deploy dist --project-name hxo-studio-dashboard
```

Auto-deploy via Cloudflare Pages connected to `main` branch (when configured).

## Conventions

- Dark theme: `#0a0a0a` background, white text, navy-tinted panels
- Brand colors for accents and subtle panel tinting (no loud saturated fills)
- Avenir Next font family with Montserrat fallback

## Status Cadence (Hard Rule)

If you’re working on changes in this repo, keep Mark informed:

- Start with a 1-line “starting now” + what you’re doing.
- If work takes >2 minutes, send a progress ping every ~2–3 minutes.
- When done, send a recap with:
  - what changed
  - PR link
  - where to view the result (Pages URL)

No disappearing mid-task.

## Roadmap

### Next Up
- [ ] Live data pipeline (cron → JSON → deploy, or Worker endpoint)
- [ ] Business Metrics tab design and build
- [ ] Custom domain (app.hobart.ai)

### Later
- [ ] Auth layer if dashboard goes beyond internal use
- [ ] Historical data / date range picker
- [ ] Cost estimates when pricing data is available
