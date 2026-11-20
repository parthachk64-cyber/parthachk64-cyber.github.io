# Partha Chakraborty — research portfolio

Interactive research portfolio: AI for cybersecurity. Static [Astro](https://astro.build) site, TypeScript, plain CSS, and real-time WebGL scenes built with [three.js](https://threejs.org). No database, no runtime API calls, no keys.

**Live site:** https://parthachk64-cyber.github.io/

![Static preview of the portfolio](docs/preview.png)

The animated scenes, filters and deep links run on the hosted site. This image is a static capture.

## What is on the page

- Three real-time 3D scenes, each with four hotspot papers (12 featured papers):
  - **Plate A**: an AI agent breaking out of a glass sandbox of spilling sand, streaming data to server racks and a database.
  - **Plate B**: a robotic fingertip touching a lattice shield inside an orbit of network nodes (cloud, IIoT cluster, 6G antenna).
  - **Plate C**: a padlock on a live circuit board with travelling signals and two holographic AI clouds.
- The camera orbits with the pointer inside a plate; selecting a point sends a pulse along its 3D route. Hotspots are real HTML buttons projected from 3D anchors, with a matching text index, so keyboard, screen-reader and touch use do not depend on the canvas.
- Each scene is built only when it nears the viewport and disposed when it leaves (at most two WebGL contexts), pauses offscreen and in hidden tabs, and lowers its own quality if frames run slow. Reduced motion shows a still 3D frame. Without JavaScript or WebGL, the original illustrations are shown instead.
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

The end-to-end tests render WebGL. On Windows they use the real GPU; on GPU-less machines (CI) browsers fall back to software rendering, which is slow, so CI runs one worker with longer timeouts. Running several engines at once on one laptop can cause timeouts that disappear when run per engine.

## Updating content (the files you edit)

| What | File |
| --- | --- |
| Publications | `src/data/publications.json` |
| Which papers sit on which hotspot (and 2D poster anchors) | `src/data/scenes.ts` |
| 3D scenes, their hotspot anchors and pulse routes | `src/three/sceneA.ts`, `sceneB.ts`, `sceneC.ts` (`anchors` and `routes` at the bottom of each) |
| Google Scholar snapshot | `src/data/snapshot.ts` |
| Name, statement, links, education, service, email | `src/data/profile.ts` |

### Add or change a publication

Append a record to `src/data/publications.json`. Fields: `id` (unique, lowercase, used in URLs), `title`, `year`, `venue`, `workType`, `authors` (array, as supplied by the publisher, no ellipses), `authorsSource`, `doi` (empty string if none), `sourceName`, `verification` (`crossref`, `datacite` or `orcid-only`), `tags` (from the six topic ids in `src/lib/catalogue.ts`), `altVersions`, `note`. Records without a DOI need a `sourceUrl`. Run `npm test`: it rejects duplicate ids, DOIs and titles, missing links, ellipses in author lists, and a broken scene map.

Verify metadata against the publisher or Crossref (`https://api.crossref.org/works/<doi>`) and check that Partha Chakraborty is a credited author before adding a record. Do not add the parent proceedings volume as a work.

### Update the Scholar snapshot

Edit the three numbers and the label in `src/data/snapshot.ts`. The catalogue count on the page is derived from the records and is separate.

### Move a 3D hotspot

Each `src/three/scene*.ts` returns `anchors` (world positions of the four points) and `routes` (the curve a selection pulse travels). Move an anchor and its button follows automatically, since buttons are projected from the 3D position every frame.

### Move a poster hotspot or trace (no-WebGL fallback)

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
