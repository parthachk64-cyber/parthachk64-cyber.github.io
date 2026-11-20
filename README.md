# Partha Chakraborty — research portfolio

Interactive research portfolio: AI for cybersecurity. Static [Astro](https://astro.build) site, TypeScript, plain CSS and one small client module. No database, no runtime API calls, no keys.

**Live site:** https://parthachk64-cyber.github.io/

![Static preview of the portfolio](docs/preview.png)

The animated scenes, filters and deep links run on the hosted site. This image is a static capture.

## What is on the page

- Three illustrated scenes, each with four hotspot papers (12 featured papers). Hotspots are real buttons with a matching text index; hover or focus previews a topic, click, tap, Enter or Space commits it.
- A searchable bibliography with topic and year filters, newest first, deep links (`#pub-<id>`, `#featured-<id>`, `?q=&topic=&year=`) and a no-JavaScript static list.
- Google Scholar snapshot, about, service and contact.

Scene lines are **editorial topic associations**, not data flow, citation links or findings.

## Commands

```bash
npm ci
npm run dev          # local dev server
npm run build        # production build to dist/
npm run preview      # serve dist/ locally
npm run check        # astro type check
npm test             # unit tests + coverage (src/lib)
npm run e2e          # Playwright: chromium, firefox, webkit, two mobile emulations
npm run e2e:chromium # chromium only (what CI runs)
```

First time only: `npx playwright install chromium firefox webkit`.

## Updating content (the files you edit)

| What | File |
| --- | --- |
| Publications | `src/data/publications.json` |
| Which papers sit on which hotspot, anchor positions, trace lines | `src/data/scenes.ts` |
| Google Scholar snapshot | `src/data/snapshot.ts` |
| Name, statement, links, education, service, email | `src/data/profile.ts` |

### Add or change a publication

Append a record to `src/data/publications.json`. Fields: `id` (unique, lowercase, used in URLs), `title`, `year`, `venue`, `workType`, `authors` (array, as supplied by the publisher, no ellipses), `authorsSource`, `doi` (empty string if none), `sourceName`, `verification` (`crossref`, `datacite` or `orcid-only`), `tags` (from the six topic ids in `src/lib/catalogue.ts`), `altVersions`, `note`. Records without a DOI need a `sourceUrl`. Run `npm test`: it rejects duplicate ids, DOIs and titles, missing links, ellipses in author lists, and a broken scene map.

Verify metadata against the publisher or Crossref (`https://api.crossref.org/works/<doi>`) and check that Partha Chakraborty is a credited author before adding a record. Do not add the parent proceedings volume as a work.

### Update the Scholar snapshot

Edit the three numbers and the label in `src/data/snapshot.ts`. The catalogue count on the page is derived from the records and is separate.

### Move a hotspot or a trace

In `src/data/scenes.ts`, `x` and `y` are percentages of the uncropped image from the top left. `trace` is a list of `[x, y]` percentage points drawn over the artwork. To check alignment, run `npm run dev`, open the DevTools console and run:

```js
document.head.append(Object.assign(document.createElement('style'), { textContent: '.trace__line{opacity:.95!important}.ring{opacity:.9!important}' }))
```

All lines and rings then stay visible so you can see them against the picture. Hotspots, traces and artwork share one wrapper and transform, so positions stay registered when the plane tilts.

To swap a featured paper, change the `id` of a point in `scenes.ts` to another record `id`. Each of the 12 must be distinct; `npm test` enforces it.

## Deployment

`.github/workflows/deploy.yml` uses the official GitHub Pages flow: a build job with `contents: read` (type check, unit tests, build, Chromium end-to-end tests, upload artifact), then a deploy job with `pages: write` and `id-token: write` using the built-in workflow identity. It runs on pushes to `main`. In the repository settings, Pages source must be **GitHub Actions**.

To publish under a project repository instead of the user site, build with `SITE_URL=https://<user>.github.io SITE_BASE=/<repo>/ npm run build`.

## Notes

- Tests are written against the data: unique ids, safe links, exactly three scenes, 12 distinct featured records with the expected titles.
- Private review notes and raw metadata lookups are kept out of this repository.
- Illustrations are artwork, not photographs of the researcher.
