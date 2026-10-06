# Coaching Tools

Static site (no build step) for GitHub Pages. First tool: `soccer/` lineups and sub rotations.

## Run locally
    python3 -m http.server   # then open http://localhost:8000

## Publish
Push to GitHub, then Settings → Pages → Deploy from branch → `main` / root.

## Data
- `soccer/data/base.json` is the committed data (templates + seasons).
- Edits made in the browser are stored in localStorage and overlaid on top of it.
- To make edits permanent: "Export data" on the soccer home page, replace `soccer/data/base.json`, commit.
- Keep first names only; the repo is public.
