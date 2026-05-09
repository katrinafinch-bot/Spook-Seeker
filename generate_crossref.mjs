/**
 * HABERDASH HAVEN — Thread Cross-Reference Generator v2
 * ======================================================
 * Uses RGB columns directly — no hex conversion needed.
 * node generate_crossref.mjs
 * node generate_crossref.mjs --regenerate
 */

const SUPABASE_URL = "https://sbupkbtvaujvwwslqjnd.supabase.co";
const SUPABASE_KEY = "sb_publishable_-EzJs1Sxr6SklOUjZ0j-ow_hc1zHedq";
const TOP_N             = 5;
const INSERT_BATCH_SIZE = 200;
const MAX_RGB_DISTANCE  = Math.sqrt(3 * 255 * 255);

const HEADERS = {
  "apikey":        SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type":  "application/json",
};

async function sbGet(table, select, limit = 1000, offset = 0) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=${limit}&offset=${offset}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) { console.error(`GET ${res.status}`); return []; }
  return res.json();
}

async function sbPost(table, rows) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { ...HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) { const b = await res.text(); console.error(`POST ${res.status}: ${b.slice(0,150)}`); return false; }
  return true;
}

async function sbDelete(table) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=neq.00000000-0000-0000-0000-000000000000`;
  const res = await fetch(url, { method: "DELETE", headers: HEADERS });
  return res.ok;
}

// Use RGB columns directly — no hex parsing
function colorDistance(a, b) {
  return Math.sqrt((a.r-b.r)**2 + (a.g-b.g)**2 + (a.b-b.b)**2);
}

function toPct(dist) {
  return Math.round((dist / MAX_RGB_DISTANCE) * 10000) / 100;
}

async function loadThreads() {
  console.log("\nLoading threads (using RGB columns)…");
  const all = [];
  let offset = 0;
  while (true) {
    // Select r,g,b directly — no hex needed
    const batch = await sbGet("thread_library", "id,brand,brand_key,color_code,color_name,r,g,b,hex_color", 1000, offset);
    if (!batch.length) break;
    all.push(...batch);
    process.stdout.write(`\r  ${all.length} loaded…`);
    if (batch.length < 1000) break;
    offset += 1000;
  }
  console.log();
  // Only keep threads with valid RGB
  const valid = all.filter(t => t.r != null && t.g != null && t.b != null);
  const noRgb = all.length - valid.length;
  console.log(`  ✓ ${valid.length} with RGB colors (${noRgb} skipped — run step 41 SQL first)`);
  return valid;
}

function compute(threads) {
  const byBrand = {};
  for (const t of threads) {
    const bk = t.brand_key || "unknown";
    if (!byBrand[bk]) byBrand[bk] = [];
    byBrand[bk].push(t);
  }

  const brands = Object.keys(byBrand).sort();
  console.log(`\nBrands (${brands.length}):`);
  for (const bk of brands) {
    console.log(`  ${bk.padEnd(35)} ${byBrand[bk].length} colors`);
  }

  const crossrefs = [];
  let done = 0;
  const total = threads.length;
  const t0 = Date.now();

  console.log(`\nComputing top ${TOP_N} matches per brand pair…`);

  for (const srcBrand of brands) {
    const tgtBrands = brands.filter(b => b !== srcBrand);
    for (const src of byBrand[srcBrand]) {
      for (const tgtBrand of tgtBrands) {
        const dists = [];
        for (const tgt of byBrand[tgtBrand]) {
          const d   = colorDistance(src, tgt); // uses r,g,b directly
          const pct = toPct(d);
          dists.push([d, pct, tgt]);
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
        process.stdout.write(`\r  ${done}/${total} | ${crossrefs.length.toLocaleString()} rows | ${rate.toFixed(0)}/sec | ETA ${eta}s   `);
      }
    }
  }
  console.log(`\n✓ ${crossrefs.length.toLocaleString()} rows in ${((Date.now()-t0)/1000).toFixed(1)}s`);
  return crossrefs;
}

async function insert(crossrefs) {
  const total = crossrefs.length;
  let inserted = 0, failed = 0;
  console.log(`\nInserting ${total.toLocaleString()} rows…`);
  for (let i = 0; i < total; i += INSERT_BATCH_SIZE) {
    const batch = crossrefs.slice(i, i + INSERT_BATCH_SIZE);
    if (await sbPost("thread_crossref", batch)) inserted += batch.length;
    else failed += batch.length;
    if ((i + INSERT_BATCH_SIZE) % 10000 === 0 || i + INSERT_BATCH_SIZE >= total) {
      process.stdout.write(`\r  ${Math.min(i+INSERT_BATCH_SIZE,total).toLocaleString()}/${total.toLocaleString()} inserted…`);
    }
  }
  console.log(`\n✓ ${inserted.toLocaleString()} inserted | ${failed.toLocaleString()} failed`);
}

async function main() {
  console.log("=".repeat(55));
  console.log("  HABERDASH HAVEN — Cross-Reference Generator v2");
  console.log("  Using RGB columns for accurate color matching");
  console.log("=".repeat(55));

  if (process.argv.includes("--regenerate")) {
    console.log("\n⚠  Clearing existing crossref data…");
    await sbDelete("thread_crossref");
    console.log("  ✓ Cleared");
  }

  const threads = await loadThreads();
  if (!threads.length) { console.error("✗ No threads with RGB — run step 41 SQL first"); process.exit(1); }

  const crossrefs = compute(threads);
  await insert(crossrefs);

  console.log("\n" + "=".repeat(55));
  console.log("  Done! thread_crossref rebuilt with RGB accuracy.");
  console.log("=".repeat(55));
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
