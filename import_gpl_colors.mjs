/**
 * HABERDASH HAVEN — InkStitch GPL Color Importer v3
 * ================================================
 * - Loads ALL GPL palettes from InkStitch GitHub
 * - Auto-maps unmatched palettes as new brands
 * - Matches by color code AND name
 * - Outputs SQL to update existing + insert new brands
 *
 * Usage:  node import_gpl_colors.mjs
 */

import fs   from 'fs';
import https from 'https';

const SUPABASE_URL = "https://sbupkbtvaujvwwslqjnd.supabase.co";
const SUPABASE_KEY = "sb_publishable_-EzJs1Sxr6SklOUjZ0j-ow_hc1zHedq";

// Maps GPL filename fragment → existing brand_key in our DB
const EXISTING_BRAND_MAP = {
  "Fil-Tec Glide"            : "glide",
  "Aurifil Mako"             : "aurifil",
  "Aurifil"                  : "aurifil",
  "Anchor"                   : "anchor",
  "Brother Country"          : "brother_embroidery",
  "Brother Embroidery"       : "brother_embroidery",
  "Coats Alcazar Jazz"       : "coats_clark",
  "Coats Alcazar"            : "coats_clark",
  "DMC"                      : "dmc",
  "Floriani Polyester"       : "floriani",
  "FuFu Polyester"           : "fufu_polyester",
  "FuFu Rayon"               : "fufu_rayon",
  "Gunold Polyester"         : "gunold",
  "Gutermann"                : "gutermann",
  "Hemingworth"              : "hemingworth",
  "Isacord Polyester"        : "isacord",
  "Isacord"                  : "isacord",
  "Madeira Polyneon"         : "madeira_polyneon",
  "Madeira Rayon"            : "madeira_rayon",
  "Madeira"                  : "madeira_rayon",
  "Marathon Polyester"       : "marathon",
  "Mettler Embroidery"       : "mettler_silk_finish",
  "Mettler Poly Sheen"       : "mettler_poly_sheen",
  "Mettler"                  : "mettler_poly_sheen",
  "Presencia"                : "presencia",
  "Robison-Anton Polyester"  : "robison_anton_poly",
  "Robison-Anton Rayon"      : "robison_anton_rayon",
  "Robison Anton"            : "robison_anton_poly",
  "Simthread Polyester 63"   : "brother_embroidery",
  "Sulky Rayon"              : "sulky_rayon",
  "Sulky Polyester"          : "sulky_polyester",
  "Sulky"                    : "sulky_rayon",
  "Superior So Fine"         : "superior_so_fine",
  "Superior Omni"            : "superior_omni",
  "Threadart"                : "threadart",
  "Wonderfil Polyester"      : "wonderfil_konfetti",
  "Wonderfil Rayon"          : "wonderfil_splendor",
  "Wonderfil"                : "wonderfil_konfetti",
  "YLI"                      : "yli_hand",
  "Valdani"                  : "valdani",
  "Cosmo"                    : "cosmo",
  "Singer"                   : "singer",
};

// Generates a brand_key from a GPL filename
function toBrandKey(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

// ── HTTP ─────────────────────────────────────────────────────────
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'HaberdashHaven/3.0', 'Accept': 'application/vnd.github.v3+json' }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return get(res.headers.location).then(resolve).catch(reject);
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => res.statusCode >= 400
        ? reject(new Error(`HTTP ${res.statusCode}: ${url}`))
        : resolve(d));
    }).on('error', reject);
  });
}

async function loadAllThreads() {
  const all = [];
  let offset = 0;
  while(true) {
    const url = `${SUPABASE_URL}/rest/v1/thread_library?select=id,brand_key,color_code,color_name,hex_color,r,g,b&limit=1000&offset=${offset}`;
    const res = await new Promise((resolve, reject) => {
      https.get(url, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      }, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d)));
      }).on('error', reject);
    });
    if (!res.length) break;
    all.push(...res);
    if (res.length < 1000) break;
    offset += 1000;
  }
  return all;
}

// ── GPL parser ────────────────────────────────────────────────────
function parseGPL(content) {
  const colors = [];
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || /^(GIMP|Name:|Columns:|#)/.test(t)) continue;
    const m = t.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);
    if (!m) continue;
    const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
    if (r > 255 || g > 255 || b > 255) continue;
    const rest = m[4].trim();
    let colorName, colorCode;
    if (rest.includes('\t')) {
      const parts = rest.split('\t');
      colorCode = parts[parts.length-1].trim();
      colorName = parts.slice(0,-1).join(' ').trim();
    } else {
      const parts = rest.split(/\s+/);
      colorCode = parts[parts.length-1].trim();
      colorName = parts.slice(0,-1).join(' ').trim();
    }
    if (!colorCode || !colorName) continue;
    colors.push({
      r, g, b,
      hex: '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''),
      colorName, colorCode
    });
  }
  return colors;
}

// Detect brand from filename — returns {brandKey, isNew, displayName}
function detectBrand(filename) {
  const clean = filename.replace(/^InkStitch\s+/i,'').replace(/\.gpl$/i,'').trim();
  // Try longest match in existing map
  let best = null, bestLen = 0;
  for (const [pattern, brandKey] of Object.entries(EXISTING_BRAND_MAP)) {
    if (clean.toLowerCase().includes(pattern.toLowerCase()) && pattern.length > bestLen) {
      best = { brandKey, displayName: clean, isNew: false };
      bestLen = pattern.length;
    }
  }
  if (best) return best;
  // Auto-create as new brand
  return { brandKey: toBrandKey(clean), displayName: clean, isNew: true };
}

function norm(s) {
  return (s||'').toLowerCase().trim().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}

function esc(s) { return (s||'').replace(/'/g, "''"); }

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(65));
  console.log("  HABERDASH HAVEN — GPL Color Importer v3");
  console.log("  All palettes → existing updates + new brand inserts");
  console.log("=".repeat(65));

  // 1. Get GPL file list from GitHub
  console.log("\n1. Fetching palette list from InkStitch GitHub…");
  const fileList = JSON.parse(await get(
    'https://api.github.com/repos/inkstitch/inkstitch/contents/palettes'
  ));
  const gplFiles = fileList.filter(f => f.name.endsWith('.gpl'));
  console.log(`   ${gplFiles.length} GPL files found`);

  // 2. Load all threads
  console.log("\n2. Loading all threads from Supabase…");
  const threads = await loadAllThreads();
  console.log(`   ${threads.length} threads loaded`);

  // Build lookups
  const byCode = new Map();
  const byName = new Map();
  const existingBrandKeys = new Set(threads.map(t => t.brand_key));
  for (const t of threads) {
    byCode.set(`${t.brand_key}|${t.color_code}`, t);
    byName.set(`${t.brand_key}|${norm(t.color_name)}`, t);
  }

  // 3. Process each GPL file
  console.log("\n3. Processing GPL palettes…\n");

  const updates   = [];   // RGB updates for existing threads
  const newBrands = {};   // brand_key → {displayName, colors[]}
  const report    = [];

  for (const file of gplFiles) {
    const { brandKey, displayName, isNew } = detectBrand(file.name);

    let content;
    try { content = await get(file.download_url); }
    catch(e) { report.push(`✗ ${file.name}: fetch failed`); continue; }

    const colors = parseGPL(content);
    if (!colors.length) {
      report.push(`✗ ${file.name}: no colors parsed`);
      continue;
    }

    let codeHit = 0, nameHit = 0, newCount = 0;

    for (const c of colors) {
      // Try code match
      let thread = byCode.get(`${brandKey}|${c.colorCode}`);
      if (thread) {
        updates.push({ id: thread.id, r: c.r, g: c.g, b: c.b, hex: c.hex, brandKey });
        codeHit++; continue;
      }
      // Try name match
      thread = byName.get(`${brandKey}|${norm(c.colorName)}`);
      if (thread) {
        updates.push({ id: thread.id, r: c.r, g: c.g, b: c.b, hex: c.hex, brandKey });
        nameHit++; continue;
      }
      // New color / new brand
      newCount++;
    }

    // Collect all colors for brands not in our DB
    if (!existingBrandKeys.has(brandKey)) {
      if (!newBrands[brandKey]) newBrands[brandKey] = { displayName, colors: [] };
      newBrands[brandKey].colors.push(...colors);
    }

    const status = isNew ? '★ NEW' : '✓';
    const line = `${status} ${displayName}: ${colors.length} colors | code:${codeHit} name:${nameHit} new:${newCount}`;
    report.push(line);
    process.stdout.write(`  ${line}\n`);
  }

  // 4. Generate UPDATE SQL
  console.log(`\n4. Writing SQL…`);

  // Group updates by brand
  const byBrand = {};
  for (const u of updates) {
    if (!byBrand[u.brandKey]) byBrand[u.brandKey] = [];
    byBrand[u.brandKey].push(u);
  }

  let updateSQL = `-- HABERDASH HAVEN — GPL Color Updates v3\n`;
  updateSQL += `-- Generated: ${new Date().toISOString()}\n`;
  updateSQL += `-- ${updates.length} threads updated with verified InkStitch RGB values\n\n`;

  for (const [bk, rows] of Object.entries(byBrand)) {
    updateSQL += `-- ── ${bk} (${rows.length} colors) ─────\n`;
    for (const u of rows) {
      updateSQL += `UPDATE thread_library SET r=${u.r}, g=${u.g}, b=${u.b}, hex_color='${u.hex}' WHERE id='${u.id}';\n`;
    }
    updateSQL += '\n';
  }

  // Fix any remaining nulls
  updateSQL += `-- ── Fix remaining nulls via nearest_isacord ──────────────\n`;
  updateSQL += `UPDATE thread_library t\n  SET hex_color=ref.hex_color, r=ref.r, g=ref.g, b=ref.b\n`;
  updateSQL += `  FROM thread_library ref\n  WHERE t.nearest_isacord=ref.color_code\n`;
  updateSQL += `  AND ref.brand_key='isacord' AND ref.r IS NOT NULL AND t.r IS NULL;\n\n`;
  updateSQL += `-- ── Verify ───────────────────────────────────────────────\n`;
  updateSQL += `SELECT brand_key, COUNT(*) total,\n`;
  updateSQL += `  COUNT(*) FILTER (WHERE r IS NULL) missing_rgb\n`;
  updateSQL += `FROM thread_library\n`;
  updateSQL += `GROUP BY brand_key ORDER BY missing_rgb DESC LIMIT 20;\n`;

  fs.writeFileSync('gpl_color_updates.sql', updateSQL);

  // 5. Generate NEW BRANDS SQL
  let newCount = 0;
  let newSQL = `-- HABERDASH HAVEN — New Brands from InkStitch GPL\n`;
  newSQL += `-- Generated: ${new Date().toISOString()}\n`;
  newSQL += `-- Run AFTER gpl_color_updates.sql\n\n`;

  for (const [bk, {displayName, colors}] of Object.entries(newBrands)) {
    newSQL += `-- ── ${displayName} (${colors.length} colors) ─────\n`;
    newSQL += `INSERT INTO thread_library (brand, brand_key, color_code, color_name, hex_color, r, g, b, active)\nVALUES\n`;
    newSQL += colors.map(c =>
      `  ('${esc(displayName)}','${bk}','${esc(c.colorCode)}','${esc(c.colorName)}','${c.hex}',${c.r},${c.g},${c.b},true)`
    ).join(',\n');
    newSQL += '\nON CONFLICT DO NOTHING;\n\n';
    newCount += colors.length;
  }

  fs.writeFileSync('gpl_new_brands.sql', newSQL);

  // 6. Report
  const rpt = [
    "HABERDASH HAVEN — GPL Import Report v3",
    `Generated: ${new Date().toISOString()}`,
    "=".repeat(65),
    `Total palettes processed: ${gplFiles.length}`,
    `Existing threads updated: ${updates.length}`,
    `New brands found:         ${Object.keys(newBrands).length}`,
    `New colors to import:     ${newCount}`,
    "", "=".repeat(65),
    "PALETTE DETAILS (★ = new brand auto-mapped)", "",
    ...report,
    "", "=".repeat(65),
    "NEW BRANDS BEING IMPORTED", "",
    ...Object.entries(newBrands).map(([bk,{displayName,colors}]) =>
      `  ${displayName} (${bk}): ${colors.length} colors`
    )
  ].join('\n');
  fs.writeFileSync('gpl_import_report.txt', rpt);

  console.log(`\n   gpl_color_updates.sql — ${updates.length} updates`);
  console.log(`   gpl_new_brands.sql    — ${newCount} new colors`);
  console.log(`   gpl_import_report.txt — full details`);

  console.log("\n" + "=".repeat(65));
  console.log(`  ✓ ${updates.length} existing threads get accurate RGB`);
  console.log(`  ✓ ${newCount} new colors across ${Object.keys(newBrands).length} new brands`);
  console.log("");
  console.log("  Run in order:");
  console.log("  1. gpl_color_updates.sql  (Supabase SQL Editor)");
  console.log("  2. gpl_new_brands.sql     (Supabase SQL Editor)");
  console.log("  3. node generate_crossref.mjs --regenerate");
  console.log("=".repeat(65));
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
