# TCET PYQs

A single-page website for first-year TCET students to browse and **download previous year question papers (PYQs)**, organised as **Group I / Group II → Subject → Odd/Even sem** (modelled on the layout you shared).

Everything is in one self-contained file — `index.html` (HTML + CSS + the paper list, no build step, no server needed to view). It works opened directly, served locally, or deployed to Vercel.

## Project layout

```
tcet-pyqs/
├─ index.html          # the whole site: styling, page logic, and the paper list
├─ vercel.json         # Vercel config
├─ assets/
│  ├─ tcet-logo.png     # full TCET crest + wordmark (transparent)
│  └─ tcet-shield.png   # crest only (nav / favicon)
├─ scripts/            # helper scripts used to split combined PDFs (not deployed)
└─ pyqs/
   ├─ group1/<subject>/ # put Group I PDFs here
   └─ group2/<subject>/ # Group II PDFs (ISE-I & ISE-II already added)
```

## Adding a question paper

1. Copy the PDF into the right folder, e.g. `pyqs/group1/phy/phy-ese-2024.pdf`.
2. Open `index.html`, find the `SITE` list near the top of the `<script>`, locate the
   subject, and add an entry to its `papers` array:

   ```js
   { title: "ESE 2024-25", year: "2024-25", exam: "ESE",
     sem: "odd", file: "pyqs/group1/phy/phy-ese-2024.pdf" }
   ```

   - `exam` — `"ISE"`, `"MSE"`, or `"ESE"` (coloured tag)
   - `sem`  — `"odd"` or `"even"` (groups papers into sections)
   - `file` — path to the PDF from the site root

To add/rename a **subject** or change the **groups**, edit the `subjects` / `groups` lists in the same place.

### Splitting a combined PDF

If you have one PDF holding several subjects' papers, the `scripts/` folder has the
helpers used to split them: `render.py` (PDF → page images), `contact.py` (stacks the
top of every page into one sheet so you can spot where each subject starts),
`clean.py` (whitens/﻿de-smudges scanned pages so they read like clean prints),
`assemble.py` (cleaned pages → a per-subject PDF) and `split.py` (loss-less page copy
for already-clean PDFs). Run them with `python -I scripts/<name>.py ...`. These are
dev-only and excluded from the Vercel deploy via `.vercelignore`.

## Run locally

```bash
python -m http.server 5173
```

Then open http://localhost:5173. (You can also just double-click `index.html`.)

## Deploy to Vercel

Push this folder to a Git repo and import it on Vercel, or:

```bash
npm i -g vercel && vercel
```

No framework preset — choose **"Other"** / static. The folder is served as-is.
