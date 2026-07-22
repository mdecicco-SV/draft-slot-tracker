# draft-slot-tracker

Static single-page MLB draft-signings tracker (2018–2025): `index.html` fetches `data.csv` client-side; no framework, no build step. Hosted on GitHub Pages from `main` of `Stadium-Ventures/draft-slot-tracker` (the `mdecicco-SV` remote name is a transfer redirect to the same repo). `make-pdf.js` is a local Node CLI that turns a site CSV export into a one-page PDF via headless Chrome.

- Run locally with `python3 -m http.server` (a `file://` open won't load `data.csv`).
- Deploy = push to `main`; GitHub Pages rebuilds in ~1 min.

## SV Internal Hub registry

This app is registered at https://sv-internal-hub.vercel.app/apps/draft-slot-tracker.
Whenever a change in this session adds, removes, or alters any of the following, update `sv-app.json` at the repo root **in the same session** — don't leave it for later:

- scheduled jobs / crons
- data sources in or destinations out (Slack channels, sheets, DBs, emails)
- hosting, deployment, or access/auth
- monitoring or known issues
- ownership or who uses it

Also update the `runbook` steps if the local-dev or deploy process changed. The hub reads `sv-app.json` hourly and merges it over `registry/draft-slot-tracker.json` in `Stadium-Ventures/sv-internal-hub`.
