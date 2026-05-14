import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

// ── Brand tokens (from styles.css) ─────────────────────────────
const T = {
  teal:        "#0D5252",
  tealMid:     "#1A7070",
  tealLight:   "#D6EFEF",
  tealPale:    "#EEF8F8",
  sunGold:     "#E8A800",
  sunPale:     "#FFF8DC",
  sunWash:     "#FFFBEF",
  linen:       "#FDF6E3",
  parchment:   "#F7EDCC",
  ink:         "#1C2B2B",
  inkSoft:     "#2A3D3D",
  muted:       "#5C6E6E",
  warmWhite:   "#FFFEF9",
  borderTeal:  "#B8D8D8",
  borderSun:   "#E0C87A",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,400;1,700&family=Nunito:wght@400;600;700;800&family=Caveat:wght@500;600;700&display=swap');

  .irb-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(13,82,82,0.45);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    animation: irb-fade-in 0.2s ease;
  }
  @keyframes irb-fade-in { from { opacity: 0 } to { opacity: 1 } }

  .irb-modal {
    background: ${T.warmWhite};
    border: 1.5px solid ${T.borderTeal};
    border-radius: 20px;
    width: 100%; max-width: 560px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 16px 48px rgba(13,82,82,0.22), 0 8px 20px rgba(0,0,0,0.10);
    animation: irb-slide-up 0.25s ease;
  }
  @keyframes irb-slide-up { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }

  .irb-header {
    background: linear-gradient(135deg, ${T.teal} 0%, ${T.tealMid} 100%);
    padding: 24px 28px 20px;
    border-radius: 18px 18px 0 0;
    position: relative;
  }
  .irb-header-title {
    font-family: 'Playfair Display', serif;
    font-size: 1.4rem; font-weight: 800;
    color: ${T.warmWhite};
    margin: 0 0 4px;
  }
  .irb-header-sub {
    font-family: 'Caveat', cursive;
    font-size: 1rem; color: rgba(255,248,220,0.85);
    margin: 0;
  }
  .irb-close {
    position: absolute; top: 16px; right: 16px;
    background: rgba(255,255,255,0.15);
    border: none; border-radius: 50%;
    width: 32px; height: 32px;
    color: ${T.warmWhite}; font-size: 1.1rem;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background 0.2s;
  }
  .irb-close:hover { background: rgba(255,255,255,0.28); }

  .irb-body { padding: 24px 28px; }

  .irb-section { margin-bottom: 24px; }
  .irb-section-label {
    font-family: 'Nunito', sans-serif;
    font-size: 0.7rem; font-weight: 800;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: ${T.tealMid}; margin-bottom: 10px;
  }

  .irb-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

  .irb-check-card {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px;
    background: ${T.tealPale};
    border: 1.5px solid ${T.borderTeal};
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: 'Nunito', sans-serif;
    font-size: 0.85rem; font-weight: 700;
    color: ${T.inkSoft};
    user-select: none;
  }
  .irb-check-card:hover { background: ${T.tealLight}; border-color: ${T.tealMid}; }
  .irb-check-card.checked {
    background: ${T.teal}; border-color: ${T.teal};
    color: ${T.warmWhite};
  }
  .irb-check-icon { font-size: 1rem; }

  .irb-project-list {
    display: flex; flex-direction: column; gap: 6px;
    max-height: 180px; overflow-y: auto;
    padding-right: 4px;
  }
  .irb-project-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px;
    background: ${T.sunWash};
    border: 1.5px solid ${T.borderSun};
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: 'Nunito', sans-serif;
    font-size: 0.83rem; font-weight: 600;
    color: ${T.inkSoft};
    user-select: none;
  }
  .irb-project-item:hover { background: ${T.sunPale}; }
  .irb-project-item.checked { background: ${T.sunGold}; border-color: ${T.sunGold}; color: ${T.ink}; }

  .irb-toggle-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px;
    background: ${T.linen};
    border: 1.5px solid ${T.borderSun};
    border-radius: 10px;
  }
  .irb-toggle-label {
    font-family: 'Nunito', sans-serif;
    font-size: 0.85rem; font-weight: 700; color: ${T.inkSoft};
  }
  .irb-toggle-label span {
    display: block; font-size: 0.75rem; font-weight: 600; color: ${T.muted}; margin-top: 1px;
  }
  .irb-toggle {
    position: relative; width: 44px; height: 24px;
    background: ${T.borderTeal}; border-radius: 12px;
    cursor: pointer; transition: background 0.2s; flex-shrink: 0;
  }
  .irb-toggle.on { background: ${T.teal}; }
  .irb-toggle::after {
    content: ''; position: absolute;
    top: 3px; left: 3px;
    width: 18px; height: 18px;
    background: white; border-radius: 50%;
    transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }
  .irb-toggle.on::after { transform: translateX(20px); }

  .irb-input {
    width: 100%; padding: 10px 14px;
    border: 1.5px solid ${T.borderTeal};
    border-radius: 10px;
    background: ${T.warmWhite};
    font-family: 'Nunito', sans-serif;
    font-size: 0.9rem; color: ${T.ink};
    outline: none; box-sizing: border-box;
    transition: border-color 0.2s;
  }
  .irb-input:focus { border-color: ${T.tealMid}; }

  .irb-footer {
    padding: 16px 28px 24px;
    display: flex; gap: 10px; justify-content: flex-end;
    border-top: 1px solid ${T.borderTeal};
  }
  .irb-btn {
    font-family: 'Nunito', sans-serif;
    font-size: 0.9rem; font-weight: 800;
    padding: 10px 22px; border-radius: 10px;
    border: none; cursor: pointer; transition: all 0.15s;
  }
  .irb-btn-secondary {
    background: ${T.tealPale}; color: ${T.teal};
    border: 1.5px solid ${T.borderTeal};
  }
  .irb-btn-secondary:hover { background: ${T.tealLight}; }
  .irb-btn-primary {
    background: linear-gradient(135deg, ${T.teal} 0%, ${T.tealMid} 100%);
    color: ${T.warmWhite};
    box-shadow: 0 4px 16px rgba(13,82,82,0.25);
  }
  .irb-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(13,82,82,0.32); }
  .irb-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  .irb-loading {
    display: flex; flex-direction: column; align-items: center;
    padding: 32px; gap: 12px;
    font-family: 'Nunito', sans-serif; color: ${T.muted}; font-size: 0.9rem;
  }
  .irb-spinner {
    width: 36px; height: 36px;
    border: 3px solid ${T.tealLight};
    border-top-color: ${T.teal};
    border-radius: 50%;
    animation: irb-spin 0.7s linear infinite;
  }
  @keyframes irb-spin { to { transform: rotate(360deg) } }

  /* ── Print stylesheet ── */
  @media print {
    .irb-overlay, .irb-modal { display: none !important; }
    .irb-print-doc { display: block !important; }
  }
  .irb-print-doc { display: none; }
`;

// ── Section config ──────────────────────────────────────────────
const SECTIONS = [
  { key: "threads",   label: "Threads",        icon: "🧵" },
  { key: "machines",  label: "Machines",        icon: "🪡" },
  { key: "feet",      label: "Presser Feet",    icon: "👟" },
  { key: "accuquilt", label: "AccuQuilt",       icon: "✂️" },
  { key: "fabric",    label: "Fabric",          icon: "🧶" },
  { key: "rulers",    label: "Rulers",          icon: "📏" },
  { key: "patterns",  label: "Patterns",        icon: "📋" },
];

// ── Data fetchers ───────────────────────────────────────────────
async function fetchReportData({ userId, sections, projectIds, showValues }) {
  const data = {};

  if (sections.threads) {
    const { data: rows } = await supabase
      .from("user_inventory")
      .select(`spool_count, spool_size, notes, purchase_price, estimated_value, purchase_date,
               thread_library(brand, color_name, color_code, weight)`)
      .eq("user_id", userId);
    data.threads = rows || [];
  }

  if (sections.machines) {
    const { data: rows } = await supabase
      .from("user_machines")
      .select(`nickname, custom_brand, custom_model, serial_number, condition,
               purchase_price, purchase_date, current_value, appraisal_value, appraisal_date,
               insurance_rider, warranty_until, notes, user_notes, repair_history, service_date, service_notes,
               machine_library(brand, model, machine_type)`)
      .eq("user_id", userId);
    data.machines = rows || [];
  }

  if (sections.feet) {
    const { data: rows } = await supabase
      .from("user_feet")
      .select(`quantity, condition, notes, purchase_price, estimated_value, purchase_date,
               feet_library(name, brand, type, compatibility)`)
      .eq("user_id", userId);
    data.feet = rows || [];
  }

  if (sections.accuquilt) {
    const { data: rows } = await supabase
      .from("user_accuquilt")
      .select(`nickname, custom_product_name, serial_number, condition,
               purchase_price, purchase_date, current_value, warranty_until, notes,
               accuquilt_library(name, product_type, sku)`)
      .eq("user_id", userId);
    data.accuquilt = rows || [];
  }

  if (sections.fabric) {
    const { data: rows } = await supabase
      .from("user_fabric")
      .select("*")
      .eq("user_id", userId);
    data.fabric = rows || [];
  }

  if (sections.rulers) {
    const { data: rows } = await supabase
      .from("user_rulers")
      .select(`notes, ruler_library(name, brand, shape, size)`)
      .eq("user_id", userId);
    data.rulers = rows || [];
  }

  if (sections.patterns) {
    const { data: rows } = await supabase
      .from("user_patterns")
      .select(`custom_brand, custom_designer, custom_pattern_name, pattern_number,
               format, is_printed, location, estimated_value, notes,
               patterns_library(name, brand, designer)`)
      .eq("user_id", userId);
    data.patterns = rows || [];
  }

  if (projectIds.length > 0) {
    const { data: rows } = await supabase
      .from("projects")
      .select(`name, project_type, status, start_date, completed_date, due_date,
               estimated_value, sale_price, gifted_to, recipient, notes,
               project_threads(thread_library(brand,color_name,color_code)),
               project_fabrics(fabric_name, yardage),
               project_costs(item, amount)`)
      .eq("user_id", userId)
      .in("id", projectIds);
    data.projects = rows || [];
  }

  return data;
}

// ── PDF/Print generation ────────────────────────────────────────
function buildPrintHTML({ reportData, sections, showValues, ownerName, reportTitle }) {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const fmt = (val) => val != null ? `$${Number(val).toFixed(2)}` : "—";
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US") : "—";

  const sectionHTML = [];

  // Threads
  if (sections.threads && reportData.threads?.length) {
    const total = showValues
      ? reportData.threads.reduce((s, r) => s + (r.estimated_value || r.purchase_price || 0) * (r.spool_count || 1), 0)
      : null;
    sectionHTML.push(`
      <section class="rpt-section">
        <h2>Thread Stash</h2>
        <table>
          <thead><tr>
            <th>Brand</th><th>Color Name</th><th>Code</th><th>Weight</th><th>Spools</th><th>Size</th>
            ${showValues ? "<th>Purchase Price</th><th>Est. Value</th><th>Purchase Date</th>" : ""}
          </tr></thead>
          <tbody>
            ${reportData.threads.map(r => `<tr>
              <td>${r.thread_library?.brand || "—"}</td>
              <td>${r.thread_library?.color_name || "—"}</td>
              <td>${r.thread_library?.color_code || "—"}</td>
              <td>${r.thread_library?.weight || "—"}</td>
              <td>${r.spool_count || 0}</td>
              <td>${r.spool_size || "—"}</td>
              ${showValues ? `<td>${fmt(r.purchase_price)}</td><td>${fmt(r.estimated_value)}</td><td>${fmtDate(r.purchase_date)}</td>` : ""}
            </tr>`).join("")}
          </tbody>
          ${showValues && total ? `<tfoot><tr><td colspan="6"><strong>Total Est. Value</strong></td><td colspan="3"><strong>${fmt(total)}</strong></td></tr></tfoot>` : ""}
        </table>
      </section>`);
  }

  // Machines
  if (sections.machines && reportData.machines?.length) {
    sectionHTML.push(`
      <section class="rpt-section">
        <h2>Machines</h2>
        ${reportData.machines.map(r => {
          const lib = r.machine_library || {};
          const brand = r.custom_brand || lib.brand || "—";
          const model = r.custom_model || lib.model || "—";
          return `<div class="rpt-card">
            <div class="rpt-card-title">${r.nickname ? `${r.nickname} — ` : ""}${brand} ${model}</div>
            <div class="rpt-card-grid">
              <div><span>Type</span>${lib.machine_type || "—"}</div>
              <div><span>Serial #</span>${r.serial_number || "—"}</div>
              <div><span>Condition</span>${r.condition || "—"}</div>
              <div><span>Warranty Until</span>${fmtDate(r.warranty_until)}</div>
              <div><span>Insurance Rider</span>${r.insurance_rider ? "Yes" : "No"}</div>
              <div><span>Last Service</span>${fmtDate(r.service_date)}</div>
              ${showValues ? `
              <div><span>Purchase Price</span>${fmt(r.purchase_price)}</div>
              <div><span>Purchase Date</span>${fmtDate(r.purchase_date)}</div>
              <div><span>Current Value</span>${fmt(r.current_value)}</div>
              <div><span>Appraisal Value</span>${fmt(r.appraisal_value)}</div>
              <div><span>Appraisal Date</span>${fmtDate(r.appraisal_date)}</div>
              ` : ""}
            </div>
            ${r.notes || r.user_notes ? `<div class="rpt-notes"><span>Notes: </span>${r.notes || r.user_notes}</div>` : ""}
            ${r.repair_history ? `<div class="rpt-notes"><span>Repair History: </span>${r.repair_history}</div>` : ""}
            ${r.service_notes ? `<div class="rpt-notes"><span>Service Notes: </span>${r.service_notes}</div>` : ""}
          </div>`;
        }).join("")}
      </section>`);
  }

  // Presser Feet
  if (sections.feet && reportData.feet?.length) {
    sectionHTML.push(`
      <section class="rpt-section">
        <h2>Presser Feet</h2>
        <table>
          <thead><tr>
            <th>Name</th><th>Brand</th><th>Type</th><th>Compatibility</th><th>Qty</th><th>Condition</th>
            ${showValues ? "<th>Purchase Price</th><th>Est. Value</th><th>Purchase Date</th>" : ""}
          </tr></thead>
          <tbody>
            ${reportData.feet.map(r => `<tr>
              <td>${r.feet_library?.name || "—"}</td>
              <td>${r.feet_library?.brand || "—"}</td>
              <td>${r.feet_library?.type || "—"}</td>
              <td>${r.feet_library?.compatibility || "—"}</td>
              <td>${r.quantity || 1}</td>
              <td>${r.condition || "—"}</td>
              ${showValues ? `<td>${fmt(r.purchase_price)}</td><td>${fmt(r.estimated_value)}</td><td>${fmtDate(r.purchase_date)}</td>` : ""}
            </tr>`).join("")}
          </tbody>
        </table>
      </section>`);
  }

  // AccuQuilt
  if (sections.accuquilt && reportData.accuquilt?.length) {
    sectionHTML.push(`
      <section class="rpt-section">
        <h2>AccuQuilt</h2>
        ${reportData.accuquilt.map(r => {
          const lib = r.accuquilt_library || {};
          const name = r.custom_product_name || lib.name || "—";
          return `<div class="rpt-card">
            <div class="rpt-card-title">${r.nickname ? `${r.nickname} — ` : ""}${name}</div>
            <div class="rpt-card-grid">
              <div><span>Type</span>${lib.product_type || "—"}</div>
              <div><span>SKU</span>${lib.sku || "—"}</div>
              <div><span>Serial #</span>${r.serial_number || "—"}</div>
              <div><span>Condition</span>${r.condition || "—"}</div>
              <div><span>Warranty Until</span>${fmtDate(r.warranty_until)}</div>
              ${showValues ? `
              <div><span>Purchase Price</span>${fmt(r.purchase_price)}</div>
              <div><span>Purchase Date</span>${fmtDate(r.purchase_date)}</div>
              <div><span>Current Value</span>${fmt(r.current_value)}</div>
              ` : ""}
            </div>
            ${r.notes ? `<div class="rpt-notes"><span>Notes: </span>${r.notes}</div>` : ""}
          </div>`;
        }).join("")}
      </section>`);
  }

  // Fabric
  if (sections.fabric && reportData.fabric?.length) {
    sectionHTML.push(`
      <section class="rpt-section">
        <h2>Fabric Stash</h2>
        <table>
          <thead><tr>
            <th>Name</th><th>Type</th><th>Manufacturer</th><th>Colorway</th><th>Yardage</th><th>Width</th><th>Condition</th>
            ${showValues ? "<th>Purchase Price</th><th>Est. Value</th>" : ""}
          </tr></thead>
          <tbody>
            ${reportData.fabric.map(r => `<tr>
              <td>${r.custom_name || "—"}</td>
              <td>${r.fabric_type || "—"}</td>
              <td>${r.manufacturer || "—"}</td>
              <td>${r.colorway || r.color_description || "—"}</td>
              <td>${r.yardage ? `${r.yardage} yds` : "—"}</td>
              <td>${r.width_inches ? `${r.width_inches}"` : "—"}</td>
              <td>${r.condition || "—"}</td>
              ${showValues ? `<td>${fmt(r.purchase_price)}</td><td>${fmt(r.estimated_value)}</td>` : ""}
            </tr>`).join("")}
          </tbody>
        </table>
      </section>`);
  }

  // Rulers
  if (sections.rulers && reportData.rulers?.length) {
    sectionHTML.push(`
      <section class="rpt-section">
        <h2>Rulers</h2>
        <table>
          <thead><tr><th>Name</th><th>Brand</th><th>Shape</th><th>Size</th><th>Notes</th></tr></thead>
          <tbody>
            ${reportData.rulers.map(r => `<tr>
              <td>${r.ruler_library?.name || "—"}</td>
              <td>${r.ruler_library?.brand || "—"}</td>
              <td>${r.ruler_library?.shape || "—"}</td>
              <td>${r.ruler_library?.size || "—"}</td>
              <td>${r.notes || "—"}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </section>`);
  }

  // Patterns
  if (sections.patterns && reportData.patterns?.length) {
    sectionHTML.push(`
      <section class="rpt-section">
        <h2>Patterns</h2>
        <table>
          <thead><tr>
            <th>Name</th><th>Designer</th><th>Brand</th><th>Number</th><th>Format</th><th>Printed</th><th>Location</th>
            ${showValues ? "<th>Est. Value</th>" : ""}
          </tr></thead>
          <tbody>
            ${reportData.patterns.map(r => {
              const lib = r.patterns_library || {};
              return `<tr>
                <td>${r.custom_pattern_name || lib.name || "—"}</td>
                <td>${r.custom_designer || lib.designer || "—"}</td>
                <td>${r.custom_brand || lib.brand || "—"}</td>
                <td>${r.pattern_number || "—"}</td>
                <td>${r.format || "—"}</td>
                <td>${r.is_printed ? "Yes" : "No"}</td>
                <td>${r.location || "—"}</td>
                ${showValues ? `<td>${fmt(r.estimated_value)}</td>` : ""}
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </section>`);
  }

  // Projects
  if (reportData.projects?.length) {
    sectionHTML.push(`
      <section class="rpt-section">
        <h2>Projects</h2>
        ${reportData.projects.map(p => `
          <div class="rpt-card">
            <div class="rpt-card-title">${p.name}</div>
            <div class="rpt-card-grid">
              <div><span>Type</span>${p.project_type || "—"}</div>
              <div><span>Status</span>${p.status || "—"}</div>
              <div><span>Started</span>${fmtDate(p.start_date)}</div>
              <div><span>Completed</span>${fmtDate(p.completed_date)}</div>
              ${p.recipient ? `<div><span>Recipient</span>${p.recipient}</div>` : ""}
              ${p.gifted_to ? `<div><span>Gifted To</span>${p.gifted_to}</div>` : ""}
              ${showValues ? `
              <div><span>Est. Value</span>${fmt(p.estimated_value)}</div>
              <div><span>Sale Price</span>${fmt(p.sale_price)}</div>
              ` : ""}
            </div>
            ${p.project_threads?.length ? `<div class="rpt-notes"><span>Threads: </span>${p.project_threads.map(t => `${t.thread_library?.brand} ${t.thread_library?.color_name} (${t.thread_library?.color_code})`).join(", ")}</div>` : ""}
            ${p.project_fabrics?.length ? `<div class="rpt-notes"><span>Fabrics: </span>${p.project_fabrics.map(f => `${f.fabric_name}${f.yardage ? ` — ${f.yardage} yds` : ""}`).join(", ")}</div>` : ""}
            ${p.notes ? `<div class="rpt-notes"><span>Notes: </span>${p.notes}</div>` : ""}
          </div>`).join("")}
      </section>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${reportTitle || "Haberdash Haven — Insurance Inventory Report"}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Nunito:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Nunito', sans-serif; font-size: 12px; color: #1C2B2B; background: white; }

    .rpt-cover {
      padding: 48px 56px 40px;
      background: linear-gradient(135deg, #0D5252 0%, #1A7070 100%);
      color: #FFFEF9;
      page-break-after: always;
    }
    .rpt-cover-logo {
      font-family: 'Playfair Display', serif;
      font-size: 2rem; font-weight: 800; margin-bottom: 4px;
    }
    .rpt-cover-tagline { font-size: 0.9rem; color: rgba(255,248,220,0.8); margin-bottom: 40px; }
    .rpt-cover-title {
      font-family: 'Playfair Display', serif;
      font-size: 1.6rem; font-weight: 700;
      border-top: 2px solid rgba(232,168,0,0.6);
      padding-top: 20px; margin-top: 20px;
    }
    .rpt-cover-meta { margin-top: 12px; font-size: 0.9rem; color: rgba(255,248,220,0.85); }
    .rpt-cover-meta div { margin-top: 4px; }

    .rpt-body { padding: 32px 40px; }

    .rpt-section { margin-bottom: 36px; page-break-inside: avoid; }
    h2 {
      font-family: 'Playfair Display', serif;
      font-size: 1.15rem; font-weight: 800;
      color: #0D5252;
      border-bottom: 2px solid #E8A800;
      padding-bottom: 6px; margin-bottom: 14px;
    }

    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead tr { background: #EEF8F8; }
    th { padding: 7px 10px; text-align: left; font-weight: 800; color: #0D5252; border-bottom: 1.5px solid #B8D8D8; }
    td { padding: 6px 10px; border-bottom: 1px solid #D6EFEF; vertical-align: top; }
    tr:nth-child(even) td { background: #F7FAFA; }
    tfoot td { background: #EEF8F8 !important; font-weight: 700; border-top: 1.5px solid #B8D8D8; }

    .rpt-card {
      border: 1.5px solid #B8D8D8;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 12px;
      background: #FFFEF9;
    }
    .rpt-card-title {
      font-family: 'Playfair Display', serif;
      font-size: 1rem; font-weight: 700;
      color: #0D5252; margin-bottom: 10px;
    }
    .rpt-card-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 12px;
    }
    .rpt-card-grid div { font-size: 11px; }
    .rpt-card-grid span { display: block; font-weight: 800; color: #5C6E6E; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
    .rpt-notes { margin-top: 8px; font-size: 11px; color: #2A3D3D; }
    .rpt-notes span { font-weight: 700; }

    .rpt-footer {
      margin-top: 48px; padding-top: 16px;
      border-top: 1px solid #B8D8D8;
      font-size: 10px; color: #5C6E6E;
      display: flex; justify-content: space-between;
    }

    @media print {
      body { font-size: 11px; }
      .rpt-cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      thead { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="rpt-cover">
    <div class="rpt-cover-logo">Haberdash Haven</div>
    <div class="rpt-cover-tagline">Stitch. Match. Thrive.</div>
    <div class="rpt-cover-title">${reportTitle || "Sewing Room Inventory Report"}</div>
    <div class="rpt-cover-meta">
      ${ownerName ? `<div><strong>Prepared for:</strong> ${ownerName}</div>` : ""}
      <div><strong>Report Date:</strong> ${date}</div>
      ${showValues ? "<div><strong>⚠ Contains estimated values — for insurance purposes</strong></div>" : ""}
    </div>
  </div>
  <div class="rpt-body">
    ${sectionHTML.join("")}
    <div class="rpt-footer">
      <span>Haberdash Haven · Stitch. Match. Thrive.</span>
      <span>Generated ${date}${ownerName ? ` · ${ownerName}` : ""}</span>
    </div>
  </div>
</body>
</html>`;
}

// ── Main Component ──────────────────────────────────────────────
export default function InsuranceReportBuilder({ onClose, userId, showValuesEnabled = false }) {
  const [sections, setSections] = useState({
    threads: true, machines: true, feet: true,
    accuquilt: true, fabric: true, rulers: false, patterns: false,
  });
  const [projects, setProjects] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [showValues, setShowValues] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    // inject styles
    if (!document.getElementById("irb-styles")) {
      const el = document.createElement("style");
      el.id = "irb-styles"; el.textContent = css;
      document.head.appendChild(el);
    }
    // fetch projects list
    supabase.from("projects")
      .select("id, name, status, project_type")
      .eq("user_id", userId)
      .order("name")
      .then(({ data }) => { setProjects(data || []); setLoadingProjects(false); });
  }, [userId]);

  const toggleSection = (key) =>
    setSections(s => ({ ...s, [key]: !s[key] }));

  const toggleProject = (id) =>
    setSelectedProjects(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const anySelected = Object.values(sections).some(Boolean) || selectedProjects.length > 0;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const reportData = await fetchReportData({ userId, sections, projectIds: selectedProjects, showValues });
      const html = buildPrintHTML({ reportData, sections, showValues, ownerName, reportTitle });
      const win = window.open("", "_blank");
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    } catch (e) {
      console.error("Report error:", e);
      alert("Error generating report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="irb-overlay" onClick={(e) => e.target.className === "irb-overlay" && onClose()}>
      <div className="irb-modal">
        <div className="irb-header">
          <p className="irb-header-title">Insurance Inventory Report</p>
          <p className="irb-header-sub">Select what to include in your printout</p>
          <button className="irb-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="irb-loading">
            <div className="irb-spinner" />
            <span>Building your report…</span>
          </div>
        ) : (
          <>
            <div className="irb-body">

              {/* Report details */}
              <div className="irb-section">
                <div className="irb-section-label">Report Details</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input className="irb-input" placeholder="Owner name (optional)"
                    value={ownerName} onChange={e => setOwnerName(e.target.value)} />
                  <input className="irb-input" placeholder='Report title (e.g. "Sewing Room Inventory 2026")'
                    value={reportTitle} onChange={e => setReportTitle(e.target.value)} />
                </div>
              </div>

              {/* Inventory sections */}
              <div className="irb-section">
                <div className="irb-section-label">Inventory to Include</div>
                <div className="irb-grid">
                  {SECTIONS.map(s => (
                    <div key={s.key}
                      className={`irb-check-card ${sections[s.key] ? "checked" : ""}`}
                      onClick={() => toggleSection(s.key)}>
                      <span className="irb-check-icon">{s.icon}</span>
                      {s.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Projects */}
              <div className="irb-section">
                <div className="irb-section-label">Projects (Optional)</div>
                {loadingProjects ? (
                  <div style={{ color: T.muted, fontFamily: "Nunito, sans-serif", fontSize: "0.85rem" }}>Loading projects…</div>
                ) : projects.length === 0 ? (
                  <div style={{ color: T.muted, fontFamily: "Nunito, sans-serif", fontSize: "0.85rem" }}>No projects found.</div>
                ) : (
                  <div className="irb-project-list">
                    {projects.map(p => (
                      <div key={p.id}
                        className={`irb-project-item ${selectedProjects.includes(p.id) ? "checked" : ""}`}
                        onClick={() => toggleProject(p.id)}>
                        <span>{selectedProjects.includes(p.id) ? "☑" : "☐"}</span>
                        <span>{p.name}</span>
                        {p.status && <span style={{ marginLeft: "auto", opacity: 0.7, fontSize: "0.75rem" }}>{p.status}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Show values toggle — only if enabled in settings */}
              {showValuesEnabled && (
                <div className="irb-section">
                  <div className="irb-toggle-row">
                    <div className="irb-toggle-label">
                      Include item values
                      <span>Purchase prices &amp; estimated values</span>
                    </div>
                    <div className={`irb-toggle ${showValues ? "on" : ""}`}
                      onClick={() => setShowValues(v => !v)} />
                  </div>
                </div>
              )}

            </div>

            <div className="irb-footer">
              <button className="irb-btn irb-btn-secondary" onClick={onClose}>Cancel</button>
              <button className="irb-btn irb-btn-primary"
                disabled={!anySelected} onClick={handleGenerate}>
                Generate Report
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
