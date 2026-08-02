# Deployment & branches

This repo has **two intentional lines of work**. Do not merge them unless you mean to.

## Branches

| Branch | Purpose | Deploy to Vercel? |
|--------|---------|-------------------|
| **`vercel-baseline`** | **Production.** Matches live snap, peek (143px), spacing, and scroll behavior. Ship copy and safe fixes here. | **Yes — this branch only** |
| **`main`** | **Experimental.** Fold-snap, tight stack, layout experiments. May diverge from production feel. | **No** |

### History (why this exists)

- Production was frozen at `bec8261`.
- Fold-snap / tight-stack work landed on `main` as `6c1099a` and was **never** meant to replace production without review.
- A merge of `vercel-baseline` into `main` accidentally mixed both behaviors. **`vercel-baseline` is the source of truth for production.**

## Workflow

1. **Copy, About, odometer tweaks, bug fixes for live site** → commit on `vercel-baseline`.
2. **Scroll snap experiments, stack spacing, fold calibration** → commit on `main`.
3. **Deploy** → from `vercel-baseline` only (`vercel --prod` on that branch, or set Vercel Git production branch to `vercel-baseline`).
4. **Never** merge `main` → `vercel-baseline` without explicitly checking snap/peek in the browser.

## Vercel

- Project: `ashlonfrankportfolio`
- Production URL: https://ashlonfrankportfolio.vercel.app
- CLI deploy (from repo root, on `vercel-baseline`):

  ```bash
  git checkout vercel-baseline
  vercel --prod --yes
  ```

## Quick check before deploy

- [ ] On branch `vercel-baseline`
- [ ] Index snap feels like production (peek band, project spacing)
- [ ] Hard refresh with current cache-bust query on `index.html` / `about.html`
