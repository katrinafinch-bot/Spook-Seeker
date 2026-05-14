import React from "react";

// ─────────────────────────────────────────────────────────────
// PROJECTS TAB — Full replacement component
// Drop this into App.jsx replacing the {tab==="projects"&&(...)} block
// ─────────────────────────────────────────────────────────────

// ── STATUS COLORS ────────────────────────────────────────────
const STATUS_COLORS = {
  "Planning":    { bg:"var(--teal-pale)",    text:"var(--teal)",       border:"var(--border-teal)" },
  "In Progress": { bg:"var(--sky-pale)",     text:"var(--sky-cobalt)", border:"var(--sky-pale)" },
  "Paused":      { bg:"#FFF8E1",             text:"var(--sun-amber)",  border:"var(--border-sun)" },
  "On Hold":     { bg:"#FFF8E1",             text:"var(--sun-amber)",  border:"var(--border-sun)" },
  "Complete":    { bg:"var(--leaf-wash)",    text:"var(--leaf)",       border:"var(--leaf-light)" },
  "Gifted":      { bg:"#F3E5F5",             text:"#7B1FA2",           border:"#CE93D8" },
  "Donated":     { bg:"#E8F5E9",             text:"#2E7D32",           border:"#A5D6A7" },
  "Sold":        { bg:"#E3F2FD",             text:"#1565C0",           border:"#90CAF9" },
};
const ALL_STATUSES = ["Planning","In Progress","Paused","On Hold","Complete","Gifted","Donated","Sold"];
const PROJECT_TYPES = ["Quilt","Garment","Embroidery","Bag","Home Decor","Cross Stitch","Appliqué","Other"];

// ── CHECKLIST COMPONENT ───────────────────────────────────────
function ProjectChecklist({ projectId, supabase, userId }) {
  const [items, setItems]       = React.useState([]);
  const [newStep, setNewStep]   = React.useState("");
  const [loading, setLoading]   = React.useState(true);

  React.useEffect(() => {
    if (!supabase || !projectId) return;
    fetchItems();
  }, [projectId]);

  async function fetchItems() {
    setLoading(true);
    const { data } = await supabase
      .from("project_checklist")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .order("step_order");
    setItems(data || []);
    setLoading(false);
  }

  async function addStep() {
    if (!newStep.trim()) return;
    const order = items.length;
    const { data, error } = await supabase
      .from("project_checklist")
      .insert({ project_id: projectId, user_id: userId, step_name: newStep.trim(), step_order: order, is_complete: false })
      .select()
      .single();
    if (!error && data) {
      setItems(c => [...c, data]);
      setNewStep("");
    }
  }

  async function toggleStep(item) {
    const { data } = await supabase
      .from("project_checklist")
      .update({ is_complete: !item.is_complete, completed_date: !item.is_complete ? new Date().toISOString().split("T")[0] : null })
      .eq("id", item.id)
      .select()
      .single();
    if (data) setItems(c => c.map(i => i.id === item.id ? data : i));
  }

  async function deleteStep(id) {
    await supabase.from("project_checklist").delete().eq("id", id);
    setItems(c => c.filter(i => i.id !== id));
  }

  const done = items.filter(i => i.is_complete).length;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "var(--teal)" }}>
          ✓ Checklist {items.length > 0 && <span style={{ fontWeight: 400, color: "var(--muted-warm)" }}>({done}/{items.length})</span>}
        </div>
        {items.length > 0 && (
          <div style={{ height: 6, width: 80, background: "var(--teal-pale)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(done / items.length) * 100}%`, background: "var(--teal)", borderRadius: 3, transition: "width 0.3s" }} />
          </div>
        )}
      </div>
      {loading ? <p className="muted" style={{ fontSize: 11 }}>Loading…</p> : (
        <>
          {items.map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--teal-pale)" }}>
              <button
                onClick={() => toggleStep(item)}
                style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${item.is_complete ? "var(--leaf)" : "var(--border-teal)"}`,
                  background: item.is_complete ? "var(--leaf)" : "white", color: "white", fontSize: 12, cursor: "pointer",
                  flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                {item.is_complete ? "✓" : ""}
              </button>
              <span style={{ flex: 1, fontSize: 12, textDecoration: item.is_complete ? "line-through" : "none",
                color: item.is_complete ? "var(--muted-warm)" : "inherit" }}>
                {item.step_name}
              </span>
              {item.is_complete && item.completed_date && (
                <span style={{ fontSize: 10, color: "var(--muted-warm)" }}>{item.completed_date}</span>
              )}
              <button onClick={() => deleteStep(item.id)}
                style={{ background: "none", border: "none", color: "#C0392B", cursor: "pointer", fontSize: 14, padding: "0 2px", flexShrink: 0 }}>
                ✕
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input className="input" style={{ marginBottom: 0, flex: 1, fontSize: 12 }}
              value={newStep} onChange={e => setNewStep(e.target.value)}
              placeholder="Add a step…"
              onKeyDown={e => e.key === "Enter" && addStep()} />
            <button className="btn active" style={{ fontSize: 11, padding: "5px 10px" }} onClick={addStep}>+</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── COSTS COMPONENT ───────────────────────────────────────────
function ProjectCosts({ projectId, supabase, userId }) {
  const [costs, setCosts]     = React.useState([]);
  const [form, setForm]       = React.useState({ item_description: "", category: "Fabric", amount: "", vendor: "", purchase_date: "" });
  const [show, setShow]       = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const COST_CATS = ["Fabric","Thread","Pattern","Notions","Machine","Batting","Backing","Other"];

  React.useEffect(() => {
    if (!supabase || !projectId) return;
    fetch();
  }, [projectId]);

  async function fetch() {
    setLoading(true);
    const { data } = await supabase
      .from("project_costs")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .order("created_at");
    setCosts(data || []);
    setLoading(false);
  }

  async function addCost() {
    if (!form.item_description.trim() || !form.amount) return;
    const { data, error } = await supabase
      .from("project_costs")
      .insert({ project_id: projectId, user_id: userId, ...form, amount: parseFloat(form.amount) })
      .select().single();
    if (!error && data) {
      setCosts(c => [...c, data]);
      setForm({ item_description: "", category: "Fabric", amount: "", vendor: "", purchase_date: "" });
      setShow(false);
    }
  }

  async function removeCost(id) {
    await supabase.from("project_costs").delete().eq("id", id);
    setCosts(c => c.filter(i => i.id !== id));
  }

  const total = costs.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "var(--teal)" }}>
          💰 Costs {total > 0 && <span style={{ color: "var(--leaf)", fontWeight: 700 }}>${total.toFixed(2)}</span>}
        </div>
        <button className="btn" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => setShow(v => !v)}>
          {show ? "✕" : "+ Add"}
        </button>
      </div>
      {show && (
        <div style={{ background: "var(--linen)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label style={{ fontSize: 11 }}>Item
              <input className="input" style={{ fontSize: 12 }} value={form.item_description}
                onChange={e => setForm({ ...form, item_description: e.target.value })}
                placeholder="e.g. Kona fabric, backing…" />
            </label>
            <label style={{ fontSize: 11 }}>Category
              <select className="input" style={{ fontSize: 12 }} value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}>
                {COST_CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 11 }}>Amount ($)
              <input className="input" type="number" step="0.01" style={{ fontSize: 12 }} value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} />
            </label>
            <label style={{ fontSize: 11 }}>Vendor
              <input className="input" style={{ fontSize: 12 }} value={form.vendor}
                onChange={e => setForm({ ...form, vendor: e.target.value })} placeholder="Shop name…" />
            </label>
          </div>
          <label style={{ fontSize: 11 }}>Date
            <input className="input" type="date" style={{ fontSize: 12 }} value={form.purchase_date}
              onChange={e => setForm({ ...form, purchase_date: e.target.value })} />
          </label>
          <button className="btn active" style={{ width: "100%", fontSize: 12 }} onClick={addCost}>Save Cost</button>
        </div>
      )}
      {!loading && costs.length > 0 && (
        <div>
          {costs.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--teal-pale)" }}>
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--teal-pale)", color: "var(--teal)", flexShrink: 0 }}>{c.category}</span>
              <span style={{ flex: 1, fontSize: 12 }}>{c.item_description}</span>
              {c.vendor && <span style={{ fontSize: 11, color: "var(--muted-warm)" }}>{c.vendor}</span>}
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--leaf)" }}>${parseFloat(c.amount).toFixed(2)}</span>
              <button onClick={() => removeCost(c.id)}
                style={{ background: "none", border: "none", color: "#C0392B", cursor: "pointer", fontSize: 14, padding: "0 2px", flexShrink: 0 }}>✕</button>
            </div>
          ))}
          <div style={{ textAlign: "right", fontSize: 12, fontWeight: 700, color: "var(--teal)", marginTop: 6 }}>
            Total: ${total.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── FABRICS COMPONENT ─────────────────────────────────────────
function ProjectFabrics({ projectId, supabase, userId }) {
  const [fabrics, setFabrics] = React.useState([]);
  const [form, setForm]       = React.useState({ fabric_description: "", color: "", yardage: "", cost_per_yard: "", from_stash: false });
  const [show, setShow]       = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!supabase || !projectId) return;
    fetchFabrics();
  }, [projectId]);

  async function fetchFabrics() {
    setLoading(true);
    const { data } = await supabase
      .from("project_fabrics")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .order("created_at");
    setFabrics(data || []);
    setLoading(false);
  }

  async function addFabric() {
    if (!form.fabric_description.trim()) return;
    const totalCost = form.yardage && form.cost_per_yard
      ? parseFloat(form.yardage) * parseFloat(form.cost_per_yard)
      : null;
    const { data, error } = await supabase
      .from("project_fabrics")
      .insert({
        project_id: projectId, user_id: userId,
        fabric_description: form.fabric_description,
        color: form.color || null,
        yardage: form.yardage ? parseFloat(form.yardage) : null,
        cost_per_yard: form.cost_per_yard ? parseFloat(form.cost_per_yard) : null,
        total_cost: totalCost,
        from_stash: form.from_stash
      })
      .select().single();
    if (!error && data) {
      setFabrics(c => [...c, data]);
      setForm({ fabric_description: "", color: "", yardage: "", cost_per_yard: "", from_stash: false });
      setShow(false);
    }
  }

  async function removeFabric(id) {
    await supabase.from("project_fabrics").delete().eq("id", id);
    setFabrics(c => c.filter(i => i.id !== id));
  }

  const totalYards = fabrics.reduce((sum, f) => sum + parseFloat(f.yardage || 0), 0);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "var(--teal)" }}>
          🧵 Fabrics {totalYards > 0 && <span style={{ fontWeight: 400, color: "var(--muted-warm)" }}>({totalYards.toFixed(1)} yds)</span>}
        </div>
        <button className="btn" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => setShow(v => !v)}>
          {show ? "✕" : "+ Add"}
        </button>
      </div>
      {show && (
        <div style={{ background: "var(--linen)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <label style={{ fontSize: 11 }}>Fabric description
            <input className="input" style={{ fontSize: 12 }} value={form.fabric_description}
              onChange={e => setForm({ ...form, fabric_description: e.target.value })}
              placeholder="e.g. Kona Cotton — Navy, Moda Bella White…" />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <label style={{ fontSize: 11 }}>Color
              <input className="input" style={{ fontSize: 12 }} value={form.color}
                onChange={e => setForm({ ...form, color: e.target.value })} />
            </label>
            <label style={{ fontSize: 11 }}>Yardage
              <input className="input" type="number" step="0.25" style={{ fontSize: 12 }} value={form.yardage}
                onChange={e => setForm({ ...form, yardage: e.target.value })} />
            </label>
            <label style={{ fontSize: 11 }}>$/yard
              <input className="input" type="number" step="0.01" style={{ fontSize: 12 }} value={form.cost_per_yard}
                onChange={e => setForm({ ...form, cost_per_yard: e.target.value })} />
            </label>
          </div>
          <label className="check" style={{ fontSize: 12, marginTop: 4 }}>
            <input type="checkbox" checked={form.from_stash} onChange={e => setForm({ ...form, from_stash: e.target.checked })} />
            {" "}From my stash (no cost)
          </label>
          <button className="btn active" style={{ width: "100%", fontSize: 12, marginTop: 8 }} onClick={addFabric}>Save Fabric</button>
        </div>
      )}
      {!loading && fabrics.length > 0 && (
        <div>
          {fabrics.map(f => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--teal-pale)" }}>
              {f.from_stash && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--leaf-wash)", color: "var(--leaf)", flexShrink: 0 }}>stash</span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{f.fabric_description}</div>
                {f.color && <div style={{ fontSize: 11, color: "var(--muted-warm)" }}>{f.color}</div>}
              </div>
              {f.yardage && <span style={{ fontSize: 11, color: "var(--muted-warm)" }}>{parseFloat(f.yardage).toFixed(2)} yds</span>}
              {f.total_cost && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--leaf)" }}>${parseFloat(f.total_cost).toFixed(2)}</span>}
              <button onClick={() => removeFabric(f.id)}
                style={{ background: "none", border: "none", color: "#C0392B", cursor: "pointer", fontSize: 14, padding: "0 2px", flexShrink: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MAIN PROJECTS TAB ─────────────────────────────────────────
export function ProjectsTab({ supabase, userId, user, isGuest, selectedProjectId, setSelectedProjectId, addProjectRequiredThread, supaAllThreads }) {
  const [projects, setProjects]             = React.useState([]);
  const [loading, setLoading]               = React.useState(true);
  const [showNewForm, setShowNewForm]       = React.useState(false);
  const [editingId, setEditingId]           = React.useState(null);
  const [expandedId, setExpandedId]         = React.useState(null);
  const [activeSection, setActiveSection]   = React.useState({}); // per-project expanded section
  const [message, setMessage]               = React.useState("");

  const emptyForm = { name: "", project_type: "Quilt", status: "Planning", notes: "", start_date: "", due_date: "", recipient: "", estimated_value: "" };
  const [newForm, setNewForm]   = React.useState(emptyForm);
  const [editForm, setEditForm] = React.useState({});

  // Thread add
  const [threadInput, setThreadInput] = React.useState("");
  const [threadResults, setThreadResults] = React.useState([]);

  React.useEffect(() => {
    if (supabase && userId) fetchProjects();
  }, [supabase, userId]);

  React.useEffect(() => {
    if (message) { const t = setTimeout(() => setMessage(""), 3000); return () => clearTimeout(t); }
  }, [message]);

  async function fetchProjects() {
    setLoading(true);
    const { data } = await supabase
      .from("projects")
      .select("*, project_threads(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setProjects(data || []);
    setLoading(false);
  }

  async function createProject() {
    if (!newForm.name.trim()) { setMessage("Please enter a project name."); return; }
    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: userId,
        name: newForm.name.trim(),
        project_type: newForm.project_type,
        status: newForm.status,
        notes: newForm.notes || null,
        start_date: newForm.start_date || null,
        due_date: newForm.due_date || null,
        recipient: newForm.recipient || null,
        estimated_value: newForm.estimated_value ? parseFloat(newForm.estimated_value) : null,
      })
      .select("*, project_threads(*)")
      .single();
    if (!error && data) {
      setProjects(c => [data, ...c]);
      setSelectedProjectId(data.id);
      setNewForm(emptyForm);
      setShowNewForm(false);
      setExpandedId(data.id);
      setMessage(`"${data.name}" created!`);
    }
  }

  async function saveEdit(projectId) {
    const { data, error } = await supabase
      .from("projects")
      .update({
        name: editForm.name,
        project_type: editForm.project_type,
        status: editForm.status,
        notes: editForm.notes || null,
        start_date: editForm.start_date || null,
        due_date: editForm.due_date || null,
        completed_date: editForm.completed_date || null,
        recipient: editForm.recipient || null,
        estimated_value: editForm.estimated_value ? parseFloat(editForm.estimated_value) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .eq("user_id", userId)
      .select("*, project_threads(*)")
      .single();
    if (!error && data) {
      setProjects(c => c.map(p => p.id === projectId ? data : p));
      setEditingId(null);
      setMessage("Project updated!");
    }
  }

  async function deleteProject(projectId) {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    await supabase.from("project_threads").delete().eq("project_id", projectId);
    await supabase.from("project_checklist").delete().eq("project_id", projectId);
    await supabase.from("project_costs").delete().eq("project_id", projectId);
    await supabase.from("project_fabrics").delete().eq("project_id", projectId);
    await supabase.from("projects").delete().eq("id", projectId).eq("user_id", userId);
    setProjects(c => c.filter(p => p.id !== projectId));
    if (selectedProjectId === projectId) setSelectedProjectId(projects.find(p => p.id !== projectId)?.id || null);
    setMessage("Project deleted.");
  }

  async function removeProjectThread(projectId, threadRowId) {
    await supabase.from("project_threads").delete().eq("id", threadRowId);
    setProjects(c => c.map(p => p.id === projectId
      ? { ...p, project_threads: p.project_threads.filter(t => t.id !== threadRowId) }
      : p
    ));
  }

  async function addThreadToProject(projectId, thread) {
    const existing = projects.find(p => p.id === projectId)?.project_threads || [];
    const threadId = thread.id;
    if (existing.some(t => t.thread_id === threadId)) {
      setMessage("Thread already in project."); return;
    }
    const { data, error } = await supabase
      .from("project_threads")
      .insert({ project_id: projectId, thread_id: threadId, role: "Required", notes: "" })
      .select().single();
    if (!error && data) {
      setProjects(c => c.map(p => p.id === projectId
        ? { ...p, project_threads: [...p.project_threads, { ...data, thread_library: thread }] }
        : p
      ));
      setMessage(`${thread.color_name} added to project!`);
      setThreadInput(""); setThreadResults([]);
    }
  }

  function searchThreads(q) {
    setThreadInput(q);
    if (!q.trim() || q.length < 2) { setThreadResults([]); return; }
    const norm = q.toLowerCase();
    const results = (supaAllThreads || [])
      .filter(t =>
        t.color_name?.toLowerCase().includes(norm) ||
        t.color_code?.toLowerCase().includes(norm) ||
        t.brand?.toLowerCase().includes(norm)
      )
      .slice(0, 8);
    setThreadResults(results);
  }

  function toggleSection(projectId, section) {
    setActiveSection(prev => ({
      ...prev,
      [projectId]: prev[projectId] === section ? null : section
    }));
  }

  if (!user || isGuest) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "32px 20px" }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>◉</div>
        <div style={{ fontFamily: "Playfair Display,serif", fontSize: 16, fontWeight: 700, color: "var(--teal)", marginBottom: 8 }}>
          Projects Require an Account
        </div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
          Sign in to create projects, track costs, and build thread lists.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="card" style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0 }}>Projects</h2>
            {projects.length > 0 && (
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {projects.length} project{projects.length !== 1 ? "s" : ""} ·{" "}
                {projects.filter(p => p.status === "In Progress").length} in progress ·{" "}
                {projects.filter(p => p.status === "Complete").length} complete
              </div>
            )}
          </div>
          <button className="btn active" onClick={() => setShowNewForm(v => !v)}>
            {showNewForm ? "✕ Cancel" : "+ New Project"}
          </button>
        </div>

        {/* New project form */}
        {showNewForm && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1.5px solid var(--border-teal)" }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13, fontWeight: 700, color: "var(--teal)", marginBottom: 12 }}>
              New Project
            </div>
            <label style={{ fontSize: 12 }}>Project Name *
              <input className="input" value={newForm.name}
                onChange={e => setNewForm({ ...newForm, name: e.target.value })}
                placeholder="e.g. Autumn Leaves Quilt" />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ fontSize: 12 }}>Type
                <select className="input" value={newForm.project_type}
                  onChange={e => setNewForm({ ...newForm, project_type: e.target.value })}>
                  {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12 }}>Status
                <select className="input" value={newForm.status}
                  onChange={e => setNewForm({ ...newForm, status: e.target.value })}>
                  {ALL_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ fontSize: 12 }}>Start Date
                <input className="input" type="date" value={newForm.start_date}
                  onChange={e => setNewForm({ ...newForm, start_date: e.target.value })} />
              </label>
              <label style={{ fontSize: 12 }}>Due Date
                <input className="input" type="date" value={newForm.due_date}
                  onChange={e => setNewForm({ ...newForm, due_date: e.target.value })} />
              </label>
            </div>
            <label style={{ fontSize: 12 }}>Made for (recipient)
              <input className="input" value={newForm.recipient}
                onChange={e => setNewForm({ ...newForm, recipient: e.target.value })}
                placeholder="e.g. Mom's birthday gift, donation quilt…" />
            </label>
            <label style={{ fontSize: 12 }}>Estimated value ($) — for insurance
              <input className="input" type="number" step="0.01" value={newForm.estimated_value}
                onChange={e => setNewForm({ ...newForm, estimated_value: e.target.value })} />
            </label>
            <label style={{ fontSize: 12 }}>Notes
              <textarea className="input" rows={2} value={newForm.notes}
                onChange={e => setNewForm({ ...newForm, notes: e.target.value })}
                placeholder="Pattern, fabric collection, inspiration…"
                style={{ resize: "vertical", fontFamily: "inherit" }} />
            </label>
            <button className="btn active" style={{ width: "100%" }} onClick={createProject}>
              Create Project
            </button>
          </div>
        )}
      </div>

      {/* Toast message */}
      {message && (
        <div style={{ margin: "0 0 8px", padding: "10px 16px", background: "var(--leaf-wash)",
          border: "1px solid var(--leaf-light)", borderRadius: 8, fontSize: 13, color: "var(--leaf)", fontWeight: 600 }}>
          {message}
        </div>
      )}

      {/* Loading */}
      {loading && <div className="card"><p className="muted">Loading projects…</p></div>}

      {/* Empty state */}
      {!loading && projects.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "32px 20px" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>◉</div>
          <div style={{ fontFamily: "Playfair Display,serif", fontSize: 15, fontWeight: 700, color: "var(--teal)", marginBottom: 6 }}>
            No projects yet
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            Create a project to track threads, fabrics, costs, and progress for every quilt, garment, or embroidery project.
          </p>
        </div>
      )}

      {/* Project cards */}
      {projects.map(project => {
        const sc = STATUS_COLORS[project.status] || STATUS_COLORS["Planning"];
        const isSelected = project.id === selectedProjectId;
        const isExpanded = expandedId === project.id;
        const isEditing = editingId === project.id;
        const threads = project.project_threads || [];
        const curSection = activeSection[project.id];

        return (
          <div key={project.id} className="card" style={{
            borderColor: isSelected ? "var(--teal)" : undefined,
            borderWidth: isSelected ? 2 : undefined,
            transition: "border-color 0.2s"
          }}>

            {/* ── Project header ── */}
            {!isEditing && (
              <>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Status + type badges */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                        background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                        {project.status}
                      </span>
                      {project.project_type && (
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6,
                          background: "var(--teal-pale)", color: "var(--teal)", border: "1px solid var(--border-teal)" }}>
                          {project.project_type}
                        </span>
                      )}
                      {isSelected && (
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6,
                          background: "var(--sun-pale)", color: "var(--sun-amber)", border: "1px solid var(--border-sun)" }}>
                          ✓ Active
                        </span>
                      )}
                    </div>

                    <div className="thread-name" style={{ fontSize: 15 }}>{project.name}</div>

                    {/* Meta chips */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
                      {project.start_date && (
                        <span style={{ fontSize: 11, color: "var(--muted-warm)" }}>📅 Started {project.start_date}</span>
                      )}
                      {project.due_date && (
                        <span style={{ fontSize: 11, color: "var(--muted-warm)" }}>🗓 Due {project.due_date}</span>
                      )}
                      {project.recipient && (
                        <span style={{ fontSize: 11, color: "var(--muted-warm)" }}>🎁 For {project.recipient}</span>
                      )}
                      {project.estimated_value && (
                        <span style={{ fontSize: 11, color: "var(--muted-warm)" }}>💎 ${parseFloat(project.estimated_value).toFixed(2)}</span>
                      )}
                    </div>

                    {project.notes && (
                      <div className="muted" style={{ fontSize: 12, fontStyle: "italic", marginTop: 5,
                        borderLeft: "3px solid var(--border-teal)", paddingLeft: 8 }}>
                        {project.notes}
                      </div>
                    )}

                    {/* Thread summary */}
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      {threads.length} thread{threads.length !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
                    <button className={`btn ${isSelected ? "active" : ""}`}
                      style={{ fontSize: 11, padding: "5px 10px" }}
                      onClick={() => setSelectedProjectId(isSelected ? null : project.id)}>
                      {isSelected ? "✓ Active" : "Set Active"}
                    </button>
                    <button className="btn" style={{ fontSize: 11, padding: "5px 10px" }}
                      onClick={() => {
                        setEditingId(project.id);
                        setEditForm({
                          name: project.name, project_type: project.project_type || "Quilt",
                          status: project.status, notes: project.notes || "",
                          start_date: project.start_date || "", due_date: project.due_date || "",
                          completed_date: project.completed_date || "",
                          recipient: project.recipient || "",
                          estimated_value: project.estimated_value || ""
                        });
                      }}>
                      ✎ Edit
                    </button>
                    <button className="btn" style={{ fontSize: 11, padding: "5px 10px" }}
                      onClick={() => setExpandedId(isExpanded ? null : project.id)}>
                      {isExpanded ? "▲ Less" : "▼ More"}
                    </button>
                  </div>
                </div>

                {/* ── Threads list (always visible if any) ── */}
                {threads.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--teal-pale)" }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "var(--teal)", marginBottom: 6 }}>Threads</div>
                    {threads.map(item => (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8,
                        padding: "5px 0", borderBottom: "1px solid var(--teal-pale)" }}>
                        {item.hex_color && (
                          <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                            background: item.hex_color, border: "2px solid rgba(255,255,255,0.6)",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>
                            {item.thread_library?.brand || item.brand || ""}{" "}
                            {item.thread_library?.color_code || item.code || ""} —{" "}
                            {item.thread_library?.color_name || item.name || ""}
                          </div>
                          {item.role && item.role !== "Required" && (
                            <div className="muted" style={{ fontSize: 11 }}>{item.role}</div>
                          )}
                        </div>
                        <button className="btn" style={{ fontSize: 11, padding: "3px 7px", color: "#C0392B", borderColor: "#C0392B", flexShrink: 0 }}
                          onClick={() => removeProjectThread(project.id, item.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Add thread inline ── */}
                {isSelected && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--teal-pale)" }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "var(--teal)", marginBottom: 6 }}>+ Add Thread</div>
                    <div style={{ position: "relative" }}>
                      <input className="input" style={{ marginBottom: 0, fontSize: 12 }}
                        value={threadInput}
                        onChange={e => searchThreads(e.target.value)}
                        placeholder="Search by color name, code, brand…" />
                      {threadResults.length > 0 && (
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
                          background: "white", border: "1.5px solid var(--border-teal)", borderRadius: 8,
                          boxShadow: "0 4px 16px rgba(0,0,0,0.12)", maxHeight: 220, overflowY: "auto" }}>
                          {threadResults.map(t => (
                            <div key={t.id}
                              onClick={() => addThreadToProject(project.id, t)}
                              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                                cursor: "pointer", borderBottom: "1px solid var(--teal-pale)" }}
                              onMouseEnter={e => e.currentTarget.style.background = "var(--teal-pale)"}
                              onMouseLeave={e => e.currentTarget.style.background = "white"}>
                              {t.hex_color && (
                                <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                                  background: t.hex_color, border: "2px solid rgba(255,255,255,0.5)",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                              )}
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600 }}>{t.brand} {t.color_code}</div>
                                <div style={{ fontSize: 11, color: "var(--muted-warm)" }}>{t.color_name}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                      Tip: Use the Match tab to find a thread, then tap "Add to Project".
                    </p>
                  </div>
                )}

                {/* ── Expanded sections ── */}
                {isExpanded && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1.5px solid var(--border-teal)" }}>
                    {/* Section nav */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                      {[["checklist","✓ Checklist"],["fabrics","🧵 Fabrics"],["costs","💰 Costs"]].map(([key, label]) => (
                        <button key={key}
                          className={`btn ${curSection === key ? "active" : ""}`}
                          style={{ fontSize: 11, padding: "5px 12px" }}
                          onClick={() => toggleSection(project.id, key)}>
                          {label}
                        </button>
                      ))}
                      <button className="btn" style={{ fontSize: 11, padding: "5px 12px", color: "#C0392B", borderColor: "#C0392B" }}
                        onClick={() => deleteProject(project.id)}>
                        🗑 Delete
                      </button>
                    </div>

                    {curSection === "checklist" && (
                      <ProjectChecklist projectId={project.id} supabase={supabase} userId={userId} />
                    )}
                    {curSection === "fabrics" && (
                      <ProjectFabrics projectId={project.id} supabase={supabase} userId={userId} />
                    )}
                    {curSection === "costs" && (
                      <ProjectCosts projectId={project.id} supabase={supabase} userId={userId} />
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── Edit mode ── */}
            {isEditing && (
              <div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13, fontWeight: 700,
                  color: "var(--teal)", marginBottom: 12 }}>
                  Edit — {project.name}
                </div>
                <label style={{ fontSize: 12 }}>Project Name
                  <input className="input" value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ fontSize: 12 }}>Type
                    <select className="input" value={editForm.project_type}
                      onChange={e => setEditForm({ ...editForm, project_type: e.target.value })}>
                      {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: 12 }}>Status
                    <select className="input" value={editForm.status}
                      onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                      {ALL_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <label style={{ fontSize: 12 }}>Start Date
                    <input className="input" type="date" value={editForm.start_date}
                      onChange={e => setEditForm({ ...editForm, start_date: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 12 }}>Due Date
                    <input className="input" type="date" value={editForm.due_date}
                      onChange={e => setEditForm({ ...editForm, due_date: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 12 }}>Completed
                    <input className="input" type="date" value={editForm.completed_date}
                      onChange={e => setEditForm({ ...editForm, completed_date: e.target.value })} />
                  </label>
                </div>
                <label style={{ fontSize: 12 }}>Made for
                  <input className="input" value={editForm.recipient}
                    onChange={e => setEditForm({ ...editForm, recipient: e.target.value })}
                    placeholder="Recipient name or occasion…" />
                </label>
                <label style={{ fontSize: 12 }}>Estimated value ($)
                  <input className="input" type="number" step="0.01" value={editForm.estimated_value}
                    onChange={e => setEditForm({ ...editForm, estimated_value: e.target.value })} />
                </label>
                <label style={{ fontSize: 12 }}>Notes
                  <textarea className="input" rows={3} value={editForm.notes}
                    onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                    style={{ resize: "vertical", fontFamily: "inherit" }} />
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn active" style={{ flex: 1 }} onClick={() => saveEdit(project.id)}>
                    ✓ Save Changes
                  </button>
                  <button className="btn" style={{ flex: 1 }} onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
