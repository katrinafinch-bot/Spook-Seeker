import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import starterThreads from "./data/thread-library.json";
import { t, LANGUAGES, getColorFamilies } from "./i18n.js";
import { ProjectsTab } from "./ProjectsTab.jsx";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const APP_VERSION = "3.0.0";
const LOCAL_LIBRARY_KEY = "spool_seeker_thread_library";
const LOCAL_SYNC_META   = "spool_seeker_sync_meta";

// English keys — NEVER change these, they are used internally for comparison
const COLOR_FAMILY_KEYS = [
  "All","Whites & Creams","Yellows & Golds","Oranges","Reds","Pinks & Magentas",
  "Purples & Lavenders","Blues","Teals & Aquas","Greens","Browns & Tans",
  "Greys & Blacks","Specialty & Variegated"
];

const threadBrands = [
  ["Isacord","isacord"],["Glide","glide"],["Floriani","floriani"],
  ["Madeira Polyneon","madeira"],["Sulky","sulky"],["Aurifil","aurifil"],
  ["Omni","omni"],["King Tut","king_tut"],["So Fine","so_fine"],
  ["Gutermann","gutermann"],["Mettler","mettler"],
  ["Robison-Anton","robison_anton"],["Coats & Clark","coats_clark"],
];

// Map from UI brand label → brand_key in thread_library_all
const brandKeyMap = {
  "Isacord":          "isacord",
  "Glide":            "glide",
  "Floriani":         "floriani",
  "Madeira Polyneon": "madeira",
  "Sulky":            "sulky",
  "Aurifil":          "aurifil",
  "Omni":             "omni",
  "King Tut":         "king_tut",
  "So Fine":          "so_fine",
  "Gutermann":        "gutermann",
  "Mettler":          "mettler",
  "Robison-Anton":    "robisonAnton",
  "Coats & Clark":    "coats_clark",
};

const fabricBrands = [
  ["Kona Cotton","kona"],["Bella Solids","bella"],["AGF Pure Solids","agf"],
  ["FreeSpirit","freespirit"],["Michael Miller","michaelMiller"],
  ["Windham","windham"],["Clothworks","clothworks"],["Hoffman","hoffman"],
];

const commonSpoolSizes = ["Mini Cone","Small Spool","Medium Spool","Large Cone","500m","1000m","1100 yd","3000 yd","5000m"];
const emptyForm = { name:"",family:"Unsorted",isacord:"",barcode:"",weight:"40 wt",spools:"1",inventoryTarget:"2",spoolSize:"1000m",swatch:"#0F766E" };
const emptyProject = { name:"",status:"Planning",notes:"" };

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function versionCompare(a,b){
  const pa=String(a||"0.0.0").split(".").map(n=>parseInt(n,10)||0);
  const pb=String(b||"0.0.0").split(".").map(n=>parseInt(n,10)||0);
  for(let i=0;i<Math.max(pa.length,pb.length);i++){
    const av=pa[i]||0,bv=pb[i]||0;
    if(av>bv)return 1;if(av<bv)return -1;
  }
  return 0;
}
function normalized(v){ return String(v||"").toLowerCase(); }
function hexToRgb(hex){
  const c=String(hex||"").replace("#","");
  if(c.length!==6)return null;
  return{r:parseInt(c.slice(0,2),16),g:parseInt(c.slice(2,4),16),b:parseInt(c.slice(4,6),16)};
}
function colorDistance(a,b){
  if(!a||!b)return Number.MAX_SAFE_INTEGER;
  const dr=a.r-b.r,dg=a.g-b.g,db=a.b-b.b;
  return Math.sqrt(dr*dr+dg*dg+db*db);
}

// Find nearest color in a given brand by hex distance
function findNearestInBrand(hexOrThread, targetBrandKey, allThreads){
  if(!targetBrandKey||!allThreads.length) return null;
  // Get source RGB — prefer r,g,b columns, fall back to hex
  let srcRgb;
  if(hexOrThread && typeof hexOrThread==="object" && hexOrThread.r!=null){
    srcRgb = {r:hexOrThread.r, g:hexOrThread.g, b:hexOrThread.b};
  } else {
    srcRgb = hexToRgb(typeof hexOrThread==="string" ? hexOrThread : hexOrThread?.hex_color);
  }
  if(!srcRgb) return null;
  let best = null, bestDist = Infinity;
  for(const t of allThreads){
    if(t.brand_key !== targetBrandKey) continue;
    // Use r,g,b if available, else parse hex
    const tRgb = t.r!=null ? {r:t.r,g:t.g,b:t.b} : hexToRgb(t.hex_color);
    if(!tRgb) continue;
    const dist = colorDistance(srcRgb, tRgb);
    if(dist < bestDist){ bestDist = dist; best = t; }
  }
  return best;
}

// Always returns an ENGLISH key from COLOR_FAMILY_KEYS — never a translated string
// Accepts a hex string, OR a thread object with r/g/b or hex_color fields
function hexToFamilyKey(hexOrThread){
  let rgb;
  if(hexOrThread && typeof hexOrThread==="object"){
    // Prefer r,g,b integer columns — most accurate, no parsing needed
    if(hexOrThread.r!=null && hexOrThread.g!=null && hexOrThread.b!=null){
      rgb={r:hexOrThread.r, g:hexOrThread.g, b:hexOrThread.b};
    } else {
      // Fall back to hex_color string
      rgb=hexToRgb(hexOrThread.hex_color||hexOrThread.hex||hexOrThread.swatch);
    }
  } else {
    rgb=hexToRgb(hexOrThread);
  }
  if(!rgb)return "Specialty & Variegated";
  const{r,g,b}=rgb;
  const max=Math.max(r,g,b),min=Math.min(r,g,b);
  const l=(max+min)/2;
  const chroma=max-min;
  if(chroma<20){
    if(l>210)return "Whites & Creams";
    return "Greys & Blacks";
  }
  if(l>210&&chroma<60)return "Whites & Creams";
  let h;
  if(max===r)      h=((g-b)/chroma+6)%6;
  else if(max===g) h=(b-r)/chroma+2;
  else             h=(r-g)/chroma+4;
  h=h*60;
  if(h<15||h>=345) return "Reds";
  if(h<38)         return "Oranges";
  if(h<65)         return "Yellows & Golds";
  if(h<150)        return "Greens";
  if(h<185)        return "Teals & Aquas";
  if(h<260)        return "Blues";
  if(h<290)        return "Purples & Lavenders";
  if(h<345)        return "Pinks & Magentas";
  return "Specialty & Variegated";
}

// ─────────────────────────────────────────────────────────────
// MACHINE STASH SECTION
// ─────────────────────────────────────────────────────────────
function MachineStashSection({ machines, supabase, userId, onRefresh }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState({});
  const [saving, setSaving]   = useState(false);

  function openEdit(item){
    // Use machine_id (FK on user_machines) as the stable edit key
    setEditing(item.machine_id||item.machine_library?.id);
    setForm({
      serial_number: item.serial_number||"",
      purchase_date: item.purchase_date||"",
      purchase_price:item.purchase_price||"",
      dealer:        item.dealer||"",
      warranty_until:item.warranty_until||"",
      user_notes:    item.user_notes||"",
    });
  }

  async function saveEdit(machineId){
    if(!supabase||!userId)return;
    setSaving(true);
    const{error}=await supabase.from("user_machines").update({
      serial_number: form.serial_number||null,
      purchase_date: form.purchase_date||null,
      purchase_price:form.purchase_price?parseFloat(form.purchase_price):null,
      dealer:        form.dealer||null,
      warranty_until:form.warranty_until||null,
      user_notes:    form.user_notes||null,
    }).eq("user_id",userId).eq("machine_id",machineId);
    if(error) console.error("Save machine details error:",error);
    setSaving(false);
    setEditing(null);
    onRefresh&&onRefresh();
  }

  async function removeMachine(machineId){
    if(!supabase||!userId)return;
    await supabase.from("user_machines").delete().eq("user_id",userId).eq("machine_id",machineId);
    onRefresh&&onRefresh();
  }

  if(machines.length===0)return(
    <div className="card"><h2>My Machines</h2><p className="muted">No machines yet — browse in More → Machines.</p></div>
  );

  return(
    <div className="card">
      <h2>My Machines ({machines.length})</h2>
      {machines.map((item,i)=>{
        const m=item.machine_library; if(!m)return null;
        const machineId=item.machine_id||m.id;
        const isEditing=editing===machineId;
        const hasDetails=item.serial_number||item.purchase_date||item.dealer||item.warranty_until||item.purchase_price;
        return(
          <div key={i} className="sub-card" style={{marginBottom:12}}>

            {/* ── Machine header ── */}
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
              <div style={{flex:1}}>
                <div style={{marginBottom:4}}>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:6,
                    background:"var(--sun-pale)",color:"var(--teal)",
                    border:"1px solid var(--border-sun)",display:"inline-block"}}>
                    {m.type}
                  </span>
                </div>
                <div className="thread-name">{m.brand} {m.model}</div>
                <div className="muted" style={{fontSize:12}}>{m.category}{m.throat_space?` · ${m.throat_space}" throat`:""}</div>

                {/* Detail chips — visible when not editing */}
                {!isEditing&&hasDetails&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:8}}>
                    {item.serial_number&&<span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:6,background:"var(--teal-pale)",color:"var(--teal)",border:"1px solid var(--border-teal)"}}>S/N: {item.serial_number}</span>}
                    {item.purchase_date&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:6,background:"var(--leaf-wash)",color:"var(--leaf)",border:"1px solid var(--leaf-light)"}}>📅 {item.purchase_date}</span>}
                    {item.purchase_price&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:6,background:"var(--linen)",color:"var(--muted-warm)",border:"1px solid var(--border-warm)"}}>💰 ${parseFloat(item.purchase_price).toFixed(2)}</span>}
                    {item.dealer&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:6,background:"var(--sky-wash)",color:"var(--sky-cobalt)",border:"1px solid var(--sky-pale)"}}>🏪 {item.dealer}</span>}
                    {item.warranty_until&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:6,background:"var(--sun-wash)",color:"var(--sun-amber)",border:"1px solid var(--border-sun)"}}>🛡 warranty to {item.warranty_until}</span>}
                  </div>
                )}
                {!isEditing&&item.user_notes&&(
                  <div style={{fontSize:12,color:"var(--muted-warm)",marginTop:6,fontStyle:"italic",
                    borderLeft:"3px solid var(--border-sun)",paddingLeft:8,lineHeight:1.4}}>
                    {item.user_notes}
                  </div>
                )}
                {!isEditing&&!hasDetails&&(
                  <div className="muted" style={{fontSize:11,marginTop:5}}>
                    Tap ✎ Edit to add serial number, purchase info &amp; notes
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div style={{display:"flex",flexDirection:"column",gap:5,flexShrink:0}}>
                <button className={`btn ${isEditing?"active":""}`}
                  style={{fontSize:11,padding:"6px 11px"}}
                  onClick={()=>isEditing?setEditing(null):openEdit(item)}>
                  {isEditing?"✕ Cancel":"✎ Edit"}
                </button>
                {!isEditing&&(
                  <button className="btn"
                    style={{fontSize:11,padding:"6px 11px",color:"#C0392B",borderColor:"#C0392B"}}
                    onClick={()=>removeMachine(machineId)}>
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* ── Edit form — expands below ── */}
            {isEditing&&(
              <div style={{
                marginTop:14,paddingTop:14,
                borderTop:"1.5px solid var(--border-teal)",
              }}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:700,
                  color:"var(--teal)",marginBottom:12}}>
                  Edit — {m.brand} {m.model}
                </div>

                <label style={{fontSize:12}}>Serial Number
                  <input className="input" value={form.serial_number}
                    onChange={e=>setForm({...form,serial_number:e.target.value})}
                    placeholder="Found on machine plate (usually bottom or back)"/>
                </label>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <label style={{fontSize:12}}>Purchase Date
                    <input className="input" type="date" value={form.purchase_date}
                      onChange={e=>setForm({...form,purchase_date:e.target.value})}/>
                  </label>
                  <label style={{fontSize:12}}>Purchase Price ($)
                    <input className="input" type="number" step="0.01" value={form.purchase_price}
                      onChange={e=>setForm({...form,purchase_price:e.target.value})}
                      placeholder="For insurance"/>
                  </label>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <label style={{fontSize:12}}>Dealer / Shop
                    <input className="input" value={form.dealer}
                      onChange={e=>setForm({...form,dealer:e.target.value})}
                      placeholder="Where you bought it"/>
                  </label>
                  <label style={{fontSize:12}}>Warranty Expiry
                    <input className="input" type="date" value={form.warranty_until}
                      onChange={e=>setForm({...form,warranty_until:e.target.value})}/>
                  </label>
                </div>

                <label style={{fontSize:12}}>Notes
                  <input className="input" value={form.user_notes}
                    onChange={e=>setForm({...form,user_notes:e.target.value})}
                    placeholder="Service history, quirks, mods, storage location…"/>
                </label>

                <button className="btn active" style={{width:"100%",marginTop:4}}
                  onClick={()=>saveEdit(machineId)} disabled={saving}>
                  {saving?"Saving…":"✓ Save Details"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// UNIVERSAL STASH
// ─────────────────────────────────────────────────────────────
function UniversalStash({ supabase, userId, shoppingList, mergedShoppingList, threads,
  updateSpools, updateInventoryTarget, addManualShoppingItem, removeShoppingItem, settings }) {
  const [activeSection, setActiveSection] = useState("threads");
  const [stash, setStash] = useState({threads:[],rulers:[],machines:[],dies:[],feet:[],accessories:[]});
  const [counts, setCounts] = useState({threads:0,rulers:0,machines:0,dies:0,feet:0,accessories:0});
  const [loading, setLoading] = useState(true);
  // Accessories state
  const [accForm, setAccForm]   = useState({name:"",quantity:"1",notes:""});
  const [showAccForm, setShowAccForm] = useState(false);

  const fetchAll = useCallback(async()=>{
    if(!supabase||!userId)return;
    setLoading(true);
    try{
      const [{data:th},{data:ru},{data:ma},{data:di},{data:fe}] = await Promise.all([
        supabase.from("user_inventory").select("spool_count,thread_library(id,brand,brand_key,color_code,color_name,hex_color,fiber_type,weight)").eq("user_id",userId),
        supabase.from("user_rulers").select("quantity,ruler_library(brand,model,shape,size_inches,material)").eq("user_id",userId),
        supabase.from("user_machines").select("machine_id,serial_number,purchase_date,purchase_price,dealer,warranty_until,user_notes,machine_library(id,brand,model,type,category,throat_space,fun_fact,is_computerized)").eq("user_id",userId),
        supabase.from("user_dies").select("quantity,machine_library(id,brand,model,type,category)").eq("user_id",userId),
        supabase.from("user_feet").select("quantity,feet_library(brand,foot_name,category,shank_type)").eq("user_id",userId),
      ]);
      // Accessories — stored in localStorage for now
      const savedAcc = JSON.parse(localStorage.getItem("hh_accessories")||"[]");
      const s={threads:th||[],rulers:ru||[],machines:ma||[],dies:di||[],feet:fe||[],accessories:savedAcc};
      setStash(s);
      setCounts({threads:s.threads.length,rulers:s.rulers.length,machines:s.machines.length,dies:s.dies.length,feet:s.feet.length,accessories:s.accessories.length});
    }catch(e){console.error("Stash fetch:",e);}
    setLoading(false);
  },[supabase,userId]);

  useEffect(()=>{ fetchAll(); },[fetchAll]);

  function saveAccessory(){
    if(!accForm.name.trim())return;
    const newAcc={id:Date.now(),...accForm,quantity:parseInt(accForm.quantity)||1};
    const updated=[...stash.accessories,newAcc];
    localStorage.setItem("hh_accessories",JSON.stringify(updated));
    setStash(s=>({...s,accessories:updated}));
    setCounts(c=>({...c,accessories:updated.length}));
    setAccForm({name:"",quantity:"1",notes:""});
    setShowAccForm(false);
  }

  function removeAccessory(id){
    const updated=stash.accessories.filter(a=>a.id!==id);
    localStorage.setItem("hh_accessories",JSON.stringify(updated));
    setStash(s=>({...s,accessories:updated}));
    setCounts(c=>({...c,accessories:updated.length}));
  }

  const catColors={
    Quilting:{bg:"#E8F0FF",text:"#0047AB"},Garment:{bg:"#E0F5EC",text:"#1A6B4A"},
    Embroidery:{bg:"#F3EAF8",text:"#6B3FA0"},Serging:{bg:"#FFF8E1",text:"#5C4A1E"},
    Specialty:{bg:"#FDECEA",text:"#C0392B"},General:{bg:"#F5F5F5",text:"#888"},
  };

  const sections=[
    {key:"threads",label:"Threads",emoji:"🧵"},
    {key:"rulers",label:"Rulers",emoji:"📐"},
    {key:"machines",label:"Machines",emoji:"⚙️"},
    {key:"dies",label:"AccuQuilt",emoji:"◈"},
    {key:"feet",label:"Feet",emoji:"👟"},
    {key:"accessories",label:"Accessories",emoji:"✦"},
  ];

  const totalItems=Object.values(counts).reduce((a,b)=>a+b,0);

  // Use Supabase stash threads if signed in, else local threads
  const useSupaStash = supabase&&userId;

  if(loading)return<div className="card"><p className="muted">Loading your stash…</p></div>;

  return(
    <div>
      <div className="stash-banner">
        <h2>Your Stash</h2>
        <span className="count-chip">{totalItems} items</span>
      </div>

      {/* Section pills */}
      <div className="section-pills">
        {sections.map(s=>(
          <button key={s.key} className={`section-pill ${activeSection===s.key?"active":""}`}
            onClick={()=>setActiveSection(s.key)}>
            {s.emoji} {s.label} ({counts[s.key]})
          </button>
        ))}
      </div>

      {/* ── THREADS ── */}
      {activeSection==="threads"&&(
        useSupaStash?(
          <div className="card">
            <h2>Threads ({counts.threads})</h2>
            {stash.threads.length===0
              ?<p className="muted">No threads yet — use the Match tab to find and add threads.</p>
              :stash.threads.map((item,i)=>{
                // Support both thread_library (Isacord) and thread_library_all (all brands)
                const th = item.thread_library;
                if(!th) return null;
                const hex = th.hex_color || "#CCC";
                const spools = item.spool_count || 1;
                return(
                  <div key={i} className="thread-row" style={{borderBottom:"1px solid var(--border-teal)",paddingBottom:8,marginBottom:8}}>
                    <div className="swatch" style={{background:hex}}/>
                    <div>
                      <div className="thread-name">{th.brand} {th.color_code} — {th.color_name}</div>
                      <div className="muted">{th.fiber_type||""} · {spools} {spools===1?"spool":"spools"}</div>
                    </div>
                  </div>
                );
              })
            }
          </div>
        ):(
          <>
            <div className="card">
              <h2>Shopping List</h2>
              {mergedShoppingList.length===0
                ?<p className="muted">Your shopping list is empty.</p>
                :mergedShoppingList.map(item=>(
                  <div key={item.id} className="sub-card" style={{display:"flex",alignItems:"flex-start",gap:10}}>
                    {item.hex_color&&<div style={{width:36,height:36,borderRadius:"50%",flexShrink:0,background:item.hex_color,border:"2px solid rgba(255,255,255,0.6)",boxShadow:"0 2px 6px rgba(0,0,0,0.15)"}}/>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13}}>{item.brand&&`${item.brand} `}{item.code} — {item.name}</div>
                      {item.fiber_type&&<div className="muted" style={{fontSize:11}}>{item.fiber_type} {item.weight}</div>}
                      <div className="muted" style={{fontSize:11}}>Qty: {item.qty}</div>
                    </div>
                    <button className="btn" style={{fontSize:11,padding:"4px 8px",color:"#C0392B",borderColor:"#C0392B",flexShrink:0}} onClick={()=>removeShoppingItem(item.id)}>✕</button>
                  </div>
                ))
              }
            </div>
            {threads.map(thread=>(
              <div key={thread.id} className="card">
                <div className="thread-row">
                  <div className="swatch" style={{background:thread.swatch}}/>
                  <div>
                    <div className="thread-name">{thread.name} {thread.isacord?`(${thread.isacord})`:""}</div>
                    <div className="muted">{thread.spools} spool(s) · {thread.spoolSize} · Target {thread.inventoryTarget||0}</div>
                  </div>
                </div>
                <label>Inventory Target<input className="input" type="number" value={thread.inventoryTarget||0} onChange={e=>updateInventoryTarget(thread.id,e.target.value)}/></label>
                <div className="button-row">
                  <button className="btn" onClick={()=>updateSpools(thread.id,1)}>+ Add Spool</button>
                  <button className="btn" onClick={()=>updateSpools(thread.id,-1)}>- Remove</button>
                  <button className="btn" onClick={()=>addManualShoppingItem(thread)}>Shopping List</button>
                </div>
              </div>
            ))}
          </>
        )
      )}

      {/* ── RULERS ── */}
      {activeSection==="rulers"&&(
        <div className="card">
          <h2>Rulers ({counts.rulers})</h2>
          {stash.rulers.length===0
            ?<p className="muted">No rulers yet — browse in More → Rulers.</p>
            :stash.rulers.map((item,i)=>{
              const r=item.ruler_library;if(!r)return null;
              return<div key={i} className="sub-card"><b>{r.brand} — {r.model}</b><p className="muted">{r.shape} · {r.size_inches} · {r.material}</p></div>;
            })
          }
        </div>
      )}

      {/* ── MACHINES ── */}
      {activeSection==="machines"&&(
        <MachineStashSection machines={stash.machines} supabase={supabase} userId={userId} onRefresh={fetchAll}/>
      )}

      {/* ── ACCUQUILT DIES ── */}
      {activeSection==="dies"&&(
        <div className="card">
          <h2>AccuQuilt Dies ({counts.dies})</h2>
          {stash.dies.length===0
            ?<p className="muted">No dies yet — browse in More → AccuQuilt.</p>
            :stash.dies.map((item,i)=>{
              const d=item.machine_library;if(!d)return null;
              return<div key={i} className="sub-card"><b>{d.model}</b><p className="muted">AccuQuilt · {d.category}</p></div>;
            })
          }
        </div>
      )}

      {/* ── FEET ── */}
      {activeSection==="feet"&&(
        <div className="card">
          <h2>Presser Feet ({counts.feet})</h2>
          {stash.feet.length===0
            ?<p className="muted">No feet yet — browse in More → Presser Feet.</p>
            :stash.feet.map((item,i)=>{
              const f=item.feet_library;if(!f)return null;
              const c=catColors[f.category]||catColors.General;
              return(
                <div key={i} className="sub-card" style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:8,background:c.bg,color:c.text,flexShrink:0}}>{f.category}</span>
                  <div><div className="thread-name">{f.foot_name}</div><div className="muted">{f.brand} · {f.shank_type}</div></div>
                </div>
              );
            })
          }
        </div>
      )}

      {/* ── ACCESSORIES ── */}
      {activeSection==="accessories"&&(
        <div className="card">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <h2 style={{margin:0}}>Accessories ({counts.accessories})</h2>
            <button className="btn active" style={{fontSize:12}} onClick={()=>setShowAccForm(v=>!v)}>
              {showAccForm?"Cancel":"+ Add"}
            </button>
          </div>
          {showAccForm&&(
            <div className="sub-card" style={{marginBottom:12}}>
              <label style={{fontSize:12}}>Item name
                <input className="input" value={accForm.name} onChange={e=>setAccForm({...accForm,name:e.target.value})}
                  placeholder="e.g. Seam ripper, bobbins, needles, glue pen…"/>
              </label>
              <label style={{fontSize:12}}>Quantity
                <input className="input" type="number" value={accForm.quantity} onChange={e=>setAccForm({...accForm,quantity:e.target.value})} style={{marginBottom:8}}/>
              </label>
              <label style={{fontSize:12}}>Notes
                <input className="input" value={accForm.notes} onChange={e=>setAccForm({...accForm,notes:e.target.value})} placeholder="Brand, size, color, location…"/>
              </label>
              <button className="btn active" style={{width:"100%"}} onClick={saveAccessory}>Save Accessory</button>
            </div>
          )}
          {stash.accessories.length===0&&!showAccForm&&(
            <p className="muted">Track any sewing accessories here — bobbins, needles, seam rippers, glue pens, marking tools, anything that doesn't fit elsewhere.</p>
          )}
          {stash.accessories.map(acc=>(
            <div key={acc.id} className="sub-card" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
              <div>
                <b>{acc.name}</b>
                <div className="muted">Qty: {acc.quantity}</div>
                {acc.notes&&<div className="muted" style={{fontSize:12}}>{acc.notes}</div>}
              </div>
              <button className="btn" style={{fontSize:11,padding:"4px 8px",color:"#C0392B",borderColor:"#C0392B",flexShrink:0}} onClick={()=>removeAccessory(acc.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MACHINES BROWSER
// ─────────────────────────────────────────────────────────────
function MachinesBrowser({ supabase, userId }) {
  const [machines,setMachines]=useState([]);
  const [owned,setOwned]=useState({});
  const [filter,setFilter]=useState("All");
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(true);
  const types=["All","Sewing","Quilting","Embroidery","Serger","Longarm","Vintage","Fabric Cutter","Computerized"];

  useEffect(()=>{ if(!supabase)return; fetchMachines(); if(userId)fetchOwned(); },[supabase,userId]);

  async function fetchMachines(){
    setLoading(true);
    const{data}=await supabase.from("machine_library").select("*,is_computerized").order("brand").order("model");
    setMachines(data||[]);setLoading(false);
  }
  async function fetchOwned(){
    const{data}=await supabase.from("user_machines").select("machine_id").eq("user_id",userId);
    if(data){const m={};data.forEach(r=>{m[r.machine_id]=true;});setOwned(m);}
  }
  async function toggleMachine(machineId){
    if(!userId||!supabase)return;
    if(owned[machineId]){
      const{error}=await supabase.from("user_machines")
        .delete().eq("user_id",userId).eq("machine_id",machineId);
      if(error){console.error("Remove machine error:",error);return;}
      setOwned(prev=>{const n={...prev};delete n[machineId];return n;});
    }else{
      const{error}=await supabase.from("user_machines")
        .insert({user_id:userId,machine_id:machineId})
        ;
      if(error){
        // If already exists (duplicate), just mark as owned
        if(error.code==="23505"){
          setOwned(prev=>({...prev,[machineId]:true}));
        } else {
          console.error("Add machine error:",error);
        }
        return;
      }
      setOwned(prev=>({...prev,[machineId]:true}));
    }
  }

  const filtered=machines.filter(m=>{
    const matchType = filter==="All"
      ? true
      : filter==="Computerized"
        ? m.is_computerized===true
        : m.type===filter||m.category?.includes(filter);
    const q=normalized(search);
    const matchSearch=!q||normalized(m.brand).includes(q)||normalized(m.model).includes(q)||normalized(m.category||"").includes(q);
    return matchType&&matchSearch;
  });

  if(loading)return<div className="card"><p className="muted">Loading machine library…</p></div>;
  return(
    <div>
      <div className="card" style={{padding:"12px 16px"}}>
        <h2 style={{marginBottom:10}}>Machine Library ({machines.length})</h2>
        <input className="input" style={{marginBottom:8}} placeholder="Search brand, model…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {types.map(ty=><button key={ty} className={`btn ${filter===ty?"active":""}`} onClick={()=>setFilter(ty)} style={{fontSize:11,padding:"4px 8px"}}>{ty}</button>)}
        </div>
      </div>
      <div className="card" style={{padding:"8px 12px"}}><p className="muted">{filtered.length} machines — tap to add to your stash</p></div>
      {filtered.map(machine=>{
        const isOwned=owned[machine.id];
        return(
          <div key={machine.id} className="card" style={{borderColor:isOwned?"#1A5C1A":undefined}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                  <span className="type-badge">{machine.type}</span>
                  {machine.is_computerized&&(
                    <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:6,
                      background:"var(--sky-pale)",color:"var(--sky-cobalt)",
                      border:"1px solid rgba(37,99,192,0.25)"}}>
                      💻 Computerized
                    </span>
                  )}
                  {machine.category&&<span className="muted" style={{fontSize:11}}>{machine.category}</span>}
                </div>
                <div className="thread-name">{machine.brand} {machine.model}</div>
                {machine.throat_space&&<div className="muted">{machine.throat_space}" throat</div>}
                {machine.fun_fact&&<p style={{fontSize:12,margin:"6px 0 0",color:"#5C4A1E",lineHeight:1.4}}>{machine.fun_fact.slice(0,120)}{machine.fun_fact.length>120?"…":""}</p>}
              </div>
              <button className={`btn ${isOwned?"active":""}`} style={{flexShrink:0}} onClick={()=>toggleMachine(machine.id)}>{isOwned?"✓ Owned":"+ Add"}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ACCUQUILT BROWSER
// ─────────────────────────────────────────────────────────────
function AccuQuiltBrowser({ supabase, userId }) {
  const [dies,setDies]=useState([]);
  const [owned,setOwned]=useState({});
  const [loading,setLoading]=useState(true);
  useEffect(()=>{ if(!supabase)return; fetchDies(); if(userId)fetchOwned(); },[supabase,userId]);
  async function fetchDies(){ setLoading(true); const{data}=await supabase.from("machine_library").select("*").eq("brand","AccuQuilt").order("category").order("model"); setDies(data||[]); setLoading(false); }
  async function fetchOwned(){ const{data}=await supabase.from("user_dies").select("machine_id").eq("user_id",userId); if(data){const m={};data.forEach(r=>{m[r.machine_id]=true;});setOwned(m);} }
  async function toggleDie(machineId){
    if(!userId||!supabase)return;
    if(owned[machineId]){ await supabase.from("user_dies").delete().eq("user_id",userId).eq("machine_id",machineId); setOwned(prev=>{const n={...prev};delete n[machineId];return n;}); }
    else{ await supabase.from("user_dies").upsert({user_id:userId,machine_id:machineId,quantity:1},{onConflict:"user_id,machine_id"}); setOwned(prev=>({...prev,[machineId]:true})); }
  }
  if(loading)return<div className="card"><p className="muted">Loading AccuQuilt library…</p></div>;
  const grouped=dies.reduce((acc,d)=>{ const cat=d.category||"Other"; if(!acc[cat])acc[cat]=[]; acc[cat].push(d); return acc; },{});
  return(
    <div>
      <div className="card"><h2>AccuQuilt Cutters & Dies</h2><p className="muted" style={{fontSize:13}}>Tap to add to your stash.</p></div>
      {Object.entries(grouped).map(([cat,items])=>(
        <div key={cat}>
          <div className="section-label">{cat}</div>
          {items.map(die=>{
            const isOwned=owned[die.id];
            return(
              <div key={die.id} className="card" style={{borderColor:isOwned?"#1A5C1A":undefined}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                  <div style={{flex:1}}>
                    <div className="thread-name">{die.model}</div>
                    {die.fun_fact&&<p style={{fontSize:12,margin:"4px 0 0",color:"#5C4A1E",lineHeight:1.4}}>{die.fun_fact.slice(0,140)}{die.fun_fact.length>140?"…":""}</p>}
                  </div>
                  <button className={`btn ${isOwned?"active":""}`} style={{flexShrink:0}} onClick={()=>toggleDie(die.id)}>{isOwned?"✓ Owned":"+ Add"}</button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {dies.length===0&&<div className="card"><p className="muted">Run step 26 SQL to load AccuQuilt data.</p></div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RULER BROWSER
// ─────────────────────────────────────────────────────────────
function RulerBrowser({ supabase, userId }) {
  const [rulers,setRulers]=useState([]);
  const [owned,setOwned]=useState({});
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  useEffect(()=>{ if(!supabase)return; fetchRulers(); if(userId)fetchOwned(); },[supabase,userId]);
  async function fetchRulers(){ setLoading(true); const{data}=await supabase.from("ruler_library").select("*").order("brand").order("model"); setRulers(data||[]); setLoading(false); }
  async function fetchOwned(){ const{data}=await supabase.from("user_rulers").select("ruler_id").eq("user_id",userId); if(data){const m={};data.forEach(r=>{m[r.ruler_id]=true;});setOwned(m);} }
  async function toggleRuler(rulerId){
    if(!userId||!supabase)return;
    if(owned[rulerId]){ await supabase.from("user_rulers").delete().eq("user_id",userId).eq("ruler_id",rulerId); setOwned(prev=>{const n={...prev};delete n[rulerId];return n;}); }
    else{ await supabase.from("user_rulers").upsert({user_id:userId,ruler_id:rulerId,quantity:1},{onConflict:"user_id,ruler_id"}); setOwned(prev=>({...prev,[rulerId]:true})); }
  }
  const filtered=rulers.filter(r=>!search||normalized(r.brand).includes(normalized(search))||normalized(r.model).includes(normalized(search))||normalized(r.shape).includes(normalized(search)));
  if(loading)return<div className="card"><p className="muted">Loading ruler library…</p></div>;
  return(
    <div>
      <div className="card" style={{padding:"12px 16px"}}>
        <h2 style={{marginBottom:10}}>Ruler Library ({rulers.length})</h2>
        <input className="input" placeholder="Search brand, shape…" value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <div className="card" style={{padding:"8px 12px"}}><p className="muted">{filtered.length} rulers — tap to add to your stash</p></div>
      {filtered.map(ruler=>{
        const isOwned=owned[ruler.id];
        return(
          <div key={ruler.id} className="card" style={{borderColor:isOwned?"#1A5C1A":undefined}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
              <div style={{flex:1}}>
                <div className="thread-name">{ruler.brand} — {ruler.model}</div>
                <div className="muted">{ruler.shape} · {ruler.size_inches} · {ruler.material}</div>
                {ruler.description&&<p style={{fontSize:12,margin:"4px 0 0",color:"#5C4A1E",lineHeight:1.4}}>{ruler.description}</p>}
              </div>
              <button className={`btn ${isOwned?"active":""}`} style={{flexShrink:0}} onClick={()=>toggleRuler(ruler.id)}>{isOwned?"✓ Owned":"+ Add"}</button>
            </div>
          </div>
        );
      })}
      {rulers.length===0&&<div className="card"><p className="muted">No ruler data found. Check the ruler_library table in Supabase.</p></div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FEET BROWSER
// ─────────────────────────────────────────────────────────────
function FeetBrowser({ supabase, userId }) {
  const [feet,setFeet]=useState([]);
  const [owned,setOwned]=useState({});
  const [filter,setFilter]=useState("All");
  const [loading,setLoading]=useState(true);
  const categories=["All","Quilting","Garment","Embroidery","Specialty","Serging","General"];
  const catColors={Quilting:{bg:"#E8F0FF",text:"#0047AB"},Garment:{bg:"#E0F5EC",text:"#1A6B4A"},Embroidery:{bg:"#F3EAF8",text:"#6B3FA0"},Serging:{bg:"#FFF8E1",text:"#5C4A1E"},Specialty:{bg:"#FDECEA",text:"#C0392B"},General:{bg:"#F5F5F5",text:"#888"}};
  useEffect(()=>{ if(!supabase)return; fetchFeet(); if(userId)fetchOwned(); },[supabase,userId]);
  async function fetchFeet(){ setLoading(true); const{data}=await supabase.from("feet_library").select("*").order("category").order("foot_name"); setFeet(data||[]); setLoading(false); }
  async function fetchOwned(){ const{data}=await supabase.from("user_feet").select("foot_id").eq("user_id",userId); if(data){const m={};data.forEach(r=>{m[r.foot_id]=true;});setOwned(m);} }
  async function toggleFoot(footId){
    if(!userId||!supabase)return;
    if(owned[footId]){ await supabase.from("user_feet").delete().eq("user_id",userId).eq("foot_id",footId); setOwned(prev=>{const n={...prev};delete n[footId];return n;}); }
    else{ await supabase.from("user_feet").upsert({user_id:userId,foot_id:footId,quantity:1},{onConflict:"user_id,foot_id"}); setOwned(prev=>({...prev,[footId]:true})); }
  }
  const filtered=filter==="All"?feet:feet.filter(f=>f.category===filter);
  if(loading)return<div className="card"><p className="muted">Loading feet library…</p></div>;
  return(
    <div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",padding:"0 0 8px"}}>
        {categories.map(cat=><button key={cat} className={`btn ${filter===cat?"active":""}`} onClick={()=>setFilter(cat)} style={{fontSize:11,padding:"4px 8px"}}>{cat}</button>)}
      </div>
      <div className="card" style={{padding:"8px 12px"}}><p className="muted">{filtered.length} feet — tap to add to your stash</p></div>
      {filtered.map(foot=>{
        const c=catColors[foot.category]||catColors.General;const isOwned=owned[foot.id];
        return(
          <div key={foot.id} className="card" style={{borderColor:isOwned?"#1A5C1A":undefined}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:8,background:c.bg,color:c.text}}>{foot.category}</span>
                  {foot.foot_number&&<span className="muted" style={{fontSize:11}}>#{foot.foot_number}</span>}
                </div>
                <div className="thread-name">{foot.foot_name}</div>
                <div className="muted">{foot.brand} · {foot.shank_type}</div>
                {foot.description&&<p style={{fontSize:12,margin:"4px 0 0",color:"#5C4A1E",lineHeight:1.4}}>{foot.description}</p>}
                {foot.best_for&&foot.best_for.length>0&&(
                  <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6}}>
                    {foot.best_for.slice(0,4).map((u,i)=><span key={i} style={{fontSize:10,padding:"1px 5px",background:"#F5F5F5",color:"#888",borderRadius:4}}>{u}</span>)}
                  </div>
                )}
              </div>
              <button className={`btn ${isOwned?"active":""}`} style={{flexShrink:0}} onClick={()=>toggleFoot(foot.id)}>{isOwned?"✓ Owned":"+ Add"}</button>
            </div>
          </div>
        );
      })}
      {feet.length===0&&<div className="card"><p className="muted">Run steps 30+31 SQL to load feet data.</p></div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CROSS-REFERENCE TAB
// User picks two brands. Pick or search a thread from Brand A.
// App finds the nearest match in Brand B instantly.
// ─────────────────────────────────────────────────────────────
function CrossRefTab({ supaAllThreads, threadBrands, brandKeyMap, addToUserInventory,
                       addProjectRequiredThread, addManualShoppingItem, hexToFamilyKey, settings }) {

  const [brandA, setBrandA]           = useState(threadBrands[0][0]);
  const [brandB, setBrandB]           = useState(threadBrands[1][0]);
  const [searchA, setSearchA]         = useState("");
  const [selectedThread, setSelectedThread] = useState(null);
  const [results, setResults]         = useState([]); // top 5 matches in brand B

  // Threads for brand A dropdown
  const brandAKey = brandKeyMap[brandA] || normalized(brandA).replace(/[^a-z0-9]/g,"_");
  const brandBKey = brandKeyMap[brandB] || normalized(brandB).replace(/[^a-z0-9]/g,"_");

  const brandAThreads = useMemo(()=>{
    if(!searchA.trim()) return [];
    const q = normalized(searchA);
    return supaAllThreads
      .filter(t => t.brand_key === brandAKey &&
        (normalized(t.color_name).includes(q) || normalized(t.color_code).includes(q)))
      .slice(0, 30);
  }, [supaAllThreads, brandAKey, searchA]);

  // When a thread is selected, find top 5 nearest in brand B
  // Tries precomputed thread_crossref table first; falls back to live computation
  useEffect(()=>{
    if(!selectedThread){ setResults([]); return; }

    async function findMatches(){
      // ── Try precomputed crossref table ──
      if(window._supabaseClient){
        try{
          const supaClient = window._supabaseClient;
          const{data,error} = await supaClient
            .from("thread_crossref")
            .select("ref_thread_id,distance,distance_pct,thread_library!ref_thread_id(id,brand,brand_key,color_code,color_name,hex_color,fiber_type,weight)")
            .eq("thread_id", selectedThread.id)
            .order("distance", {ascending:true})
            .limit(20); // fetch 20, then filter to target brand top 5

          if(!error && data && data.length > 0){
            const brandMatches = data
              .filter(r => r.thread_library?.brand_key === brandBKey)
              .slice(0,5)
              .map(r => ({...r.thread_library, _distance: r.distance, _distance_pct: r.distance_pct}));

            if(brandMatches.length > 0){
              setResults(brandMatches);
              return;
            }
          }
        }catch(e){
          // Crossref table not available yet — fall through to live computation
        }
      }

      // ── Live computation fallback ──
      const rgb = hexToRgb(selectedThread.hex_color);
      if(!rgb){ setResults([]); return; }
      const matches = supaAllThreads
        .filter(t => t.brand_key === brandBKey && t.hex_color)
        .map(t => ({ thread:t, dist:colorDistance(rgb, hexToRgb(t.hex_color)) }))
        .sort((a,b) => a.dist - b.dist)
        .slice(0,5)
        .map(m => m.thread);
      setResults(matches);
    }

    findMatches();
  }, [selectedThread, brandBKey, supaAllThreads]);

  // Swap brands
  function swapBrands() {
    const tmp = brandA;
    setBrandA(brandB);
    setBrandB(tmp);
    setSelectedThread(null);
    setSearchA("");
    setResults([]);
  }

  return (
    <div>
      {/* Brand selectors */}
      <div className="card">
        <h2>Thread Cross-Reference</h2>
        <p className="muted" style={{fontSize:13,marginBottom:14}}>
          Pick two brands. Search for a color in the first brand — we'll find the closest matches in the second.
        </p>

        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:10,alignItems:"end",marginBottom:4}}>
          <label>From Brand
            <select className="input" style={{marginBottom:0}} value={brandA}
              onChange={e=>{setBrandA(e.target.value);setSelectedThread(null);setSearchA("");setResults([]);}}>
              {threadBrands.filter(([l])=>l!==brandB).map(([label])=>
                <option key={label}>{label}</option>
              )}
            </select>
          </label>

          <button onClick={swapBrands} className="btn"
            style={{padding:"9px 12px",fontSize:16,marginBottom:0,alignSelf:"end"}}>
            ⇄
          </button>

          <label>To Brand
            <select className="input" style={{marginBottom:0}} value={brandB}
              onChange={e=>{setBrandB(e.target.value);setSelectedThread(null);setResults([]);}}>
              {threadBrands.filter(([l])=>l!==brandA).map(([label])=>
                <option key={label}>{label}</option>
              )}
            </select>
          </label>
        </div>

        {supaAllThreads.filter(t=>t.brand_key===brandAKey).length===0 && (
          <p style={{fontSize:12,color:"var(--sun-amber)",marginTop:8}}>
            ⚠ No {brandA} colors loaded yet.
          </p>
        )}
        {supaAllThreads.filter(t=>t.brand_key===brandBKey).length===0 && (
          <p style={{fontSize:12,color:"var(--sun-amber)",marginTop:4}}>
            ⚠ No {brandB} colors loaded yet.
          </p>
        )}
      </div>

      {/* Search brand A */}
      <div className="card">
        <label>Search {brandA}
          <input className="input" value={searchA}
            onChange={e=>{setSearchA(e.target.value);setSelectedThread(null);setResults([]);}}
            placeholder={`color name or code…`}/>
        </label>

        {/* Brand A results — pick one */}
        {brandAThreads.length > 0 && !selectedThread && (
          <div>
            <div className="muted" style={{fontSize:12,marginBottom:8}}>{brandAThreads.length} results — tap to select:</div>
            {brandAThreads.map(thread=>(
              <div key={thread.id}
                onClick={()=>setSelectedThread(thread)}
                style={{
                  display:"flex",alignItems:"center",gap:12,
                  padding:"10px 12px",marginBottom:6,
                  borderRadius:"var(--r-sm)",
                  border:"1.5px solid var(--border-teal)",
                  background:"var(--teal-pale)",
                  cursor:"pointer",
                  transition:"all 0.15s"
                }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="var(--teal)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border-teal)"}
              >
                {thread.hex_color && (
                  <div style={{
                    width:36,height:36,borderRadius:"50%",flexShrink:0,
                    background:thread.hex_color,
                    border:"2px solid rgba(255,255,255,0.6)",
                    boxShadow:"0 2px 6px rgba(0,0,0,0.18),inset 0 1px 3px rgba(255,255,255,0.3)"
                  }}/>
                )}
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13}}>{thread.color_code} — {thread.color_name}</div>
                  <div className="muted" style={{fontSize:11}}>{thread.brand} · {thread.fiber_type||""} {thread.weight||""}</div>
                </div>
                <span style={{fontSize:11,color:"var(--teal)",fontWeight:700}}>Select →</span>
              </div>
            ))}
          </div>
        )}
        {searchA.trim() && brandAThreads.length === 0 && (
          <p className="muted" style={{fontSize:12}}>No {brandA} colors found for "{searchA}".</p>
        )}
      </div>

      {/* Selected thread + matches */}
      {selectedThread && (
        <>
          {/* Selected source thread */}
          <div className="card" style={{borderColor:"var(--teal)",borderWidth:2}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--teal)",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>
              Selected — {brandA}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              {selectedThread.hex_color && (
                <div style={{
                  width:52,height:52,borderRadius:"50%",flexShrink:0,
                  background:selectedThread.hex_color,
                  border:"3px solid rgba(255,255,255,0.7)",
                  boxShadow:"0 3px 12px rgba(0,0,0,0.20),inset 0 2px 4px rgba(255,255,255,0.3)"
                }}/>
              )}
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:16}}>{selectedThread.color_code} — {selectedThread.color_name}</div>
                <div className="muted">{selectedThread.brand} · {selectedThread.fiber_type||""} {selectedThread.weight||""}</div>
                <div className="muted" style={{fontSize:11}}>Color family: {hexToFamilyKey(selectedThread)}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                <button className="btn active" style={{fontSize:11,padding:"5px 10px"}}
                  onClick={()=>addToUserInventory(selectedThread)}>+ Stash</button>
                <button className="btn" style={{fontSize:11,padding:"5px 10px"}}
                  onClick={()=>{setSelectedThread(null);setResults([]);}}>✕ Clear</button>
              </div>
            </div>
          </div>

          {/* Nearest matches in brand B */}
          <div className="card">
            <div style={{
              fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,
              color:"var(--teal)",marginBottom:12
            }}>
              Nearest {brandB} matches
            </div>

            {results.length === 0 && (
              <p className="muted">No {brandB} colors loaded — check that {brandB} data exists in the database.</p>
            )}

            {results.map((match, i) => {
              const isExact = i === 0;
              return (
                <div key={match.id} style={{
                  display:"flex",alignItems:"center",gap:12,
                  padding:"12px 14px",marginBottom:8,
                  borderRadius:"var(--r-sm)",
                  border:`1.5px solid ${isExact?"var(--teal)":"var(--border-teal)"}`,
                  background: isExact ? "var(--teal-pale)" : "var(--warm-white)",
                  boxShadow: isExact ? "var(--shadow-sm)" : "none"
                }}>
                  {/* Rank badge */}
                  <div style={{
                    width:22,height:22,borderRadius:"50%",flexShrink:0,
                    background: isExact ? "var(--teal)" : "var(--border-teal)",
                    color: isExact ? "var(--warm-white)" : "var(--muted)",
                    fontSize:11,fontWeight:800,
                    display:"flex",alignItems:"center",justifyContent:"center"
                  }}>{i+1}</div>

                  {/* Color swatch */}
                  {match.hex_color && (
                    <div style={{
                      width:44,height:44,borderRadius:"50%",flexShrink:0,
                      background:match.hex_color,
                      border:"2px solid rgba(255,255,255,0.6)",
                      boxShadow:"0 2px 8px rgba(0,0,0,0.18),inset 0 1px 3px rgba(255,255,255,0.3)"
                    }}/>
                  )}

                  {/* Side-by-side comparison swatches */}
                  <div style={{flexShrink:0}}>
                    <div style={{fontSize:9,color:"var(--muted)",textAlign:"center",marginBottom:2}}>vs</div>
                    <div style={{display:"flex",gap:2}}>
                      <div style={{width:16,height:32,borderRadius:"4px 0 0 4px",background:selectedThread.hex_color||"#CCC"}}/>
                      <div style={{width:16,height:32,borderRadius:"0 4px 4px 0",background:match.hex_color||"#CCC"}}/>
                    </div>
                  </div>

                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13}}>
                      {isExact && <span style={{fontSize:10,background:"var(--teal)",color:"white",borderRadius:4,padding:"1px 5px",marginRight:5}}>Best</span>}
                      {match.color_code} — {match.color_name}
                    </div>
                    <div className="muted" style={{fontSize:11}}>{match.brand} · {match.fiber_type||""} {match.weight||""}</div>
                    <div className="muted" style={{fontSize:11}}>Family: {hexToFamilyKey(match)}</div>
                    {match._distance_pct!==undefined&&(
                      <div style={{fontSize:10,color:"var(--teal)",fontWeight:700,marginTop:2}}>
                        {match._distance_pct < 2 ? "🎯 Near-identical" :
                         match._distance_pct < 8 ? "✓ Very close" :
                         match._distance_pct < 15 ? "≈ Close" : "~ Similar"}
                        {" "}({match._distance_pct.toFixed(1)}% difference)
                      </div>
                    )}
                  </div>

                  <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
                    <button className="btn active" style={{fontSize:11,padding:"5px 10px"}}
                      onClick={()=>addToUserInventory(match)}>+ Stash</button>
                    <button className="btn" style={{fontSize:11,padding:"5px 10px"}}
                      onClick={()=>addProjectRequiredThread(match)}>Project</button>
                    <button className="btn" style={{fontSize:11,padding:"5px 10px"}}
                      onClick={()=>addManualShoppingItem(match)}>+ List</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!selectedThread && !searchA && (
        <div className="card" style={{textAlign:"center",padding:"28px 20px"}}>
          <div style={{fontSize:32,marginBottom:10}}>⇄</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"var(--teal)",marginBottom:6}}>
            Cross-Reference Any Two Brands
          </div>
          <p className="muted" style={{fontSize:13}}>
            Select a "From" brand and "To" brand above, then search for a color.
            We'll find the top 5 closest color matches in the second brand.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// USER PROFILE PAGE
// ─────────────────────────────────────────────────────────────
function ProfilePage({ supabase, user, onBack }) {
  const [profile, setProfile]     = useState(null);
  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage]     = useState("");
  const [form, setForm]           = useState({
    display_name:"", hometown:"", state_province:"",
    country:"United States", email_public:false, bio:"", avatar_color:"#0D5252"
  });
  const fileRef = React.useRef(null);

  // Avatar color options matching brand palette
  const avatarColors = [
    "#0D5252","#1A4D9B","#2D5A1B","#E8A800","#C97B00",
    "#6B3FA0","#C0392B","#1A7070","#2563C0","#3D7226"
  ];

  const countries = [
    "United States","Canada","United Kingdom","Australia","New Zealand",
    "Germany","France","Netherlands","Japan","South Korea","Brazil",
    "Mexico","Sweden","Norway","Denmark","Finland","Ireland","Other"
  ];

  useEffect(()=>{
    if(!supabase||!user) return;
    loadProfile();
  },[supabase,user]);

  async function loadProfile(){
    const{data}=await supabase.from("profiles").select("*").eq("id",user.id).maybeSingle();
    if(data){
      setProfile(data);
      setForm({
        display_name: data.display_name||"",
        hometown:     data.hometown||"",
        state_province:data.state_province||"",
        country:      data.country||"United States",
        email_public: data.email_public||false,
        bio:          data.bio||"",
        avatar_color: data.avatar_color||"#0D5252"
      });
    }
  }

  async function saveProfile(){
    if(!supabase||!user) return;
    setSaving(true);
    const{error}=await supabase.from("profiles").upsert({
      id: user.id,
      ...form,
      updated_at: new Date().toISOString()
    });
    if(error) setMessage("Error saving: "+error.message);
    else{ setMessage("Profile saved!"); setEditing(false); loadProfile(); }
    setSaving(false);
  }

  async function uploadAvatar(e){
    const file = e.target.files?.[0];
    if(!file||!supabase||!user) return;
    if(file.size > 2*1024*1024){ setMessage("Image must be under 2MB"); return; }
    setUploading(true);
    const ext  = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const{error:upErr}=await supabase.storage.from("avatars").upload(path, file, {upsert:true});
    if(upErr){ setMessage("Upload error: "+upErr.message); setUploading(false); return; }
    const{data:{publicUrl}}=supabase.storage.from("avatars").getPublicUrl(path);
    const{error:profErr}=await supabase.from("profiles").upsert({id:user.id,avatar_url:publicUrl,updated_at:new Date().toISOString()});
    if(profErr) setMessage("Error saving avatar: "+profErr.message);
    else{ setMessage("Avatar updated!"); loadProfile(); }
    setUploading(false);
  }

  // Generate initials avatar
  const initials = (profile?.display_name||user?.email||"?").slice(0,2).toUpperCase();
  const avatarUrl = profile?.avatar_url;
  const avatarBg  = profile?.avatar_color||"#0D5252";

  return(
    <div>
      <div className="card">
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <button className="btn" style={{fontSize:12,padding:"5px 10px"}} onClick={onBack}>← Back</button>
          <h2 style={{margin:0,flex:1}}>My Profile</h2>
          {!editing&&<button className="btn active" style={{fontSize:12,padding:"5px 10px"}} onClick={()=>setEditing(true)}>✎ Edit</button>}
        </div>

        {message&&<div style={{padding:"8px 12px",marginBottom:12,borderRadius:"var(--r-sm)",
          background:"var(--leaf-light)",border:"1px solid var(--leaf)",color:"var(--leaf)",fontSize:13}}>
          {message}
        </div>}

        {/* Avatar */}
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20}}>
          <div style={{position:"relative"}}>
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar"
                  style={{width:80,height:80,borderRadius:"50%",objectFit:"cover",
                    border:"3px solid var(--gold)",boxShadow:"var(--shadow-md)"}}/>
              : <div style={{width:80,height:80,borderRadius:"50%",
                  background:avatarBg,display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:28,fontWeight:800,color:"white",fontFamily:"Playfair Display,serif",
                  border:"3px solid var(--gold)",boxShadow:"var(--shadow-md)"}}>
                  {initials}
                </div>
            }
            {editing&&(
              <button onClick={()=>fileRef.current?.click()}
                style={{position:"absolute",bottom:-4,right:-4,
                  width:26,height:26,borderRadius:"50%",border:"2px solid white",
                  background:"var(--teal)",color:"white",fontSize:13,
                  cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {uploading?"…":"📷"}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*"
              style={{display:"none"}} onChange={uploadAvatar}/>
          </div>
          <div>
            <div style={{fontFamily:"Playfair Display,serif",fontSize:18,fontWeight:700,color:"var(--teal)"}}>
              {profile?.display_name||user?.email}
            </div>
            <div className="muted" style={{fontSize:12}}>
              {[profile?.hometown,profile?.state_province,profile?.country].filter(Boolean).join(", ")||"Location not set"}
            </div>
            {profile?.is_premium&&(
              <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:6,
                background:"var(--sun-pale)",color:"var(--teal)",border:"1px solid var(--border-sun)"}}>
                ✦ Premium Member
              </span>
            )}
          </div>
        </div>

        {/* View mode */}
        {!editing&&profile&&(
          <div className="list-box">
            {profile.bio&&<div style={{marginBottom:8,fontStyle:"italic",color:"var(--ink-soft)"}}>{profile.bio}</div>}
            <div><b>Email:</b> {profile.email_public ? user.email : "Private"}</div>
            <div><b>Member since:</b> {new Date(profile.created_at||Date.now()).toLocaleDateString()}</div>
          </div>
        )}

        {/* Edit mode */}
        {editing&&(
          <div>
            <label style={{fontSize:12}}>Display Name
              <input className="input" value={form.display_name}
                onChange={e=>setForm({...form,display_name:e.target.value})}
                placeholder="How you appear to others"/>
            </label>
            <label style={{fontSize:12}}>Bio
              <input className="input" value={form.bio}
                onChange={e=>setForm({...form,bio:e.target.value})}
                placeholder="Tell the community about yourself…"/>
            </label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <label style={{fontSize:12}}>Hometown
                <input className="input" value={form.hometown}
                  onChange={e=>setForm({...form,hometown:e.target.value})}
                  placeholder="City"/>
              </label>
              <label style={{fontSize:12}}>State / Province
                <input className="input" value={form.state_province}
                  onChange={e=>setForm({...form,state_province:e.target.value})}
                  placeholder="State or Province"/>
              </label>
            </div>
            <label style={{fontSize:12}}>Country
              <select className="input" value={form.country}
                onChange={e=>setForm({...form,country:e.target.value})}>
                {countries.map(c=><option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={form.email_public}
                onChange={e=>setForm({...form,email_public:e.target.checked})}/>
              Make my email visible to other members
            </label>

            {/* Avatar color picker — shown when no photo uploaded */}
            {!avatarUrl&&(
              <div style={{marginBottom:14}}>
                <label style={{fontSize:12,display:"block",marginBottom:6}}>Avatar Color</label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {avatarColors.map(color=>(
                    <div key={color}
                      onClick={()=>setForm({...form,avatar_color:color})}
                      style={{
                        width:32,height:32,borderRadius:"50%",background:color,
                        cursor:"pointer",
                        border:form.avatar_color===color?"3px solid var(--gold)":"3px solid transparent",
                        boxShadow:form.avatar_color===color?"var(--shadow-md)":"none",
                        transition:"all 0.15s"
                      }}/>
                  ))}
                </div>
                <p className="muted" style={{fontSize:11,marginTop:4}}>
                  Or tap the camera icon above to upload a photo.
                </p>
              </div>
            )}

            <div className="button-row">
              <button className="btn active" onClick={saveProfile} disabled={saving} style={{flex:1}}>
                {saving?"Saving…":"Save Profile"}
              </button>
              <button className="btn" onClick={()=>{setEditing(false);setMessage("");}}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BARCODE SCANNER
// ─────────────────────────────────────────────────────────────
function BarcodeScanner({ supabase, userId, onAddToStash, onColorMatch }) {
  const [scanning,setScanning]=useState(false);
  const [result,setResult]=useState(null);
  const [error,setError]=useState(null);
  const [adding,setAdding]=useState(false);
  const videoRef=useRef(null);const streamRef=useRef(null);const rafRef=useRef(null);const detRef=useRef(null);
  async function startScan(){
    setError(null);setResult(null);
    if(!("BarcodeDetector" in window)){setError("Barcode scanning requires Chrome on Android or desktop Chrome.");return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
      streamRef.current=stream;
      if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}
      detRef.current=new window.BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e","code_128","code_39","itf","qr_code"]});
      setScanning(true);loop();
    }catch{setError("Camera access denied — check browser permissions.");}
  }
  function loop(){
    if(!videoRef.current||!detRef.current)return;
    rafRef.current=requestAnimationFrame(async()=>{
      try{ const barcodes=await detRef.current.detect(videoRef.current); if(barcodes.length>0){stopScan();await handleBarcode(barcodes[0].rawValue);}else{loop();} }catch{loop();}
    });
  }
  function stopScan(){ if(rafRef.current)cancelAnimationFrame(rafRef.current); if(streamRef.current){streamRef.current.getTracks().forEach(t=>t.stop());streamRef.current=null;} setScanning(false); }
  async function handleBarcode(barcode){
    if(!supabase){setResult({barcode,found:false});return;}
    try{
      const{data}=await supabase.from("thread_barcodes").select("*,thread_library(id,brand,brand_key,color_code,color_name,hex_color,fiber_type,weight,nearest_isacord)").eq("barcode",barcode).maybeSingle();
      if(data?.thread_library){setResult({barcode,thread:data.thread_library,confirmed:data.confirmed_count,found:true});await supabase.rpc("increment_barcode_confirmation",{p_barcode:barcode});}
      else{setResult({barcode,found:false});}
    }catch{setResult({barcode,found:false});}
  }
  async function addToStash(){
    if(!result?.thread||!userId||!supabase)return;
    setAdding(true);
    try{
      const{data:lib}=await supabase.from("thread_library").select("id").eq("color_code",result.thread.color_code).maybeSingle();
      if(lib){await supabase.from("user_inventory").upsert({user_id:userId,thread_id:lib.id,quantity:1},{onConflict:"user_id,thread_id"});}
      onAddToStash&&onAddToStash(result.thread);setResult(null);
    }catch(e){console.error(e);}
    setAdding(false);
  }
  useEffect(()=>()=>stopScan(),[]);
  return(
    <div>
      {!scanning&&!result&&<button className="btn active" style={{width:"100%",marginBottom:8}} onClick={startScan}>📷 Scan Thread Barcode</button>}
      {error&&<div className="message" style={{borderColor:"#C0392B",color:"#C0392B",background:"#FDECEA"}}>{error}</div>}
      {scanning&&(
        <div style={{position:"relative",marginBottom:8}}>
          <video ref={videoRef} style={{width:"100%",borderRadius:10}} playsInline muted/>
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
            <div style={{width:"70%",height:"30%",border:"2.5px solid #F5C400",borderRadius:10,boxShadow:"0 0 0 9999px rgba(0,0,0,0.45)"}}/>
          </div>
          <button className="btn" style={{position:"absolute",top:8,right:8}} onClick={stopScan}>✕ Cancel</button>
        </div>
      )}
      {result?.found&&result.thread&&(
        <div className="card" style={{borderColor:"#1A5C1A"}}>
          <div className="thread-row">
            {result.thread.hex_color&&<div className="swatch" style={{background:result.thread.hex_color}}/>}
            <div>
              <div style={{fontSize:11,color:"#1A5C1A",fontWeight:700}}>✓ Thread identified!</div>
              <div className="thread-name">{result.thread.brand} {result.thread.color_code} — {result.thread.color_name}</div>
              <div className="muted">{result.thread.fiber_type} · {result.thread.weight} · {result.confirmed} confirmed</div>
            </div>
          </div>
          <div className="button-row">
            <button className="btn active" onClick={addToStash} disabled={adding}>{adding?"Adding…":"+ Add to Stash"}</button>
            <button className="btn" onClick={()=>setResult(null)}>Dismiss</button>
          </div>
        </div>
      )}
      {result&&!result.found&&(
        <div className="card">
          <div className="thread-name">Barcode not in database yet</div>
          <div className="muted" style={{marginBottom:8}}>Barcode: {result.barcode}</div>
          <p style={{marginBottom:10}}>Use Camera Match to identify this thread — barcode gets saved for everyone!</p>
          <div className="button-row">
            <button className="btn active" onClick={()=>onColorMatch&&onColorMatch(result.barcode)}>📷 Color Match</button>
            <button className="btn" onClick={()=>setResult(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AUTH SCREEN — Sign in / Sign up / Guest mode
// ─────────────────────────────────────────────────────────────
function AuthScreen({ supabase, onGuest, onSignIn }) {
  const [mode, setMode]         = useState("signin"); // signin | signup | reset
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState("");
  const [error, setError]       = useState("");

  async function handleSignIn(e){
    e.preventDefault();
    setLoading(true); setError(""); setMessage("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if(error){ setError(error.message); setLoading(false); return; }
    if(data?.user && onSignIn) onSignIn(data.user);
    setLoading(false);
  }

  async function handleSignUp(e){
    e.preventDefault();
    setLoading(true); setError(""); setMessage("");
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: name } }
    });
    if(error) setError(error.message);
    else setMessage("Check your email for a confirmation link!");
    setLoading(false);
  }

  async function handleReset(e){
    e.preventDefault();
    setLoading(true); setError(""); setMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if(error) setError(error.message);
    else setMessage("Password reset email sent!");
    setLoading(false);
  }

  return(
    <div style={{
      minHeight:"100vh",
      background:"#EAE4CE",
      backgroundImage:`
        radial-gradient(ellipse 120% 60% at 50% 0%, rgba(37,99,192,0.12) 0%, transparent 55%),
        radial-gradient(ellipse 80% 50% at 15% 100%, rgba(232,168,0,0.18) 0%, transparent 50%)
      `,
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:"20px", fontFamily:"Nunito, sans-serif"
    }}>
      {/* Logo + title */}
      <div style={{textAlign:"center", marginBottom:28}}>
        <img src="/HH_Logo.png" alt="Haberdash Haven"
          style={{width:100, height:100, borderRadius:"50%",
            border:"3px solid #E8A800",
            boxShadow:"0 0 0 6px rgba(232,168,0,0.15), 0 8px 32px rgba(0,0,0,0.25)",
            marginBottom:14}}/>
        <div style={{fontFamily:"Playfair Display, serif", fontSize:"1.8rem",
          fontWeight:800, color:"#0A1F40", marginBottom:4}}>
          Haberdash Haven
        </div>
        <div style={{fontFamily:"Caveat, cursive", fontSize:"1rem",
          color:"#C97B00", letterSpacing:"0.3px"}}>
          Making the world a better place. One stitch at a time...
        </div>
      </div>

      {/* Auth card */}
      <div style={{
        background:"white", borderRadius:20, padding:"28px 28px",
        width:"100%", maxWidth:400,
        boxShadow:"0 8px 40px rgba(13,82,82,0.18), 0 2px 8px rgba(0,0,0,0.08)",
        border:"1.5px solid #B8D8D8"
      }}>
        {/* Mode tabs */}
        <div style={{display:"flex", gap:0, marginBottom:22,
          background:"#EEF8F8", borderRadius:12, padding:4}}>
          {[["signin","Sign In"],["signup","Create Account"]].map(([m,label])=>(
            <button key={m} onClick={()=>{setMode(m);setError("");setMessage("");}}
              style={{
                flex:1, padding:"8px 0", border:"none", borderRadius:9,
                fontFamily:"Nunito, sans-serif", fontSize:13, fontWeight:700,
                cursor:"pointer", transition:"all 0.15s",
                background: mode===m ? "#0D5252" : "transparent",
                color: mode===m ? "white" : "#5C6E6E",
                boxShadow: mode===m ? "0 2px 8px rgba(13,82,82,0.25)" : "none"
              }}>{label}</button>
          ))}
        </div>

        {/* Sign In form */}
        {mode==="signin"&&(
          <form onSubmit={handleSignIn}>
            <label style={{display:"block",fontWeight:700,fontSize:13,color:"#0D5252",marginBottom:2}}>
              Email
            </label>
            <input type="email" required value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{width:"100%",padding:"10px 14px",marginBottom:12,borderRadius:9,
                border:"1.5px solid #B8D8D8",fontSize:14,fontFamily:"Nunito,sans-serif",
                background:"#EEF8F8",outline:"none",boxSizing:"border-box"}}/>
            <label style={{display:"block",fontWeight:700,fontSize:13,color:"#0D5252",marginBottom:2}}>
              Password
            </label>
            <input type="password" required value={password} onChange={e=>setPassword(e.target.value)}
              placeholder="••••••••"
              style={{width:"100%",padding:"10px 14px",marginBottom:6,borderRadius:9,
                border:"1.5px solid #B8D8D8",fontSize:14,fontFamily:"Nunito,sans-serif",
                background:"#EEF8F8",outline:"none",boxSizing:"border-box"}}/>
            <div style={{textAlign:"right",marginBottom:16}}>
              <button type="button" onClick={()=>setMode("reset")}
                style={{background:"none",border:"none",color:"#1A7070",
                  fontSize:12,cursor:"pointer",fontFamily:"Nunito,sans-serif",fontWeight:600}}>
                Forgot password?
              </button>
            </div>
            {error&&<div style={{background:"#FDECEA",border:"1px solid #C0392B",borderRadius:8,
              padding:"8px 12px",color:"#C0392B",fontSize:13,marginBottom:12}}>{error}</div>}
            {message&&<div style={{background:"#E4F0D6",border:"1px solid #3D7226",borderRadius:8,
              padding:"8px 12px",color:"#2D5A1B",fontSize:13,marginBottom:12}}>{message}</div>}
            <button type="submit" disabled={loading}
              style={{width:"100%",padding:"12px",borderRadius:12,border:"none",
                background:"linear-gradient(145deg, #1A7070 0%, #0D5252 100%)",
                color:"white",fontFamily:"Nunito,sans-serif",fontSize:15,fontWeight:800,
                cursor:loading?"not-allowed":"pointer",
                boxShadow:"0 4px 16px rgba(13,82,82,0.30)",marginBottom:10}}>
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        )}

        {/* Sign Up form */}
        {mode==="signup"&&(
          <form onSubmit={handleSignUp}>
            <label style={{display:"block",fontWeight:700,fontSize:13,color:"#0D5252",marginBottom:2}}>
              Your Name
            </label>
            <input type="text" value={name} onChange={e=>setName(e.target.value)}
              placeholder="First name or nickname"
              style={{width:"100%",padding:"10px 14px",marginBottom:12,borderRadius:9,
                border:"1.5px solid #B8D8D8",fontSize:14,fontFamily:"Nunito,sans-serif",
                background:"#EEF8F8",outline:"none",boxSizing:"border-box"}}/>
            <label style={{display:"block",fontWeight:700,fontSize:13,color:"#0D5252",marginBottom:2}}>
              Email
            </label>
            <input type="email" required value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{width:"100%",padding:"10px 14px",marginBottom:12,borderRadius:9,
                border:"1.5px solid #B8D8D8",fontSize:14,fontFamily:"Nunito,sans-serif",
                background:"#EEF8F8",outline:"none",boxSizing:"border-box"}}/>
            <label style={{display:"block",fontWeight:700,fontSize:13,color:"#0D5252",marginBottom:2}}>
              Password
            </label>
            <input type="password" required value={password} onChange={e=>setPassword(e.target.value)}
              placeholder="At least 6 characters"
              style={{width:"100%",padding:"10px 14px",marginBottom:16,borderRadius:9,
                border:"1.5px solid #B8D8D8",fontSize:14,fontFamily:"Nunito,sans-serif",
                background:"#EEF8F8",outline:"none",boxSizing:"border-box"}}/>
            {error&&<div style={{background:"#FDECEA",border:"1px solid #C0392B",borderRadius:8,
              padding:"8px 12px",color:"#C0392B",fontSize:13,marginBottom:12}}>{error}</div>}
            {message&&<div style={{background:"#E4F0D6",border:"1px solid #3D7226",borderRadius:8,
              padding:"8px 12px",color:"#2D5A1B",fontSize:13,marginBottom:12}}>{message}</div>}
            <button type="submit" disabled={loading}
              style={{width:"100%",padding:"12px",borderRadius:12,border:"none",
                background:"linear-gradient(145deg, #1A7070 0%, #0D5252 100%)",
                color:"white",fontFamily:"Nunito,sans-serif",fontSize:15,fontWeight:800,
                cursor:loading?"not-allowed":"pointer",
                boxShadow:"0 4px 16px rgba(13,82,82,0.30)",marginBottom:10}}>
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>
        )}

        {/* Password reset */}
        {mode==="reset"&&(
          <form onSubmit={handleReset}>
            <p style={{fontSize:13,color:"#5C6E6E",marginBottom:14}}>
              Enter your email and we'll send you a link to reset your password.
            </p>
            <label style={{display:"block",fontWeight:700,fontSize:13,color:"#0D5252",marginBottom:2}}>
              Email
            </label>
            <input type="email" required value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{width:"100%",padding:"10px 14px",marginBottom:16,borderRadius:9,
                border:"1.5px solid #B8D8D8",fontSize:14,fontFamily:"Nunito,sans-serif",
                background:"#EEF8F8",outline:"none",boxSizing:"border-box"}}/>
            {error&&<div style={{background:"#FDECEA",border:"1px solid #C0392B",borderRadius:8,
              padding:"8px 12px",color:"#C0392B",fontSize:13,marginBottom:12}}>{error}</div>}
            {message&&<div style={{background:"#E4F0D6",border:"1px solid #3D7226",borderRadius:8,
              padding:"8px 12px",color:"#2D5A1B",fontSize:13,marginBottom:12}}>{message}</div>}
            <button type="submit" disabled={loading}
              style={{width:"100%",padding:"12px",borderRadius:12,border:"none",
                background:"linear-gradient(145deg, #1A7070 0%, #0D5252 100%)",
                color:"white",fontFamily:"Nunito,sans-serif",fontSize:15,fontWeight:800,
                cursor:loading?"not-allowed":"pointer",
                boxShadow:"0 4px 16px rgba(13,82,82,0.30)",marginBottom:10}}>
              {loading ? "Sending…" : "Send Reset Link"}
            </button>
            <button type="button" onClick={()=>setMode("signin")}
              style={{width:"100%",padding:"10px",borderRadius:12,
                border:"1.5px solid #B8D8D8",background:"white",
                color:"#5C6E6E",fontFamily:"Nunito,sans-serif",fontSize:13,
                fontWeight:700,cursor:"pointer"}}>
              Back to Sign In
            </button>
          </form>
        )}

        {/* Divider */}
        <div style={{display:"flex",alignItems:"center",gap:10,margin:"16px 0"}}>
          <div style={{flex:1,height:1,background:"#D4E8E8"}}/>
          <span style={{fontSize:12,color:"#9EB8B8",fontWeight:600}}>or</span>
          <div style={{flex:1,height:1,background:"#D4E8E8"}}/>
        </div>

        {/* Guest mode */}
        <button onClick={onGuest}
          style={{width:"100%",padding:"11px",borderRadius:12,
            border:"1.5px solid #B8D8D8",background:"white",
            color:"#0D5252",fontFamily:"Nunito,sans-serif",fontSize:13,
            fontWeight:700,cursor:"pointer",
            boxShadow:"0 2px 8px rgba(13,82,82,0.08)"}}>
          👀 Browse as Guest
        </button>
        <p style={{textAlign:"center",fontSize:11,color:"#9EB8B8",marginTop:8}}>
          Guest mode lets you search threads but won't save your stash.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function App({ supabase, user, isGuest, onGuestMode, onSignIn }) {
  const userId = user?.id||null;
  // Expose supabase on window so child components (CrossRefTab) can use precomputed table
  if(supabase) window._supabaseClient = supabase;

  // Always start on Home tab
  useEffect(()=>{ setTab("home"); },[]);

  // ── State ─────────────────────────────────────────────────
  const [tab, setTab]                 = useState("home");
  const [subTab, setSubTab]           = useState("thread"); // match sub-tabs
  const [moreSubTab, setMoreSubTab]   = useState("machines");
  const [threads, setThreads]         = useState(starterThreads);
  const [supaAllThreads, setSupaAllThreads] = useState([]); // unified thread_library — all brands
  const [form, setForm]               = useState(emptyForm);
  const [message, setMessage]         = useState("");
  const [settings, setSettings]       = useState(()=>{ const saved=localStorage.getItem("hh_settings"); return saved?JSON.parse(saved):{showBarcodes:true,showWeights:true,autoAddZeroInventoryToShoppingList:true,defaultMatchMode:"thread",defaultBrand:"Isacord",crossRefBrand:""}; });
  const [syncMeta, setSyncMeta]       = useState({ appVersion:APP_VERSION,libraryVersion:"1.0.0",remoteLibraryVersion:"1.0.0",status:"Ready",lastSynced:"Never",hasUpdate:false });
  const [lang, setLang]               = useState(()=>localStorage.getItem("hh_lang")||"en-US");
  useEffect(()=>{localStorage.setItem("hh_lang",lang);},[lang]);
  useEffect(()=>{localStorage.setItem("hh_settings",JSON.stringify(settings));},[settings]);
  // Apply default brand from settings on mount
  useEffect(()=>{ if(settings.defaultBrand) setMatchBrand(settings.defaultBrand); },[]);

  // Match state
  const [matchBrand, setMatchBrand]           = useState("Isacord");
  const [matchQuery, setMatchQuery]           = useState("");
  const [colorFamilyKey, setColorFamilyKey]   = useState("All"); // ALWAYS an English key
  const [cameraImage, setCameraImage]         = useState(null);
  const [cameraSample, setCameraSample]       = useState(null);
  const [pendingBarcode, setPendingBarcode]   = useState(null);
  const [showAddThread, setShowAddThread]     = useState(false);

  // Shopping / projects
  const [shoppingList, setShoppingList]                   = useState([]);
  const [projects, setProjects]                           = useState([{id:"proj-1",name:"Autumn Leaves Quilt",status:"Planning",notes:"",requiredThreads:[]}]);
  const [selectedProjectId, setSelectedProjectId]         = useState("proj-1");
  const [showNewProject, setShowNewProject]               = useState(false);
  const [newProjectForm, setNewProjectForm]               = useState(emptyProject);
  const [projectEntryMode, setProjectEntryMode]           = useState("manual");
  const [projectThreadInput, setProjectThreadInput]       = useState("");
  const [projectScanInput, setProjectScanInput]           = useState("");

  // ── Load cache ────────────────────────────────────────────
  useEffect(()=>{
    try{
      const cached=localStorage.getItem(LOCAL_LIBRARY_KEY);
      const meta=localStorage.getItem(LOCAL_SYNC_META);
      if(cached){const p=JSON.parse(cached);if(Array.isArray(p))setThreads(p);}
      if(meta){const p=JSON.parse(meta);setSyncMeta(c=>({...c,...p}));}
    }catch(e){console.error(e);}
  },[]);

  // ── Load thread library (single unified table) ──────────────
  const [threadLoadStatus, setThreadLoadStatus] = useState("loading");
  useEffect(()=>{
    if(!supabase){ setThreadLoadStatus("no-db"); return; }
    async function loadThreads(){
      setThreadLoadStatus("loading");
      let allRows=[]; let from=0; const pageSize=1000;
      while(true){
        const{data,error}=await supabase
          .from("thread_library")
          .select("id,brand,brand_key,color_code,color_name,hex_color,fiber_type,weight,thread_type,nearest_isacord,barcode,family")
          .order("color_name")
          .range(from,from+pageSize-1);
        if(error){ console.error("thread_library load error:",error.message); setThreadLoadStatus("error"); break; }
        if(!data||data.length===0) break;
        allRows=[...allRows,...data];
        if(data.length<pageSize) break;
        from+=pageSize;
      }
      if(allRows.length>0){
        console.log(`✓ Loaded ${allRows.length} thread colors from thread_library`);
        setSupaAllThreads(allRows);
        setThreadLoadStatus("ok");
      } else {
        console.warn("thread_library returned 0 rows — check RLS policy");
        setThreadLoadStatus("empty");
      }
    }
    loadThreads();
  },[supabase]);

  // ── Derived ───────────────────────────────────────────────
  const displayThreads = supaAllThreads.length>0 ? supaAllThreads : threads;
  const lowStockCount  = useMemo(()=>threads.filter(t=>t.spools<=Math.max(1,(t.inventoryTarget||0)-1)).length,[threads]);
  const belowTargetCount = useMemo(()=>threads.filter(t=>(t.spools||0)<(t.inventoryTarget||0)).length,[threads]);

  const autoShoppingItems = useMemo(()=>{
    if(!settings.autoAddZeroInventoryToShoppingList)return[];
    return threads.filter(t=>(t.spools||0)===0).map(thread=>({
      id:`auto-${thread.id}`,threadId:thread.id,name:thread.name,
      primary:thread.brands?.primary||thread.brands?.isacord||"—",
      isacord:thread.isacord,barcode:thread.barcode,spoolSize:thread.spoolSize,
      inventoryTarget:thread.inventoryTarget,qty:1,source:"auto"
    }));
  },[threads,settings.autoAddZeroInventoryToShoppingList]);

  const mergedShoppingList = useMemo(()=>{
    const map=new Map();
    [...autoShoppingItems,...shoppingList].forEach(item=>{
      const key=`${item.threadId}-${item.spoolSize}`;
      if(!map.has(key))map.set(key,{...item});
      else{const e=map.get(key);map.set(key,{...e,qty:e.qty+item.qty,source:e.source===item.source?e.source:"mixed"});}
    });
    return Array.from(map.values());
  },[autoShoppingItems,shoppingList]);

  const selectedProject = useMemo(()=>projects.find(p=>p.id===selectedProjectId)||projects[0],[projects,selectedProjectId]);

  // ── Thread match filter ──────────────────────────────────
  // Uses thread_library_all for all brands (consistent behavior across every brand)
  // Results always sorted alphabetically by color_name
  const filteredMatchResults = useMemo(()=>{
    const q = normalized(matchQuery).trim();
    const hasFilter = colorFamilyKey !== "All";
    const hasQuery  = q.length > 0;

    // Require at least a color family OR a search query
    if(!hasFilter && !hasQuery) return [];

    // Fabric search — uses local threads (they have fabric brand cross-reference fields)
    if(subTab==="fabric"){
      const brandKey=fabricBrands.find(([label])=>label===matchBrand)?.[1]||matchBrand;
      return [...threads].filter(thread=>
        normalized(thread.fabrics?.[brandKey]).includes(q)||normalized(thread.family).includes(q)
      ).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,80);
    }

    // Thread search — use thread_library_all if available, else local fallback
    if(supaAllThreads.length > 0){
      // Get the brand_key for the selected brand
      const bk = brandKeyMap[matchBrand] || normalized(matchBrand).replace(/[^a-z0-9]/g,"_");

      // Build Isacord hex map for nearest_isacord fallback
      // thread_library columns: isacord (code), hex or swatch (color)
      // Build hex map from Isacord entries in thread_library_all
      const isacordHexMap = {};
      supaAllThreads.forEach(t => {
        if(t.brand_key === "isacord" && t.color_code && t.hex_color)
          isacordHexMap[t.color_code] = t.hex_color;
      });

      let results = supaAllThreads.filter(thread=>{
        // Filter by brand
        if(thread.brand_key !== bk) return false;

        // Filter by search query if present
        if(hasQuery){
          const matchesQuery = normalized(thread.color_name).includes(q) ||
                               normalized(thread.color_code).includes(q) ||
                               normalized(thread.brand).includes(q);
          if(!matchesQuery) return false;
        }

        // Filter by color family if selected
        if(hasFilter){
          // Use thread's own hex_color, or fall back to nearest_isacord hex
          const effectiveHex = thread.hex_color ||
            (thread.nearest_isacord ? isacordHexMap[thread.nearest_isacord] : null);
          const threadWithHex = {...thread, hex_color: effectiveHex};
          if(hexToFamilyKey(threadWithHex) !== colorFamilyKey) return false;
        }

        return true;
      });

      results.sort((a,b)=>a.color_name.localeCompare(b.color_name));
      // Guest restrictions: Isacord only, 10 results max
      if(!user || isGuest){
        results = results.filter(t=>t.brand_key==="isacord");
        return results.slice(0,10);
      }
      return results.slice(0,100);
    }

    // Local fallback (no Supabase) — use local thread-library.json
    const brandKey = threadBrands.find(([label])=>label===matchBrand)?.[1]||"isacord";
    let results = threads.filter(thread=>{
      if(hasQuery){
        const matchesQuery = [thread.name, thread.isacord, thread.barcode,
                              thread.brands?.[brandKey], thread.brands?.primary]
                             .some(v=>normalized(v).includes(q));
        if(!matchesQuery) return false;
      }
      if(hasFilter){
        if(hexToFamilyKey(thread) !== colorFamilyKey) return false;
      }
      return true;
    });
    results.sort((a,b)=>(a.name||"").localeCompare(b.name||""));
    return results.slice(0,100);
  },[supaAllThreads,threads,matchQuery,subTab,matchBrand,colorFamilyKey,user,isGuest]);

  const cameraMatches = useMemo(()=>{
    if(!cameraSample)return[];
    const sampleRgb={r:cameraSample.r,g:cameraSample.g,b:cameraSample.b};
    return [...displayThreads]
      .map(thread=>({thread,dist:colorDistance(sampleRgb,hexToRgb(thread.hex_color||thread.hex||thread.swatch))}))
      .sort((a,b)=>a.dist-b.dist).slice(0,5).map(item=>item.thread);
  },[cameraSample,displayThreads]);

  // ── Persistence ───────────────────────────────────────────
  const persistLibrary=nextThreads=>{setThreads(nextThreads);localStorage.setItem(LOCAL_LIBRARY_KEY,JSON.stringify(nextThreads));};
  const persistSyncMeta=nextMeta=>{setSyncMeta(nextMeta);localStorage.setItem(LOCAL_SYNC_META,JSON.stringify(nextMeta));};

  // ── Thread actions ────────────────────────────────────────
  const addThread=()=>{
    if(!form.name.trim()){setMessage("Please enter a thread name.");return;}
    const spools=Math.max(0,Number(form.spools||0));
    const inventoryTarget=Math.max(0,Number(form.inventoryTarget||0));
    const newThread={
      id:Date.now(),name:form.name.trim(),family:form.family||"Unsorted",
      isacord:form.isacord.trim(),barcode:form.barcode.trim(),weight:form.weight.trim()||"40 wt",
      inventoryTarget,spools,spoolSize:form.spoolSize,owned:spools>0,
      lowStock:spools<=Math.max(1,inventoryTarget-1),swatch:form.swatch,hex:form.swatch,rgb:"",
      brands:{primary:form.isacord?`Isacord ${form.isacord}`:form.name.trim(),isacord:form.isacord?`Isacord ${form.isacord}`:"",glide:"",floriani:"",madeira:"",sulky:"",aurifil:"",omni:"",kingTut:"",soFine:"",gutermann:"",mettler:"",robisonAnton:"",coatsClark:""},
      fabrics:{kona:"",bella:"",agf:"",freespirit:"",michaelMiller:"",windham:"",clothworks:"",hoffman:""}
    };
    persistLibrary([newThread,...threads]);
    setForm(emptyForm);setMessage(`${newThread.name} added.`);setShowAddThread(false);
  };
  const updateSpools=(id,delta)=>{
    persistLibrary(threads.map(thread=>{
      if(thread.id!==id)return thread;
      const spools=Math.max(0,thread.spools+delta);
      return{...thread,spools,owned:spools>0,lowStock:spools<=Math.max(1,(thread.inventoryTarget||0)-1)};
    }));
  };
  const updateInventoryTarget=(id,value)=>{
    const target=Math.max(0,Number(value||0));
    persistLibrary(threads.map(thread=>{
      if(thread.id!==id)return thread;
      return{...thread,inventoryTarget:target,lowStock:(thread.spools||0)<=Math.max(1,target-1)};
    }));
  };
  const addManualShoppingItem=thread=>{
    const name  = thread.color_name||thread.name||"Thread";
    const brand = thread.brand||thread.brands?.primary||"";
    const code  = thread.color_code||thread.code||"";
    setShoppingList(c=>[...c,{
      id:`${thread.id||code}-${Date.now()}`,
      threadId:thread.id||code,
      name,brand,code,
      hex_color:thread.hex_color||thread.hex||thread.swatch||"",
      fiber_type:thread.fiber_type||"",
      weight:thread.weight||"",
      qty:1,source:"manual"
    }]);
    setMessage(`${brand} ${code} — ${name} added to shopping list!`);
  };
  const removeShoppingItem=id=>setShoppingList(c=>c.filter(item=>item.id!==id));
  const addProjectRequiredThread=thread=>{
    const name  = thread.color_name||thread.name||"Thread";
    const brand = thread.brand||thread.brands?.primary||"";
    const code  = thread.color_code||thread.code||"";
    const tid   = thread.id||code;
    setProjects(c=>c.map(project=>{
      if(project.id!==selectedProjectId)return project;
      if(project.requiredThreads.some(item=>item.threadId===tid))return project;
      return{...project,requiredThreads:[...project.requiredThreads,{
        id:`${project.id}-${tid}`,threadId:tid,
        name,brand,code,
        hex_color:thread.hex_color||thread.hex||thread.swatch||"",
        weight:thread.weight||"",
        fiber_type:thread.fiber_type||""
      }]};
    }));
    setMessage(`${brand} ${code} — ${name} added to "${projects.find(p=>p.id===selectedProjectId)?.name||"project"}"!`);
  };
  const createProject=()=>{
    if(!newProjectForm.name.trim()){setMessage("Please enter a project name.");return;}
    const id=`proj-${Date.now()}`;
    setProjects(c=>[...c,{id,...newProjectForm,requiredThreads:[]}]);
    setSelectedProjectId(id);setNewProjectForm(emptyProject);setShowNewProject(false);
    setMessage(`Project "${newProjectForm.name}" created!`);
  };
  const removeProjectThread=threadId=>{setProjects(c=>c.map(p=>p.id===selectedProjectId?{...p,requiredThreads:p.requiredThreads.filter(i=>i.threadId!==threadId)}:p));};
  const addProjectThreadFromManual=()=>{
    const q=normalized(projectThreadInput).trim();if(!q)return;
    const found=threads.find(thread=>[thread.name,thread.isacord,thread.barcode,thread.brands?.primary].some(v=>normalized(v).includes(q)));
    if(!found)return setMessage("No thread found.");
    addProjectRequiredThread(found);setProjectThreadInput("");
  };
  const addProjectThreadFromScan=()=>{
    const q=normalized(projectScanInput).trim();if(!q)return;
    const found=threads.find(thread=>normalized(thread.barcode)===q||normalized(thread.isacord)===q);
    if(!found)return setMessage("No thread found for that scan.");
    addProjectRequiredThread(found);setProjectScanInput("");
  };
  const handleCameraImageUpload=event=>{
    const file=event.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{setCameraImage(reader.result);setCameraSample(null);};
    reader.readAsDataURL(file);
  };
  const handleImageSample=event=>{
    const img=event.currentTarget;const rect=img.getBoundingClientRect();
    const canvas=document.createElement("canvas");
    canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    const ctx=canvas.getContext("2d");if(!ctx)return;
    ctx.drawImage(img,0,0);
    const x=Math.max(0,Math.min(rect.width-1,event.clientX-rect.left));
    const y=Math.max(0,Math.min(rect.height-1,event.clientY-rect.top));
    const px=Math.floor((x/rect.width)*img.naturalWidth);
    const py=Math.floor((y/rect.height)*img.naturalHeight);
    const data=ctx.getImageData(px,py,1,1).data;
    const hex=`#${[data[0],data[1],data[2]].map(v=>v.toString(16).padStart(2,"0")).join("").toUpperCase()}`;
    setCameraSample({hex,r:data[0],g:data[1],b:data[2]});
  };
  const handleCameraMatchWithBarcode=useCallback(async thread=>{
    if(pendingBarcode&&supabase&&userId){
      try{
        await supabase.from("thread_barcodes").upsert({barcode:pendingBarcode,brand_key:"isacord",color_code:thread.color_code||thread.code||thread.name,first_scanned_by:userId,confirmed_count:1},{onConflict:"barcode"});
        setMessage("Barcode saved for the community!");
      }catch(e){console.error(e);}
      setPendingBarcode(null);
    }
  },[pendingBarcode,supabase,userId]);
  const addToUserInventory=async thread=>{
    const label = `${thread.brand||"Thread"} ${thread.color_code||thread.code||""} — ${thread.color_name||thread.name||""}`.trim();
    try{
      if(supabase&&userId&&thread.id){
        // Store directly in user_inventory using thread_library_all id
        // Single thread_library table — thread.id is always the FK
        const{error}=await supabase.from("user_inventory")
          .upsert({user_id:userId,thread_id:thread.id,spool_count:1},{onConflict:"user_id,thread_id"});
        if(error){
          console.error("user_inventory upsert error:",error.message);
          saveThreadToLocalStash(thread);
          setMessage(`${label} saved locally.`);
          return;
        }
        if(error){
          console.error("user_inventory upsert error:",error.message);
          // If FK fails (thread_id not in thread_library), save to local stash instead
          saveThreadToLocalStash(thread);
          setMessage(`${label} saved to local stash.`);
          return;
        }
        setMessage(`${label} added to your stash!`);
        return;
      }
    }catch(e){
      console.error("addToUserInventory error:",e);
    }
    // Offline / no supabase — save locally
    saveThreadToLocalStash(thread);
    setMessage(`${label} saved to local stash.`);
  };

  const saveThreadToLocalStash=thread=>{
    const key="hh_thread_stash";
    const existing=JSON.parse(localStorage.getItem(key)||"[]");
    const id=thread.id||thread.color_code||thread.code;
    if(!existing.find(t=>t.id===id)){
      localStorage.setItem(key,JSON.stringify([...existing,{
        id,brand:thread.brand||"",brand_key:thread.brand_key||"",
        color_code:thread.color_code||thread.code||"",
        color_name:thread.color_name||thread.name||"",
        hex_color:thread.hex_color||thread.hex||thread.swatch||"",
        fiber_type:thread.fiber_type||"",weight:thread.weight||"",
        quantity:1,added:new Date().toISOString()
      }]));
    }
  };

  // ── Export stash as CSV ───────────────────────────────────
  const exportStash = async () => {
    const rows = [];
    const ts = new Date().toISOString().slice(0,10);

    // Helper to escape CSV fields
    const esc = v => `"${String(v||"").replace(/"/g,'""')}"`;

    if(supabase && userId){
      // Fetch all stash sections from Supabase
      const [{data:th},{data:ru},{data:ma},{data:di},{data:fe}] = await Promise.all([
        supabase.from("user_inventory")
          .select("spool_count,thread_library(brand,color_code,color_name,hex_color,fiber_type,weight)")
          .eq("user_id",userId),
        supabase.from("user_rulers")
          .select("quantity,ruler_library(brand,model,shape,size_inches,material)")
          .eq("user_id",userId),
        supabase.from("user_machines")
          .select("serial_number,purchase_date,purchase_price,dealer,warranty_until,user_notes,machine_library(brand,model,type,category)")
          .eq("user_id",userId),
        supabase.from("user_dies")
          .select("quantity,machine_library(brand,model,category)")
          .eq("user_id",userId),
        supabase.from("user_feet")
          .select("quantity,feet_library(brand,foot_name,category,shank_type)")
          .eq("user_id",userId),
      ]);

      // THREADS
      rows.push("THREADS");
      rows.push(["Type","Brand","Code","Color Name","Hex Color","Fiber","Weight","Spools"].map(esc).join(","));
      (th||[]).forEach(item => {
        const t = item.thread_library;
        if(!t) return;
        rows.push(["Thread",t.brand||"",t.color_code||"",t.color_name||"",t.hex_color||"",t.fiber_type||"",t.weight||"",item.spool_count||1].map(esc).join(","));
      });

      // RULERS
      rows.push("");
      rows.push("RULERS");
      rows.push(["Type","Brand","Model","Shape","Size","Material","Quantity"].map(esc).join(","));
      (ru||[]).forEach(item => {
        const r = item.ruler_library;
        if(!r) return;
        rows.push(["Ruler",r.brand,r.model,r.shape,r.size_inches,r.material,item.quantity].map(esc).join(","));
      });

      // MACHINES
      rows.push("");
      rows.push("MACHINES");
      rows.push(["Type","Brand","Model","Category","Serial Number","Purchase Date","Purchase Price","Dealer","Warranty Until","Notes"].map(esc).join(","));
      (ma||[]).forEach(item => {
        const m = item.machine_library;
        if(!m) return;
        rows.push([
          "Machine", m.brand, m.model, m.category,
          item.serial_number||"", item.purchase_date||"",
          item.purchase_price||"", item.dealer||"",
          item.warranty_until||"", item.user_notes||""
        ].map(esc).join(","));
      });

      // ACCUQUILT DIES
      rows.push("");
      rows.push("ACCUQUILT DIES");
      rows.push(["Type","Brand","Model","Category","Quantity"].map(esc).join(","));
      (di||[]).forEach(item => {
        const d = item.machine_library;
        if(!d) return;
        rows.push(["AccuQuilt Die",d.brand,d.model,d.category,item.quantity||1].map(esc).join(","));
      });

      // FEET
      rows.push("");
      rows.push("PRESSER FEET");
      rows.push(["Type","Brand","Foot Name","Category","Shank Type","Quantity"].map(esc).join(","));
      (fe||[]).forEach(item => {
        const f = item.feet_library;
        if(!f) return;
        rows.push(["Presser Foot",f.brand,f.foot_name,f.category,f.shank_type,item.quantity||1].map(esc).join(","));
      });
    } else {
      // Local threads only
      rows.push("THREADS (Local Library)");
      rows.push(["Name","Isacord Code","Barcode","Weight","Spools","Spool Size","Inventory Target","Color Family","Hex Color"].map(esc).join(","));
      threads.forEach(t => {
        rows.push([
          t.name, t.isacord||"", t.barcode||"", t.weight||"",
          t.spools||0, t.spoolSize||"", t.inventoryTarget||0,
          t.family||"", t.hex||t.swatch||""
        ].map(esc).join(","));
      });
    }

    // ACCESSORIES (localStorage)
    const savedAcc = JSON.parse(localStorage.getItem("hh_accessories")||"[]");
    if(savedAcc.length > 0){
      rows.push("");
      rows.push("ACCESSORIES");
      rows.push(["Type","Name","Quantity","Notes"].map(esc).join(","));
      savedAcc.forEach(a => {
        rows.push(["Accessory",a.name,a.quantity||1,a.notes||""].map(esc).join(","));
      });
    }

    // Generate and download
    const csv = rows.join("\n");
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `haberdash-haven-stash-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage("Stash exported! Check your downloads folder.");
  };

  const checkForUpdates=async()=>{
    try{ const r=await fetch("/data/library-version.json",{cache:"no-store"}); const j=await r.json(); const rv=j.libraryVersion||j.version||syncMeta.libraryVersion; persistSyncMeta({...syncMeta,remoteLibraryVersion:rv,status:versionCompare(rv,syncMeta.libraryVersion)>0?"Update available":"Library up to date",hasUpdate:versionCompare(rv,syncMeta.libraryVersion)>0}); }
    catch{persistSyncMeta({...syncMeta,status:"Sync check unavailable"});}
  };
  const runAutoSync=async()=>{
    try{
      persistSyncMeta({...syncMeta,status:"Syncing…"});
      const vr=await fetch("/data/library-version.json",{cache:"no-store"}); const vj=await vr.json(); const rv=vj.libraryVersion||vj.version||syncMeta.libraryVersion;
      if(versionCompare(rv,syncMeta.libraryVersion)<=0){persistSyncMeta({...syncMeta,remoteLibraryVersion:rv,status:"Library already current",hasUpdate:false});return;}
      const lr=await fetch("/data/thread-library.json",{cache:"no-store"}); const lj=await lr.json();
      if(!Array.isArray(lj))throw new Error("Bad library");
      persistLibrary(lj);
      persistSyncMeta({appVersion:APP_VERSION,libraryVersion:rv,remoteLibraryVersion:rv,status:"Synced",lastSynced:new Date().toLocaleString(),hasUpdate:false});
      setMessage("Library synced!");
    }catch{persistSyncMeta({...syncMeta,status:"Sync failed"});setMessage("Sync failed.");}
  };

  // ── Match card ────────────────────────────────────────────
  const MatchCard=({thread})=>{
    const [selectedCrossRef, setSelectedCrossRef] = React.useState(settings.crossRefBrand||"");
    const [crossRefResult, setCrossRefResult]     = React.useState(null);

    const isAllBrandsRow = thread.brand_key !== undefined && thread.color_code !== undefined;
    const isSupaThread   = !isAllBrandsRow && thread.code !== undefined && thread.color_name !== undefined && !thread.brands;
    // Use hex_color or construct from r,g,b columns
    const hex = thread.hex_color || thread.hex || thread.swatch ||
      (thread.r!=null ? `#${[thread.r,thread.g,thread.b].map(v=>v.toString(16).padStart(2,'0')).join('')}` : "#CCCCCC");
    const displayName    = isAllBrandsRow
      ? `${thread.color_code} — ${thread.color_name}`
      : isSupaThread ? `${thread.code} — ${thread.color_name}` : thread.name;
    const displayBrand   = isAllBrandsRow
      ? thread.brand
      : isSupaThread ? (thread.manufacturer||"Isacord") : (thread.brands?.primary||"—");
    const currentBrandKey = thread.brand_key||"isacord";

    // Find nearest equivalent whenever selected brand changes
    React.useEffect(()=>{
      if(!selectedCrossRef){ setCrossRefResult(null); return; }
      const bk = brandKeyMap[selectedCrossRef]||normalized(selectedCrossRef).replace(/[^a-z0-9]/g,"_");
      if(bk===currentBrandKey){ setCrossRefResult(null); return; }
      const nearest = findNearestInBrand(hex, bk, supaAllThreads);
      setCrossRefResult(nearest);
    },[selectedCrossRef, hex]);

    return(
      <div className="card">
        {/* Swatch + name */}
        <div className="thread-row">
          <div className="swatch" style={{background:hex}}/>
          <div style={{flex:1}}>
            <div className="thread-name">{displayName}</div>
            <div className="muted">{displayBrand}</div>
          </div>
        </div>

        {/* Thread details */}
        {(isAllBrandsRow||isSupaThread)&&(
          <div className="list-box">
            <div><b>Code:</b> {thread.color_code||thread.code}</div>
            {thread.fiber_type&&<div><b>Fiber:</b> {thread.fiber_type}{thread.weight?` · ${thread.weight}`:""}</div>}
            <div><b>Color family:</b> {hexToFamilyKey(thread)}</div>
          </div>
        )}
        {!isAllBrandsRow&&!isSupaThread&&(
          <div className="list-box">
            {settings.showBarcodes&&thread.barcode&&<div><b>Barcode:</b> {thread.barcode}</div>}
            {thread.weight&&<div><b>Weight:</b> {thread.weight}</div>}
          </div>
        )}

        {/* ── Find equivalent in another brand ── */}
        {supaAllThreads.length>0&&(isAllBrandsRow||isSupaThread)&&(
          <div style={{
            marginTop:10,padding:"10px 12px",
            background:"var(--sun-wash)",
            border:"1.5px solid var(--border-sun)",
            borderRadius:"var(--r-sm)"
          }}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:12,fontWeight:700,color:"var(--teal)",whiteSpace:"nowrap"}}>
                Find equivalent in:
              </span>
              <select
                value={selectedCrossRef}
                onChange={e=>setSelectedCrossRef(e.target.value)}
                style={{
                  flex:1,minWidth:140,padding:"5px 10px",
                  border:"1.5px solid var(--border-sun)",
                  borderRadius:"var(--r-sm)",
                  background:"var(--warm-white)",
                  fontFamily:"Nunito,sans-serif",
                  fontSize:13,fontWeight:600,color:"var(--ink)",
                  cursor:"pointer",outline:"none"
                }}
              >
                <option value="">— choose a brand —</option>
                {threadBrands
                  .filter(([,bk])=>bk!==currentBrandKey)
                  .map(([label])=>(
                    <option key={label} value={label}>{label}</option>
                  ))
                }
              </select>
            </div>

            {/* Result */}
            {selectedCrossRef&&crossRefResult&&(
              <div style={{
                display:"flex",alignItems:"center",gap:10,marginTop:8,
                padding:"8px 10px",
                background:"var(--warm-white)",
                border:"1.5px solid var(--border-teal)",
                borderRadius:"var(--r-sm)",
                boxShadow:"var(--shadow-xs)"
              }}>
                {crossRefResult.hex_color&&(
                  <div style={{
                    width:32,height:32,borderRadius:"50%",flexShrink:0,
                    background:crossRefResult.hex_color,
                    border:"2px solid rgba(255,255,255,0.6)",
                    boxShadow:"0 2px 6px rgba(0,0,0,0.18),inset 0 1px 3px rgba(255,255,255,0.3)"
                  }}/>
                )}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,color:"var(--ink)"}}>
                    {crossRefResult.color_code} — {crossRefResult.color_name}
                  </div>
                  <div style={{fontSize:11,color:"var(--muted)"}}>
                    {crossRefResult.brand}{crossRefResult.fiber_type?` · ${crossRefResult.fiber_type}`:""}
                  </div>
                </div>
                <button
                  className="btn active"
                  style={{fontSize:11,padding:"5px 10px",flexShrink:0}}
                  onClick={()=>addToUserInventory(crossRefResult)}
                >+ Add</button>
              </div>
            )}
            {selectedCrossRef&&!crossRefResult&&(
              <p style={{fontSize:12,color:"var(--muted)",marginTop:8}}>
                No {selectedCrossRef} colors loaded.
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="button-row">
          <button className="btn active" onClick={()=>addToUserInventory(thread)}>+ Add to Stash</button>
          <button className="btn" onClick={()=>addProjectRequiredThread(thread)}>Add to Project</button>
          <button className="btn" onClick={()=>addManualShoppingItem(thread)}>Shopping List</button>
        </div>
      </div>
    );
  };

  // ── 4 main tabs ───────────────────────────────────────────
  const mainTabs=[["home","Home"],["match","Match"],["stash","Stash"],["projects","Projects"],["more","More"]];

  // Auth gate — MUST be after all hooks
  if(supabase && !user){
    return <AuthScreen
      supabase={supabase}
      onGuest={onGuestMode||(() => {})}
      onSignIn={onSignIn}
    />;
  }

  return(
    <div className="app-shell">
      <header className="hero card dark">
        <div className="hero-inner">
          <img src="/HH_Logo.png" alt="Haberdash Haven Logo" className="hero-logo" />
          <div className="hero-text">
            <div className="brand"><span className="brand-accent">✿</span> Haberdash Haven</div>
            <div className="tagline">Making the world a better place. One stitch at a time...</div>
          </div>
        </div>
        <div className="hero-bar"></div>
      </header>

      {/* ── 4-tab main nav ── */}
      <nav className="nav-row main-nav">
        {mainTabs.map(([key,label])=>(
          <button key={key} className={`btn ${tab===key?"active":""}`}
            onClick={()=>setTab(key)}
            style={{flex:1,textAlign:"center"}}>
            {label}
          </button>
        ))}
      </nav>

      {message&&<div className="message" onClick={()=>setMessage("")}>{message} ✕</div>}

      {/* ══════════════════════════════════════════════════════
          HOME
          ══════════════════════════════════════════════════════ */}
      {tab==="home"&&(
        <div>
          <div className="card">
            <div className="stats-grid">
              <div className="stat-box"><div className="stat-num">{supaAllThreads.length>0?supaAllThreads.length:threads.length}</div><div className="stat-label">Thread Colors</div></div>
              <div className="stat-box"><div className="stat-num">{lowStockCount}</div><div className="stat-label">Low Stock</div></div>
              <div className="stat-box"><div className="stat-num">{belowTargetCount}</div><div className="stat-label">Below Target</div></div>
              <div className="stat-box"><div className="stat-num">{mergedShoppingList.length}</div><div className="stat-label">Shopping List</div></div>
            </div>
          </div>
          <div className="card">
            <h2>Quick Actions</h2>
            <div className="quick-grid">
              <button className="quick-btn gold"  onClick={()=>setTab("match")}><span className="icon">🔍</span>Match Thread</button>
              <button className="quick-btn teal"  onClick={()=>setTab("stash")}><span className="icon">◈</span>My Stash</button>
              <button className="quick-btn ocean" onClick={()=>{setTab("more");setMoreSubTab("machines");}}><span className="icon">⚙️</span>Machines</button>
              <button className="quick-btn amber" onClick={()=>{setTab("more");setMoreSubTab("accuquilt");}}><span className="icon">◈</span>AccuQuilt</button>
              <button className="quick-btn green" onClick={()=>{setTab("more");setMoreSubTab("projects");}}><span className="icon">◉</span>Projects</button>
              <button className="quick-btn navy"  onClick={()=>{setTab("more");setMoreSubTab("settings");}}><span className="icon">⚙</span>Settings</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MATCH — sub-tabs: Thread | Camera | Fabric | Barcode
          ══════════════════════════════════════════════════════ */}
      {tab==="match"&&(
        <>
          {/* Sub-tab row */}
          <div className="sub-tab-row">
            {[["thread","🔍 Thread"],["crossref","⇄ Cross-Ref"],["camera","📷 Camera"],["fabric","◈ Fabric"],["barcode","▦ Barcode"]].map(([key,label])=>(
              <button key={key} className={`sub-tab ${subTab===key?"active":""}`} onClick={()=>setSubTab(key)}>
                {label}
              </button>
            ))}
          </div>

          {/* Thread search */}
          {subTab==="thread"&&(
            <>
              <div className="card">
                {/* Status bar — shows load state and count */}
                <div style={{
                  marginBottom:12, padding:"7px 12px",
                  borderRadius:"var(--r-sm)",
                  fontSize:12, fontWeight:600,
                  background: threadLoadStatus==="ok-all" ? "var(--leaf-light)"
                            : threadLoadStatus.startsWith("ok-") ? "var(--sun-pale)"
                            : threadLoadStatus==="loading" ? "var(--sky-pale)"
                            : threadLoadStatus==="local" ? "#FDECEA"
                            : "var(--teal-pale)",
                  color: threadLoadStatus==="ok-all" ? "var(--leaf)"
                       : threadLoadStatus.startsWith("ok-") ? "var(--sun-amber)"
                       : threadLoadStatus==="loading" ? "var(--sky-cobalt)"
                       : threadLoadStatus==="local" ? "#C0392B"
                       : "var(--teal)",
                  border:"1px solid",
                  borderColor: threadLoadStatus==="ok-all" ? "var(--leaf-light)"
                             : threadLoadStatus.startsWith("ok-") ? "var(--border-sun)"
                             : threadLoadStatus==="loading" ? "var(--sky-pale)"
                             : "#FDECEA",
                }}>
                  {threadLoadStatus==="loading" && "⏳ Loading threads…"}
                  {threadLoadStatus==="ok" && `✓ ${supaAllThreads.length.toLocaleString()} thread colors across all brands`}
                  {threadLoadStatus==="error" && "⚠ Could not load threads — check RLS policy on thread_library table in Supabase."}
                  {threadLoadStatus==="empty" && "⚠ No thread data found — run the SQL data load steps in Supabase."}
                  {threadLoadStatus==="no-db" && "⚠ No database connection."}
                </div>

                <label>Thread Brand
                  {!user&&<span style={{fontSize:11,color:"var(--sky-cobalt)",marginLeft:6,fontWeight:600}}>
                    (Sign in to access all 26 brands)
                  </span>}
                  <select className="input" value={matchBrand} onChange={e=>setMatchBrand(e.target.value)}
                    disabled={!user||isGuest}>
                    {(user&&!isGuest)
                      ? threadBrands.map(([label])=><option key={label}>{label}</option>)
                      : <option>Isacord</option>
                    
                    }
                  </select>
                </label>
                <label>{t("match_color_family",lang)}
                  <select className="input" value={colorFamilyKey} onChange={e=>setColorFamilyKey(e.target.value)}>
                    {COLOR_FAMILY_KEYS.map((key,i)=>(
                      <option key={key} value={key}>{getColorFamilies(lang)[i]}</option>
                    ))}
                  </select>
                </label>
                <label>Search (name, code, or barcode)
                  <input className="input" value={matchQuery} onChange={e=>setMatchQuery(e.target.value)} placeholder="color name, code… e.g. Navy, 3810, Dusty Rose"/>
                </label>
                {colorFamilyKey==="All"&&!matchQuery&&(
                  <div style={{marginTop:-8}}>
                    {supaAllThreads.length>0?(
                      <p className="muted" style={{fontSize:12}}>
                        {supaAllThreads.filter(t=>t.brand_key===(brandKeyMap[matchBrand]||matchBrand)).length} {matchBrand} colors
                        · {supaAllThreads.length} total across all brands.
                        Choose a color family or type to search.
                      </p>
                    ):supabase?(
                      <p className="muted" style={{fontSize:12,color:"var(--sky-cobalt)"}}>
                        ⏳ Loading thread database… If this takes more than a few seconds,
                        run step 33 SQL in Supabase to fix RLS on thread_library.
                      </p>
                    ):(
                      <p className="muted" style={{fontSize:12}}>
                        {threads.length} local colors available. Sign in to search all brands.
                      </p>
                    )}
                  </div>
                )}
              </div>
              {/* Guest limit banner */}
              {(!user||isGuest)&&filteredMatchResults.length>=10&&(
                <div style={{
                  padding:"14px 16px",marginBottom:8,
                  background:"linear-gradient(135deg, var(--teal) 0%, var(--sky-cobalt) 100%)",
                  borderRadius:"var(--r)",color:"white",textAlign:"center"
                }}>
                  <div style={{fontFamily:"Playfair Display,serif",fontSize:15,fontWeight:700,marginBottom:6}}>
                    Showing 10 of {supaAllThreads.filter(t=>t.brand_key==="isacord").length}+ Isacord colors
                  </div>
                  <p style={{fontSize:12,opacity:0.9,marginBottom:10}}>
                    Sign in to search all {supaAllThreads.length.toLocaleString()} thread colors across 26 brands, use cross-referencing, and save your stash.
                  </p>
                  <button className="btn"
                    style={{background:"var(--sun-gold)",color:"var(--teal)",border:"none",fontWeight:800,padding:"8px 20px"}}
                    onClick={()=>{ if(supabase) { window.location.href=window.location.origin; } }}>
                    Sign In / Create Account
                  </button>
                </div>
              )}

              {filteredMatchResults.length===0&&(matchQuery.trim()||colorFamilyKey!=="All")&&(
                <div className="card">
                  <p className="muted">
                    {supaAllThreads.length===0&&supabase
                      ? "⏳ Still loading thread database — please wait a moment and try again."
                      : `No ${matchBrand} colors found for ${colorFamilyKey!=="All"?`"${colorFamilyKey}"`:""} ${matchQuery?`"${matchQuery}"`:""}. Try a different color family, brand, or search term.`
                    }
                  </p>
                  {supaAllThreads.length===0&&supabase&&(
                    <p style={{fontSize:11,color:"var(--sky-cobalt)",marginTop:6}}>
                      If this persists, run step 33 SQL in Supabase to fix RLS on thread_library.
                    </p>
                  )}
                </div>
              )}
              {filteredMatchResults.map((thread,i)=><MatchCard key={thread.id||thread.code||i} thread={thread}/>)}

              {/* Collapsible manual add */}
              <div className="card" style={{borderStyle:"dashed",borderColor:"#C9A84C"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}} onClick={()=>setShowAddThread(v=>!v)}>
                  <div><div style={{fontWeight:700,color:"#5C4A1E"}}>+ Add a thread manually</div><div className="muted" style={{fontSize:12}}>Can't find it? Add it to your local library.</div></div>
                  <span style={{fontSize:18,color:"#C9A84C"}}>{showAddThread?"▲":"▼"}</span>
                </div>
                {showAddThread&&(
                  <div style={{marginTop:14,borderTop:"1px solid #EEE",paddingTop:14}}>
                    <label>Thread Name<input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
                    <label>Color Family<input className="input" value={form.family} onChange={e=>setForm({...form,family:e.target.value})} placeholder="e.g. Blues, Reds…"/></label>
                    <label>Isacord Code<input className="input" value={form.isacord} onChange={e=>setForm({...form,isacord:e.target.value})}/></label>
                    <label>Barcode<input className="input" value={form.barcode} onChange={e=>setForm({...form,barcode:e.target.value})}/></label>
                    <label>Thread Weight<input className="input" value={form.weight} onChange={e=>setForm({...form,weight:e.target.value})}/></label>
                    <label>Spools on hand<input className="input" type="number" value={form.spools} onChange={e=>setForm({...form,spools:e.target.value})}/></label>
                    <label>Inventory Target<input className="input" type="number" value={form.inventoryTarget} onChange={e=>setForm({...form,inventoryTarget:e.target.value})}/></label>
                    <label>Spool Size<select className="input" value={form.spoolSize} onChange={e=>setForm({...form,spoolSize:e.target.value})}>{commonSpoolSizes.map(s=><option key={s}>{s}</option>)}</select></label>
                    <label>Color Swatch<input className="input" type="color" value={form.swatch} onChange={e=>setForm({...form,swatch:e.target.value})}/></label>
                    <button className="btn active" style={{width:"100%"}} onClick={addThread}>Save Thread to My Stash</button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Cross-Reference tab ── */}
          {subTab==="crossref"&&(
            (!user||isGuest) ? (
              <div className="card" style={{textAlign:"center",padding:"32px 20px"}}>
                <div style={{fontSize:32,marginBottom:10}}>⇄</div>
                <div style={{fontFamily:"Playfair Display,serif",fontSize:16,fontWeight:700,color:"var(--teal)",marginBottom:8}}>
                  Cross-Reference Requires an Account
                </div>
                <p className="muted" style={{fontSize:13,marginBottom:16}}>
                  Sign in to find the nearest color equivalent between any two thread brands using our 486,000+ pre-computed matches.
                </p>
                <button className="btn active" onClick={()=>{ if(supabase) { window.location.href=window.location.origin; } }}>
                  Sign In / Create Account
                </button>
              </div>
            ) : (
            <CrossRefTab
              supaAllThreads={supaAllThreads}
              threadBrands={threadBrands}
              brandKeyMap={brandKeyMap}
              addToUserInventory={addToUserInventory}
              addProjectRequiredThread={addProjectRequiredThread}
              addManualShoppingItem={addManualShoppingItem}
              hexToFamilyKey={hexToFamilyKey}
              settings={settings}
            />
            )
          )}

          {/* Camera match */}
          {subTab==="camera"&&(
            <>
              {pendingBarcode&&(
                <div className="card" style={{borderColor:"#F5C400"}}>
                  <p><b>Identifying barcode:</b> {pendingBarcode}</p>
                  <p className="muted">Take a photo of the thread. Once matched, the barcode is saved for everyone.</p>
                </div>
              )}
              <div className="card">
                <h2>Camera Color Match</h2>
                <input className="input" type="file" accept="image/*" capture="environment" onChange={handleCameraImageUpload}/>
                {cameraImage&&<img src={cameraImage} alt="Sample" className="camera-preview" onClick={handleImageSample}/>}
                {cameraSample&&<div className="list-box"><b>Sampled:</b> {cameraSample.hex} ({cameraSample.r}, {cameraSample.g}, {cameraSample.b})</div>}
              </div>
              {cameraMatches.map((thread,i)=>(
                <div key={thread.id||thread.code||i}>
                  <MatchCard thread={thread}/>
                  {pendingBarcode&&(
                    <div style={{margin:"-8px 0 8px",padding:"0 4px"}}>
                      <button className="btn active" style={{width:"100%"}} onClick={()=>handleCameraMatchWithBarcode(thread)}>✓ This is the thread — save barcode for everyone</button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Fabric match */}
          {subTab==="fabric"&&(
            <>
              <div className="card">
                <h2>Solid Fabric Match</h2>
                <label>Fabric Brand
                  <select className="input" value={matchBrand} onChange={e=>setMatchBrand(e.target.value)}>
                    {fabricBrands.map(([label])=><option key={label}>{label}</option>)}
                  </select>
                </label>
                <label>Search<input className="input" value={matchQuery} onChange={e=>setMatchQuery(e.target.value)} placeholder="Color name or family…"/></label>
              </div>
              {filteredMatchResults.map((thread,i)=><MatchCard key={thread.id||i} thread={thread}/>)}
            </>
          )}

          {/* Barcode scan */}
          {subTab==="barcode"&&(
            <div style={{padding:"8px 0"}}>
              {supabase
                ?<BarcodeScanner supabase={supabase} userId={userId}
                    onAddToStash={thread=>setMessage(`${thread.color_name} added to your stash!`)}
                    onColorMatch={barcode=>{setPendingBarcode(barcode);setSubTab("camera");}}
                  />
                :<div className="card"><p className="muted">Connect to Supabase to use barcode scanning.</p></div>
              }
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          STASH — all inventory in one place
          ══════════════════════════════════════════════════════ */}
      {tab==="stash"&&(
        (!user||isGuest) ? (
          <div className="card" style={{textAlign:"center",padding:"32px 20px"}}>
            <div style={{fontSize:32,marginBottom:10}}>◈</div>
            <div style={{fontFamily:"Playfair Display,serif",fontSize:16,fontWeight:700,color:"var(--teal)",marginBottom:8}}>
              Your Stash Requires an Account
            </div>
            <p className="muted" style={{fontSize:13,marginBottom:16}}>
              Sign in to track your threads, machines, rulers, presser feet, and accessories.
            </p>
            <button className="btn active" onClick={()=>{ if(supabase) { window.location.href=window.location.origin; } }}>
              Sign In / Create Account
            </button>
          </div>
        ) : (
        <UniversalStash
          supabase={supabase} userId={userId}
          shoppingList={shoppingList} mergedShoppingList={mergedShoppingList}
          threads={threads} updateSpools={updateSpools}
          updateInventoryTarget={updateInventoryTarget}
          addManualShoppingItem={addManualShoppingItem}
          removeShoppingItem={removeShoppingItem}
          settings={settings}
        />
      )}

      {/* ══════════════════════════════════════════════════════
          PROJECTS
          ══════════════════════════════════════════════════════ */}
      {tab==="projects"&&(
        <ProjectsTab
          supabase={supabase}
          userId={userId}
          user={user}
          isGuest={isGuest}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={setSelectedProjectId}
          addProjectRequiredThread={addProjectRequiredThread}
          supaAllThreads={supaAllThreads}
        />
      )}



      {/* ══════════════════════════════════════════════════════
          MORE — browse libraries + manage
          ══════════════════════════════════════════════════════ */}
      {tab==="more"&&(
        <>
          {/* More sub-nav */}
          <div className="sub-tab-row">
            {[["machines","⚙️ Machines"],["accuquilt","◈ AccuQuilt"],["feet","👟 Feet"],["rulers","📐 Rulers"],["help","? Help"],["profile","👤 Profile"],["settings","⚙ Settings"]].map(([key,label])=>(
              <button key={key} className={`sub-tab ${moreSubTab===key?"active":""}`} onClick={()=>setMoreSubTab(key)}>{label}</button>
            ))}
          </div>

          {moreSubTab==="machines"&&(supabase?<MachinesBrowser supabase={supabase} userId={userId}/>:<div className="card"><p className="muted">Connect to Supabase to browse machines.</p></div>)}
          {moreSubTab==="accuquilt"&&(supabase?<AccuQuiltBrowser supabase={supabase} userId={userId}/>:<div className="card"><p className="muted">Connect to Supabase to browse AccuQuilt.</p></div>)}
          {moreSubTab==="feet"&&(supabase?<FeetBrowser supabase={supabase} userId={userId}/>:<div className="card"><p className="muted">Connect to Supabase to browse presser feet.</p></div>)}
          {moreSubTab==="rulers"&&(supabase?<RulerBrowser supabase={supabase} userId={userId}/>:<div className="card"><p className="muted">Connect to Supabase to browse rulers.</p></div>)}

          {moreSubTab==="help"&&(
            <div className="card">
              <h2>Help</h2>
              <p><b>Match → Thread:</b> Pick a brand, pick a color family, or type to search. All 4,000+ thread colors across every brand are searchable. Every result has + Add to Stash, Add to Project, and Shopping List buttons.</p>
              <p style={{marginTop:8}}><b>Match → Camera:</b> Photo a fabric or thread, tap the color, get the 5 closest matches.</p>
              <p style={{marginTop:8}}><b>Match → Barcode:</b> Scan any thread spool. Found = instant add to stash. Not found = identify by camera, barcode saved for everyone.</p>
              <p style={{marginTop:8}}><b>Stash:</b> Everything you own in one place — threads, rulers, machines, AccuQuilt dies, feet, and accessories.</p>
              <p style={{marginTop:8}}><b>More → Machines/AccuQuilt/Feet/Rulers:</b> Browse the full libraries and tap + Add to track what you own.</p>
              <p style={{marginTop:8}}><b>More → Projects:</b> Create projects and build required thread lists.</p>
            </div>
          )}

          {moreSubTab==="profile"&&(
            <ProfilePage supabase={supabase} user={user} onBack={()=>setMoreSubTab("settings")}/>
          )}

          {moreSubTab==="settings"&&(
            <div className="card">
              <h2>{t("settings_title",lang)}</h2>
              {/* User info + sign out */}
              {user?(
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"10px 14px",background:"var(--teal-pale)",borderRadius:"var(--r-sm)",
                  border:"1.5px solid var(--border-teal)",marginBottom:14}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:"var(--teal)"}}>
                      {user.user_metadata?.display_name||user.email}
                    </div>
                    <div className="muted" style={{fontSize:11}}>{user.email}</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button className="btn" style={{fontSize:11,padding:"5px 10px"}}
                      onClick={()=>setMoreSubTab("profile")}>
                      ✎ Profile
                    </button>
                    <button className="btn"
                      style={{fontSize:11,padding:"5px 10px",color:"#C0392B",borderColor:"#C0392B"}}
                      onClick={async()=>{
                        // Sign out from Supabase
                        await supabase.auth.signOut({ scope: 'global' });
                        // Nuclear option — clear all localStorage
                        localStorage.clear();
                        sessionStorage.clear();
                        // Hard redirect to force fresh load
                        window.location.replace(window.location.origin);
                      }}>
                      Sign Out
                    </button>
                  </div>
                </div>
              ):(
                <div style={{padding:"10px 14px",background:"var(--sun-pale)",borderRadius:"var(--r-sm)",
                  border:"1.5px solid var(--border-sun)",marginBottom:14}}>
                  <div style={{fontWeight:700,fontSize:13,color:"var(--teal)",marginBottom:4}}>
                    Browsing as Guest
                  </div>
                  <p className="muted" style={{fontSize:12,marginBottom:8}}>
                    Sign in to save your stash, projects, and settings.
                  </p>
                  <button className="btn active" style={{width:"100%",fontSize:12}}
                    onClick={()=>setGuestMode(false)}>
                    Sign In / Create Account
                  </button>
                </div>
              )}
              <label className="check"><input type="checkbox" checked={settings.showBarcodes} onChange={e=>setSettings({...settings,showBarcodes:e.target.checked})}/> {t("settings_show_barcodes",lang)}</label>
              <label className="check"><input type="checkbox" checked={settings.showWeights} onChange={e=>setSettings({...settings,showWeights:e.target.checked})}/> {t("settings_show_weights",lang)}</label>
              <label className="check"><input type="checkbox" checked={settings.autoAddZeroInventoryToShoppingList} onChange={e=>setSettings({...settings,autoAddZeroInventoryToShoppingList:e.target.checked})}/> {t("settings_auto_shop",lang)}</label>
              <label>Default Thread Brand
                <select className="input" value={settings.defaultBrand||"Isacord"} onChange={e=>{setSettings({...settings,defaultBrand:e.target.value});setMatchBrand(e.target.value);}}>
                  {threadBrands.map(([label])=><option key={label}>{label}</option>)}
                </select>
                <span className="muted" style={{fontSize:12,marginTop:-8,display:"block"}}>Pre-selected when you open the Match tab.</span>
              </label>
              <label>Preferred Cross-Reference Brand
                <select className="input" value={settings.crossRefBrand||""} onChange={e=>setSettings({...settings,crossRefBrand:e.target.value})}>
                  <option value="">— None (choose per card) —</option>
                  {threadBrands.map(([label])=><option key={label}>{label}</option>)}
                </select>
                <span className="muted" style={{fontSize:12,marginTop:-8,display:"block"}}>Auto-show equivalent in this brand on every match card. You can still change it per card.</span>
              </label>
              <label>{t("settings_language",lang)}
                <select className="input" value={lang} onChange={e=>setLang(e.target.value)}>
                  {LANGUAGES.map(l=><option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
                </select>
                <span className="muted" style={{fontSize:12,marginTop:-8,display:"block"}}>{t("settings_language_note",lang)}</span>
              </label>
              <div className="list-box">
                <div><b>{t("settings_app_version",lang)}:</b> {syncMeta.appVersion}</div>
                <div><b>{t("settings_lib_version",lang)}:</b> {syncMeta.libraryVersion}</div>
                <div><b>Remote:</b> {syncMeta.remoteLibraryVersion}</div>
                <div><b>{t("settings_last_synced",lang)}:</b> {syncMeta.lastSynced}</div>
                <div><b>{t("settings_status",lang)}:</b> {syncMeta.status}</div>
                {supabase&&<div>{t("settings_connected",lang)}</div>}
                {supaAllThreads.length>0&&<div><b>Thread DB:</b> {supaAllThreads.length} colors across all brands ✓</div>}
              </div>
              <div className="button-row">
                <button className="btn" onClick={checkForUpdates}>{t("settings_check_updates",lang)}</button>
                <button className="btn active" onClick={runAutoSync}>{t("settings_sync",lang)}</button>
              </div>

              {/* ── Export ── */}
              <div className="export-section">
                <div className="export-title">⬇ Export Your Stash</div>
                <p className="muted" style={{fontSize:12,marginBottom:10}}>
                  Downloads a .csv file with all your threads, rulers, machines, AccuQuilt dies, presser feet, and accessories. Open in Excel, Google Sheets, or Numbers.
                </p>
                <button className="btn active" style={{width:"100%"}} onClick={exportStash}>
                  ⬇ Export Stash as CSV
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
