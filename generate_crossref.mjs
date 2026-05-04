/**
 * HABERDASH HAVEN — Thread Cross-Reference Generator
 * ====================================================
 * Node.js version — uses fetch() built into Node 18+
 * No external packages needed beyond what's already installed.
 *
 * Usage:
 *   node generate_crossref.mjs
 *   node generate_crossref.mjs --regenerate
 */

const SUPABASE_URL = "https://sbupkbtvaujvwwslqjnd.supabase.co";
const SUPABASE_KEY = "sb_publishable_-EzJs1Sxr6SklOUjZ0j-ow_hc1zHedq";
const TOP_N             = 5;
const MAX_DISTANCE_PCT  = 100.0;
const INSERT_BATCH_SIZE = 200;
const MAX_RGB_DISTANCE  = Math.sqrt(3 * 255 * 255); // 441.67

const HEADERS = {
  "apikey":        SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type":  "application/json",
};

// ── Supabase helpers ────────────────────────────────────────────────
async function sbGet(table, select, limit = 1000, offset = 0) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=${limit}&offset=${offset}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    const body = await res.text();
    console.error(`  GET error ${res.status}: ${body.slice(0, 200)}`);
    return [];
  }
  return res.json();
}

async function sbPost(table, rows) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { ...HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`  POST error ${res.status}: ${body.slice(0, 200)}`);
    return false;
  }
  return true;
}

async function sbDelete(table) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=neq.00000000-0000-0000-0000-000000000000`;
  const res = await fetch(url, { method: "DELETE", headers: HEADERS });
  return res.ok;
}

// ── Color math ──────────────────────────────────────────────────────
function hexToRgb(hex) {
  if (!hex) return null;
  const h = hex.trim().replace("#", "");
  if (h.length !== 6) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function colorDistance(a, b) {
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0));
}

function toPct(dist) {
  return Math.round((dist / MAX_RGB_DISTANCE) * 10000) / 100;
}

// ── Load all threads ────────────────────────────────────────────────
async function loadThreads() {
  console.log("\nLoading threads from thread_library…");
  const all = [];
  let offset = 0;
  const page = 1000;
  while (true) {
    const batch = await sbGet(
      "thread_library",
      "id,brand,brand_key,color_code,color_name,hex_color",
      page, offset
    );
    if (!batch.length) break;
    all.push(...batch);
    console.log(`  ${all.length} loaded…`);
    if (batch.length < page) break;
    offset += page;
  }
  const valid = all.filter(t => hexToRgb(t.hex_color));
  console.log(`  ✓ ${valid.length} with valid colors (${all.length - valid.length} skipped)`);
  return valid;
}

// ── Compute crossrefs ───────────────────────────────────────────────
function compute(threads) {
  // Group by brand_key
  const byBrand = {};
  for (const t of threads) {
    const bk = t.brand_key || "unknown";
    if (!byBrand[bk]) byBrand[bk] = [];
    byBrand[bk].push(t);
  }

  const brands = Object.keys(byBrand).sort();
  console.log(`\nBrands found (${brands.length}):`);
  for (const bk of brands) {
    console.log(`  ${bk.padEnd(30)} ${byBrand[bk].length} colors`);
  }

  // Pre-cache RGB
  const rgb = {};
  for (const t of threads) {
    const r = hexToRgb(t.hex_color);
    if (r) rgb[t.id] = r;
  }

  const crossrefs = [];
  let done = 0;
  const total = threads.length;
  const t0 = Date.now();

  console.log(`\nComputing top ${TOP_N} matches per brand pair…`);

  for (const srcBrand of brands) {
    const tgtBrands = brands.filter(b => b !== srcBrand);
    for (const src of byBrand[srcBrand]) {
      const srcRgb = rgb[src.id];
      if (!srcRgb) continue;

      for (const tgtBrand of tgtBrands) {
        const dists = [];
        for (const tgt of byBrand[tgtBrand]) {
          const tgtRgb = rgb[tgt.id];
          if (!tgtRgb) continue;
          const d   = colorDistance(srcRgb, tgtRgb);
          const pct = toPct(d);
          if (pct <= MAX_DISTANCE_PCT) dists.push([d, pct, tgt]);
        }
        dists.sort((a, b) => a[0] - b[0]);
        for (const [d, pct, tgt] of dists.slice(0, TOP_N)) {
          crossrefs.push({
            thread_id:     src.id,
            ref_thread_id: tgt.id,
            distance:      Math.round(d * 10000) / 10000,
            distance_pct:  pct,
          });
        }
      }

      done++;
      if (done % 200 === 0) {
        const elapsed = (Date.now() - t0) / 1000;
        const rate    = done / elapsed || 1;
        const eta     = ((total - done) / rate).toFixed(0);
        console.log(`  ${done}/${total} threads | ${crossrefs.length.toLocaleString()} rows | ${rate.toFixed(0)}/sec | ETA ${eta}s`);
      }
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✓ ${crossrefs.length.toLocaleString()} rows in ${elapsed}s`);
  return crossrefs;
}

// ── Insert in batches ───────────────────────────────────────────────
async function insert(crossrefs) {
  const total = crossrefs.length;
  let inserted = 0, failed = 0;
  console.log(`\nInserting ${total.toLocaleString()} rows in batches of ${INSERT_BATCH_SIZE}…`);

  for (let i = 0; i < total; i += INSERT_BATCH_SIZE) {
    const batch = crossrefs.slice(i, i + INSERT_BATCH_SIZE);
    const ok = await sbPost("thread_crossref", batch);
    if (ok) inserted += batch.length;
    else    failed   += batch.length;

    if ((i + INSERT_BATCH_SIZE) % 5000 === 0 || i + INSERT_BATCH_SIZE >= total) {
      console.log(`  ${Math.min(i + INSERT_BATCH_SIZE, total).toLocaleString()}/${total.toLocaleString()} inserted…`);
    }
  }

  console.log(`\n✓ ${inserted.toLocaleString()} inserted  |  ${failed.toLocaleString()} failed`);
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(55));
  console.log("  HABERDASH HAVEN — Cross-Reference Generator (Node)");
  console.log("=".repeat(55));

  const regenerate = process.argv.includes("--regenerate");
  if (regenerate) {
    console.log("\n⚠  --regenerate: clearing existing data…");
    const ok = await sbDelete("thread_crossref");
    console.log(ok ? "  ✓ Cleared" : "  ✗ Could not clear — continuing anyway");
  }

  const threads = await loadThreads();
  if (!threads.length) {
    console.error("✗ No threads loaded — check Supabase URL/key and RLS policies");
    process.exit(1);
  }

  const crossrefs = compute(threads);
  if (!crossrefs.length) {
    console.error("✗ No cross-references — need at least 2 brands with hex colors");
    process.exit(1);
  }

  await insert(crossrefs);

  console.log("\n" + "=".repeat(55));
  console.log("  Done! thread_crossref is ready.");
  console.log("  Re-run with --regenerate to rebuild after adding brands.");
  console.log("=".repeat(55));
}

main().catch(err => { console.error("Fatal error:", err); process.exit(1); });
