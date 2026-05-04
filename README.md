# ✿ Haberdash Haven

> **Making the world a better place. One stitch at a time...**

A mobile-first inventory and reference app for quilters, embroiderers, and sewists.

![Haberdash Haven](public/HH_Logo.png)

---

## Features

- 🧵 **Thread Match** — Search 4,200+ thread colors across 26 brands (Isacord, Glide, King Tut, Aurifil, Floriani, Gutermann, and more)
- ⇄ **Cross-Reference** — Find the nearest color equivalent between any two thread brands, powered by 486,000+ pre-computed color distance matches
- 📷 **Camera Match** — Photograph a fabric or thread and find the closest color match
- ▦ **Barcode Scanner** — Scan any thread spool barcode for instant identification
- ◈ **Full Stash Management** — Track threads, rulers, machines, AccuQuilt dies, presser feet, and accessories
- ⚙️ **Machine Library** — 280+ machines with serial number tracking, purchase records, warranty dates, and computerized/mechanical distinction
- 👟 **Presser Feet** — 90+ presser feet organized by category
- ◉ **Projects** — Build project thread lists with color swatches
- 🌍 **10 Languages** — English, German, French, Dutch, Spanish, Portuguese, Japanese, Korean, Chinese
- 📊 **CSV Export** — Export your entire stash for insurance records or guild inventory
- 🎨 **Cozy Cottage Design** — Watercolor sunflowers, cobalt sky palette

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Backend / Auth / DB | Supabase |
| Styling | CSS (custom, no framework) |
| Fonts | Playfair Display · Nunito · Caveat |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account

### Install
```bash
git clone https://github.com/katrinafinch-bot/Haberdash-Haven.git
cd Haberdash-Haven
npm install
```

### Configure
Edit `src/main.jsx` and set your Supabase URL and anon key:
```js
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_KEY = "your-anon-key";
```

### Run
```bash
npm run dev
```

---

## Database Setup

Run the SQL migration files in `supabase/migrations/` in order (029 → 039) using the Supabase SQL Editor.

Key migrations:
| File | Description |
|---|---|
| `037_merge_thread_tables.sql` | Merges Isacord-only table into unified thread_library |
| `038_crossref_table.sql` | Creates pre-computed cross-reference table |
| `039_machine_computerized.sql` | Adds computerized/mechanical flag to machines |

---

## Cross-Reference Generation

After setting up the database, generate the 486,000+ pre-computed color matches:

```bash
# Using Node.js (recommended)
node scripts/generate_crossref.mjs

# Regenerate from scratch after adding new brands
node scripts/generate_crossref.mjs --regenerate
```

This takes ~5 minutes and only needs to be re-run when new thread brands are added.

---

## Project Structure

```
haberdash-haven/
├── public/
│   └── HH_Logo.png
├── src/
│   ├── App.jsx          # Main app (2,300+ lines)
│   ├── main.jsx         # Supabase auth wiring
│   ├── styles.css       # Full brand styles
│   ├── i18n.js          # 116 translation keys × 10 languages
│   └── data/
│       └── thread-library.json   # Local starter data
├── scripts/
│   ├── generate_crossref.mjs    # Cross-reference generator (Node)
│   └── generate_crossref.py     # Cross-reference generator (Python)
├── supabase/
│   └── migrations/              # SQL migration files 029–039
└── README.md
```

---

## License

Private — all rights reserved. © Haberdash Haven.
