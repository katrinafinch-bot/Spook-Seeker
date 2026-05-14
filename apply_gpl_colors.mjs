/**
 * HABERDASH HAVEN — Apply GPL Color Updates
 * ==========================================
 * Runs the GPL color updates directly via Supabase REST API.
 * No SQL editor size limits.
 *
 * Run AFTER import_gpl_colors.mjs has generated the data.
 * Usage: node apply_gpl_colors.mjs
 */

import https from 'https';

const SUPABASE_URL = "https://sbupkbtvaujvwwslqjnd.supabase.co";
const SUPABASE_KEY = "sb_publishable_-EzJs1Sxr6SklOUjZ0j-ow_hc1zHedq";
const SUPABASE_SERVICE_KEY = ""; // Leave blank — we use row-level updates via anon key

const HEADERS = {
  "apikey":        SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type":  "application/json",
  "Prefer":        "return=minimal",
};

// ── Supabase helpers ─────────────────────────────────────────────
async function sbGet(table, select, filters = '', limit = 1000, offset = 0) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=${limit}&offset=${offset}${filters ? '&' + filters : ''}`;
  return new Promise((resolve, reject) => {
    https.get(url, { headers: HEADERS }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

async function sbPatch(table, id, data) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = https.request(url, {
      method: 'PATCH',
      headers: { ...HEADERS, 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sbPost(table, rows) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const body = JSON.stringify(rows);
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Prefer': 'resolution=ignore-duplicates,return=minimal',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'HaberdashHaven/3.0', 'Accept': 'application/vnd.github.v3+json' }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return get(res.headers.location).then(resolve).catch(reject);
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => res.statusCode >= 400
        ? reject(new Error(`HTTP ${res.statusCode}`)) : resolve(d));
    }).on('error', reject);
  });
}

// ── Load all threads ─────────────────────────────────────────────
async function loadAllThreads() {
  const all = [];
  let offset = 0;
  while(true) {
    const batch = await sbGet('thread_library', 'id,brand_key,color_code,color_name,hex_color,r,g,b', '', 1000, offset);
    if (!batch.length) break;
    all.push(...batch);
    process.stdout.write(`\r  Loaded ${all.length} threads…`);
    if (batch.length < 1000) break;
    offset += 1000;
  }
  console.log();
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

const EXISTING_BRAND_MAP = {
  "Fil-Tec Glide"           : "glide",
  "Aurifil Mako"            : "aurifil",
  "Aurifil"                 : "aurifil",
  "Anchor"                  : "anchor",
  "Brother Country"         : "brother_embroidery",
  "Brother Embroidery"      : "brother_embroidery",
  "Coats Alcazar Jazz"      : "coats_clark",
  "Coats Alcazar"           : "coats_clark",
  "DMC"                     : "dmc",
  "Floriani Polyester"      : "floriani",
  "FuFu Polyester"          : "fufu_polyester",
  "FuFu Rayon"              : "fufu_rayon",
  "Gunold Polyester"        : "gunold",
  "Gutermann"               : "gutermann",
  "Hemingworth"             : "hemingworth",
  "Isacord Polyester"       : "isacord",
  "Isacord"                 : "isacord",
  "Madeira Polyneon"        : "madeira_polyneon",
  "Madeira Rayon"           : "madeira_rayon",
  "Madeira"                 : "madeira_rayon",
  "Marathon Polyester"      : "marathon",
  "Mettler Embroidery"      : "mettler_silk_finish",
  "Mettler Poly Sheen"      : "mettler_poly_sheen",
  "Mettler"                 : "mettler_poly_sheen",
  "Presencia"               : "presencia",
  "Robison-Anton Polyester" : "robison_anton_poly",
  "Robison-Anton Rayon"     : "robison_anton_rayon",
  "Robison Anton"           : "robison_anton_poly",
  "Sulky Rayon"             : "sulky_rayon",
  "Sulky Polyester"         : "sulky_polyester",
  "Sulky"                   : "sulky_rayon",
  "Superior So Fine"        : "superior_so_fine",
  "Superior Omni"           : "superior_omni",
  "Threadart"               : "threadart",
  "Wonderfil Polyester"     : "wonderfil_konfetti",
  "Wonderfil Rayon"         : "wonderfil_splendor",
  "Wonderfil"               : "wonderfil_konfetti",
  "YLI"                     : "yli_hand",
  "Valdani"                 : "valdani",
  "Cosmo"                   : "cosmo",
  "Singer"                  : "singer",
};

function toBrandKey(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,50);
}

function detectBrand(filename) {
  const clean = filename.replace(/^InkStitch\s+/i,'').replace(/\.gpl$/i,'').trim();
  let best = null, bestLen = 0;
  for (const [pattern, brandKey] of Object.entries(EXISTING_BRAND_MAP)) {
    if (clean.toLowerCase().includes(pattern.toLowerCase()) && pattern.length > bestLen) {
      best = { brandKey, displayName: clean, isNew: false };
      bestLen = pattern.length;
    }
  }
  return best || { brandKey: toBrandKey(clean), displayName: clean, isNew: true };
}

function norm(s) {
  return (s||'').toLowerCase().trim().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const doUpdates  = !args.includes('--new-only');
  const doNewBrands = !args.includes('--updates-only');

  console.log("=".repeat(65));
  console.log("  HABERDASH HAVEN — Apply GPL Colors (Direct API)");
  console.log("=".repeat(65));

  // Load palettes from GitHub
  console.log("\n1. Fetching GPL palette list…");
  const fileList = JSON.parse(await get(
    'https://api.github.com/repos/inkstitch/inkstitch/contents/palettes'
  ));
  const gplFiles = fileList.filter(f => f.name.endsWith('.gpl'));
  console.log(`   ${gplFiles.length} GPL files`);

  // Load all threads
  console.log("\n2. Loading threads from Supabase…");
  const threads = await loadAllThreads();
  console.log(`   ${threads.length} threads`);

  const byCode = new Map();
  const byName = new Map();
  const existingBrandKeys = new Set(threads.map(t => t.brand_key));

  for (const t of threads) {
    byCode.set(`${t.brand_key}|${t.color_code}`, t);
    byName.set(`${t.brand_key}|${norm(t.color_name)}`, t);
  }

  // Process GPL files
  console.log("\n3. Processing palettes and matching colors…");
  const updates   = [];
  const newBrands = {};

  for (const file of gplFiles) {
    const { brandKey, displayName, isNew } = detectBrand(file.name);
    let content;
    try { content = await get(file.download_url); }
    catch(e) { console.log(`  ✗ ${file.name}: fetch failed`); continue; }

    const colors = parseGPL(content);
    if (!colors.length) continue;

    for (const c of colors) {
      const thread = byCode.get(`${brandKey}|${c.colorCode}`)
                  || byName.get(`${brandKey}|${norm(c.colorName)}`);
      if (thread) {
        updates.push({ id: thread.id, r: c.r, g: c.g, b: c.b, hex_color: c.hex });
      }
    }

    if (!existingBrandKeys.has(brandKey)) {
      if (!newBrands[brandKey]) newBrands[brandKey] = { displayName, colors: [] };
      newBrands[brandKey].colors.push(...colors);
    }

    process.stdout.write(`  ✓ ${displayName}: ${colors.length} colors\n`);
  }

  // ── Apply updates to existing threads ────────────────────────
  if (doUpdates && updates.length > 0) {
    console.log(`\n4. Applying ${updates.length} RGB updates to existing threads…`);
    const BATCH = 200;
    let done = 0, failed = 0;

    for (let i = 0; i < updates.length; i += BATCH) {
      const batch = updates.slice(i, i + BATCH);
      // Use upsert-style PATCH for each item
      const promises = batch.map(u =>
        sbPatch('thread_library', u.id, { r: u.r, g: u.g, b: u.b, hex_color: u.hex_color })
          .then(status => { if (status === 204 || status === 200) done++; else failed++; })
          .catch(() => failed++)
      );
      await Promise.all(promises);

      if ((i + BATCH) % 1000 === 0 || i + BATCH >= updates.length) {
        process.stdout.write(`\r  ${Math.min(i+BATCH, updates.length)}/${updates.length} updated…`);
      }
    }
    console.log(`\n  ✓ ${done} updated | ${failed} failed`);
  }

  // ── Insert new brands ────────────────────────────────────────
  if (doNewBrands && Object.keys(newBrands).length > 0) {
    const totalNew = Object.values(newBrands).reduce((a,b) => a + b.colors.length, 0);
    console.log(`\n5. Inserting ${totalNew} new colors across ${Object.keys(newBrands).length} new brands…`);
    const INSERT_BATCH = 100;
    let inserted = 0, failed = 0;

    for (const [brandKey, {displayName, colors}] of Object.entries(newBrands)) {
      process.stdout.write(`  Inserting ${displayName} (${colors.length} colors)…`);
      let brandInserted = 0;

      for (let i = 0; i < colors.length; i += INSERT_BATCH) {
        const batch = colors.slice(i, i + INSERT_BATCH).map(c => ({
          brand:      displayName,
          brand_key:  brandKey,
          color_code: c.colorCode,
          color_name: c.colorName,
          hex_color:  c.hex,
          r:          c.r,
          g:          c.g,
          b:          c.b,
          active:     true,
        }));

        const result = await sbPost('thread_library', batch);
        if (result.status === 201 || result.status === 200) {
          brandInserted += batch.length;
          inserted += batch.length;
        } else {
          failed += batch.length;
        }
      }
      console.log(` ${brandInserted} done`);
    }
    console.log(`  ✓ ${inserted} inserted | ${failed} failed`);
  }

  // Fix any remaining nulls via nearest_isacord
  console.log("\n6. Fixing remaining null RGB via nearest_isacord…");
  const remaining = await sbGet('thread_library', 'id,nearest_isacord', 'r=is.null&nearest_isacord=not.is.null');
  console.log(`   ${remaining.length} threads still need RGB`);

  if (remaining.length > 0) {
    // Load Isacord hex map
    const isacord = await sbGet('thread_library', 'color_code,hex_color,r,g,b', 'brand_key=eq.isacord', 500);
    const iMap = new Map(isacord.map(t => [t.color_code, t]));

    let fixed = 0;
    for (const t of remaining) {
      const ref = iMap.get(t.nearest_isacord);
      if (ref && ref.r != null) {
        await sbPatch('thread_library', t.id, { r: ref.r, g: ref.g, b: ref.b, hex_color: ref.hex_color });
        fixed++;
      }
    }
    console.log(`   ✓ Fixed ${fixed} threads from nearest_isacord`);
  }

  console.log("\n" + "=".repeat(65));
  console.log("  ALL DONE!");
  console.log("  Now run:  node generate_crossref.mjs --regenerate");
  console.log("=".repeat(65));
}

main().catch(e => { console.error("\nFatal:", e.message); process.exit(1); });
