// ═══════════════════════════════════════════════════════════════════════════
// HABERDASH HAVEN — Universal Stash + Barcode Scanner Components
// Drop these into your App.jsx
// ═══════════════════════════════════════════════════════════════════════════

// ── UNIVERSAL STASH TAB ────────────────────────────────────────────────────
// Replace your existing stash tab content with this component.
// Props: userId (string), supabase (client)

function UniversalStash({ userId, supabase }) {
  const [activeSection, setActiveSection] = React.useState('threads')
  const [stash, setStash] = React.useState({
    threads: [], rulers: [], machines: [], dies: [], feet: []
  })
  const [loading, setLoading] = React.useState(true)
  const [counts, setCounts] = React.useState({
    threads: 0, rulers: 0, machines: 0, dies: 0, feet: 0
  })

  React.useEffect(() => {
    if (!userId) return
    fetchAll()
  }, [userId])

  async function fetchAll() {
    setLoading(true)
    try {
      const [
        { data: threads },
        { data: rulers },
        { data: machines },
        { data: dies },
        { data: feet }
      ] = await Promise.all([
        supabase.from('user_inventory')
          .select('quantity, thread_library(code, color_name, hex_color, r, g, b)')
          .eq('user_id', userId),
        supabase.from('user_rulers')
          .select('quantity, ruler_library(brand, model, shape, size_inches, material)')
          .eq('user_id', userId),
        supabase.from('user_machines')
          .select('notes, machine_library(brand, model, type, category)')
          .eq('user_id', userId)
          .not('machine_library.type', 'eq', 'Fabric Cutter'),
        supabase.from('user_dies')
          .select('quantity, machine_library(brand, model, type, category)')
          .eq('user_id', userId),
        supabase.from('user_feet')
          .select('quantity, feet_library(brand, foot_name, category, shank_type, description)')
          .eq('user_id', userId)
      ])

      const s = {
        threads: threads || [],
        rulers: rulers || [],
        machines: machines || [],
        dies: dies || [],
        feet: feet || []
      }
      setStash(s)
      setCounts({
        threads: s.threads.length,
        rulers: s.rulers.length,
        machines: s.machines.length,
        dies: s.dies.length,
        feet: s.feet.length
      })
    } catch (e) {
      console.error('Stash fetch error:', e)
    }
    setLoading(false)
  }

  const sections = [
    { key: 'threads', label: 'Threads', emoji: '🧵' },
    { key: 'rulers', label: 'Rulers', emoji: '📐' },
    { key: 'machines', label: 'Machines', emoji: '⚙️' },
    { key: 'dies', label: 'AccuQuilt', emoji: '◈' },
    { key: 'feet', label: 'Feet', emoji: '👟' },
  ]

  const totalItems = Object.values(counts).reduce((a, b) => a + b, 0)

  if (loading) return (
    <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: '12px' }}>
      Loading your stash...
    </div>
  )

  return (
    <div>
      {/* Total count banner */}
      <div style={{
        background: '#FFF8E1', border: '1.5px solid #F5C400',
        borderRadius: '10px', padding: '8px 12px', marginBottom: '8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '13px',
          fontWeight: 700, color: '#1A5C1A' }}>
          Your Stash
        </span>
        <span style={{ fontSize: '9px', fontWeight: 700, color: '#5C4A1E',
          background: '#F5C400', padding: '2px 8px', borderRadius: '10px' }}>
          {totalItems} items total
        </span>
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {sections.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            style={{
              padding: '4px 8px', borderRadius: '12px', border: '1.5px solid',
              fontSize: '8.5px', fontWeight: 700, cursor: 'pointer',
              background: activeSection === s.key ? '#1A5C1A' : '#FFF',
              borderColor: activeSection === s.key ? '#1A5C1A' : '#EEE',
              color: activeSection === s.key ? '#FFF' : '#888',
              fontFamily: 'Lato, sans-serif'
            }}>
            {s.emoji} {s.label} ({counts[s.key]})
          </button>
        ))}
      </div>

      {/* Threads section */}
      {activeSection === 'threads' && (
        <div style={{ background: '#FFF', borderRadius: '10px', border: '1.5px solid #EEE', padding: '8px 10px' }}>
          {stash.threads.length === 0
            ? <EmptySection label="threads" hint="Use the Match tab to find and add threads" />
            : stash.threads.map((item, i) => {
                const t = item.thread_library
                if (!t) return null
                const hex = t.hex_color || (t.r != null
                  ? `#${t.r.toString(16).padStart(2,'0')}${t.g.toString(16).padStart(2,'0')}${t.b.toString(16).padStart(2,'0')}`
                  : '#CCC')
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '5px 0', borderBottom: i < stash.threads.length - 1 ? '1px solid #EEE' : 'none'
                  }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%',
                      background: hex, border: '1.5px solid rgba(0,0,0,.07)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#2C2C2C',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.code} — {t.color_name}
                      </div>
                      <div style={{ fontSize: '8.5px', color: '#888' }}>
                        {item.quantity} {item.quantity === 1 ? 'spool' : 'spools'}
                      </div>
                    </div>
                  </div>
                )
              })
          }
        </div>
      )}

      {/* Rulers section */}
      {activeSection === 'rulers' && (
        <div style={{ background: '#FFF', borderRadius: '10px', border: '1.5px solid #EEE', padding: '8px 10px' }}>
          {stash.rulers.length === 0
            ? <EmptySection label="rulers" hint="Browse the Rulers tab to add rulers" />
            : stash.rulers.map((item, i) => {
                const r = item.ruler_library
                if (!r) return null
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '5px 0', borderBottom: i < stash.rulers.length - 1 ? '1px solid #EEE' : 'none'
                  }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px',
                      background: '#E8F0FF', border: '1.5px solid #0047AB',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', flexShrink: 0 }}>📐</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#2C2C2C' }}>
                        {r.brand} — {r.model}
                      </div>
                      <div style={{ fontSize: '8.5px', color: '#888' }}>
                        {r.shape} · {r.size_inches} · {r.material}
                      </div>
                    </div>
                  </div>
                )
              })
          }
        </div>
      )}

      {/* Machines section */}
      {activeSection === 'machines' && (
        <div style={{ background: '#FFF', borderRadius: '10px', border: '1.5px solid #EEE', padding: '8px 10px' }}>
          {stash.machines.length === 0
            ? <EmptySection label="machines" hint="Browse the Machines tab to add your machines" />
            : stash.machines.map((item, i) => {
                const m = item.machine_library
                if (!m) return null
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '5px 0', borderBottom: i < stash.machines.length - 1 ? '1px solid #EEE' : 'none'
                  }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px',
                      background: '#FFF8E1', border: '1.5px solid #F5C400',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', flexShrink: 0 }}>⚙️</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#2C2C2C' }}>
                        {m.brand} {m.model}
                      </div>
                      <div style={{ fontSize: '8.5px', color: '#888' }}>
                        {m.type} · {m.category}
                      </div>
                    </div>
                  </div>
                )
              })
          }
        </div>
      )}

      {/* AccuQuilt Dies section */}
      {activeSection === 'dies' && (
        <div style={{ background: '#FFF', borderRadius: '10px', border: '1.5px solid #EEE', padding: '8px 10px' }}>
          {stash.dies.length === 0
            ? <EmptySection label="AccuQuilt dies" hint="Browse the AccuQuilt tab to add your dies" />
            : stash.dies.map((item, i) => {
                const d = item.machine_library
                if (!d) return null
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '5px 0', borderBottom: i < stash.dies.length - 1 ? '1px solid #EEE' : 'none'
                  }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px',
                      background: '#FDECEA', border: '1.5px solid #C0392B',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', flexShrink: 0 }}>◈</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#2C2C2C' }}>
                        {d.model}
                      </div>
                      <div style={{ fontSize: '8.5px', color: '#888' }}>
                        AccuQuilt · {d.category} · {item.quantity || 1} owned
                      </div>
                    </div>
                  </div>
                )
              })
          }
        </div>
      )}

      {/* Feet section */}
      {activeSection === 'feet' && (
        <div style={{ background: '#FFF', borderRadius: '10px', border: '1.5px solid #EEE', padding: '8px 10px' }}>
          {stash.feet.length === 0
            ? <EmptySection label="presser feet" hint="Browse the Feet tab to add your feet collection" />
            : stash.feet.map((item, i) => {
                const f = item.feet_library
                if (!f) return null
                const catColor = {
                  'Quilting': '#E8F0FF', 'Garment': '#E0F5EC',
                  'Embroidery': '#F3EAF8', 'Serging': '#FFF8E1',
                  'Specialty': '#FDECEA', 'General': '#F5F5F5'
                }
                const catText = {
                  'Quilting': '#0047AB', 'Garment': '#1A6B4A',
                  'Embroidery': '#6B3FA0', 'Serging': '#5C4A1E',
                  'Specialty': '#C0392B', 'General': '#888'
                }
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                    padding: '6px 0', borderBottom: i < stash.feet.length - 1 ? '1px solid #EEE' : 'none'
                  }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px',
                      background: catColor[f.category] || '#F5F5F5',
                      border: `1.5px solid ${catText[f.category] || '#CCC'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', flexShrink: 0 }}>👟</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#2C2C2C' }}>
                        {f.foot_name}
                      </div>
                      <div style={{ fontSize: '8.5px', color: '#888', marginTop: '1px' }}>
                        {f.brand} · {f.shank_type}
                      </div>
                      <span style={{
                        fontSize: '7px', fontWeight: 700, padding: '1px 5px',
                        borderRadius: '6px', marginTop: '2px', display: 'inline-block',
                        background: catColor[f.category] || '#F5F5F5',
                        color: catText[f.category] || '#888'
                      }}>{f.category}</span>
                    </div>
                  </div>
                )
              })
          }
        </div>
      )}
    </div>
  )
}

function EmptySection({ label, hint }) {
  return (
    <div style={{ padding: '16px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: '22px', marginBottom: '6px', opacity: 0.3 }}>◈</div>
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '3px' }}>
        No {label} in your stash yet
      </div>
      <div style={{ fontSize: '9px', color: '#BBB' }}>{hint}</div>
    </div>
  )
}


// ── BARCODE SCANNER COMPONENT ──────────────────────────────────────────────
// Wire this to the Camera Match button area.
// Props: userId, supabase, onAddToStash (callback), onColorMatch (callback for unknown barcodes)

function BarcodeScanner({ userId, supabase, onAddToStash, onColorMatch }) {
  const [scanning, setScanning] = React.useState(false)
  const [result, setResult] = React.useState(null)
  const [error, setError] = React.useState(null)
  const [confirming, setConfirming] = React.useState(false)
  const videoRef = React.useRef(null)
  const streamRef = React.useRef(null)
  const detectorRef = React.useRef(null)
  const rafRef = React.useRef(null)

  async function startScan() {
    setError(null)
    setResult(null)

    // Check BarcodeDetector support
    if (!('BarcodeDetector' in window)) {
      setError('Barcode scanning is not supported on this browser. Try Chrome on Android.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      detectorRef.current = new BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code']
      })

      setScanning(true)
      scanLoop()
    } catch (e) {
      setError('Could not access camera. Check permissions.')
    }
  }

  function scanLoop() {
    if (!videoRef.current || !detectorRef.current) return
    rafRef.current = requestAnimationFrame(async () => {
      try {
        const barcodes = await detectorRef.current.detect(videoRef.current)
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue
          stopScan()
          await handleBarcode(code)
        } else {
          scanLoop()
        }
      } catch {
        scanLoop()
      }
    })
  }

  function stopScan() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setScanning(false)
  }

  async function handleBarcode(barcode) {
    try {
      // Look up barcode in database
      const { data, error: lookupError } = await supabase
        .from('thread_barcodes')
        .select(`
          *,
          thread_library_all (
            brand, brand_key, color_code, color_name, hex_color,
            fiber_type, weight, thread_type, nearest_isacord
          )
        `)
        .eq('barcode', barcode)
        .maybeSingle()

      if (data && data.thread_library_all) {
        // Found in database!
        setResult({ barcode, thread: data.thread_library_all, confirmed: data.confirmed_count, found: true })
        // Increment confirmation count (another user scanned and confirmed)
        await supabase.rpc('increment_barcode_confirmation', { p_barcode: barcode })
      } else {
        // Not in database — go to color match
        setResult({ barcode, found: false })
      }
    } catch (e) {
      setResult({ barcode, found: false })
    }
  }

  async function addToStash() {
    if (!result?.thread || !userId) return
    setConfirming(true)
    try {
      // Add to user_inventory if it's an Isacord thread
      const thread = result.thread
      // Find the thread in thread_library by color code
      const { data: libraryThread } = await supabase
        .from('thread_library')
        .select('id')
        .eq('code', thread.color_code)
        .maybeSingle()

      if (libraryThread) {
        await supabase.from('user_inventory').upsert({
          user_id: userId,
          thread_id: libraryThread.id,
          quantity: 1
        }, { onConflict: 'user_id,thread_id' })
      }

      onAddToStash && onAddToStash(thread)
      setResult(null)
    } catch (e) {
      console.error('Add to stash error:', e)
    }
    setConfirming(false)
  }

  async function saveUnknownBarcode(brandKey, colorCode) {
    // Called from color match screen after user identifies an unknown barcode
    if (!result?.barcode) return
    try {
      await supabase.from('thread_barcodes').upsert({
        barcode: result.barcode,
        brand_key: brandKey,
        color_code: colorCode,
        first_scanned_by: userId,
        confirmed_count: 1
      }, { onConflict: 'barcode' })
    } catch (e) {
      console.error('Save barcode error:', e)
    }
  }

  // Cleanup on unmount
  React.useEffect(() => {
    return () => stopScan()
  }, [])

  return (
    <div>
      {/* Scan button */}
      {!scanning && !result && (
        <button
          onClick={startScan}
          style={{
            width: '100%', padding: '10px', background: '#F5C400',
            border: 'none', borderRadius: '9px', fontSize: '11px',
            fontWeight: 700, color: '#5C4A1E', cursor: 'pointer',
            fontFamily: 'Lato, sans-serif', marginBottom: '8px'
          }}>
          📷 Scan Thread Barcode
        </button>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: '#FDECEA', border: '1.5px solid #C0392B',
          borderRadius: '8px', padding: '8px 10px', fontSize: '10px',
          color: '#C0392B', marginBottom: '8px'
        }}>{error}</div>
      )}

      {/* Camera viewfinder */}
      {scanning && (
        <div style={{ position: 'relative', marginBottom: '8px' }}>
          <video
            ref={videoRef}
            style={{ width: '100%', borderRadius: '10px', display: 'block' }}
            playsInline muted autoPlay
          />
          {/* Scan overlay */}
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{
              width: '70%', height: '30%',
              border: '2px solid #F5C400',
              borderRadius: '8px', boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)'
            }} />
          </div>
          <button
            onClick={stopScan}
            style={{
              position: 'absolute', top: '8px', right: '8px',
              background: 'rgba(0,0,0,0.6)', color: '#FFF',
              border: 'none', borderRadius: '6px',
              padding: '4px 8px', fontSize: '10px', cursor: 'pointer'
            }}>✕ Cancel</button>
          <div style={{
            position: 'absolute', bottom: '10px', left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.6)', color: '#FFF',
            borderRadius: '10px', padding: '4px 10px', fontSize: '9px',
            whiteSpace: 'nowrap'
          }}>Point camera at thread barcode</div>
        </div>
      )}

      {/* Found result */}
      {result?.found && result.thread && (
        <div style={{
          background: '#E8F5E8', border: '1.5px solid #1A5C1A',
          borderRadius: '10px', padding: '10px', marginBottom: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            {result.thread.hex_color && (
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: result.thread.hex_color,
                border: '2px solid rgba(0,0,0,.1)', flexShrink: 0
              }} />
            )}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#1A5C1A' }}>
                ✓ Thread found!
              </div>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#2C2C2C' }}>
                {result.thread.brand} {result.thread.color_code} — {result.thread.color_name}
              </div>
              <div style={{ fontSize: '8.5px', color: '#888' }}>
                {result.thread.fiber_type} · {result.thread.weight} · {result.confirmed} user{result.confirmed !== 1 ? 's' : ''} confirmed
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={addToStash}
              disabled={confirming}
              style={{
                flex: 1, padding: '7px', background: '#1A5C1A', color: '#FFF',
                border: 'none', borderRadius: '7px', fontSize: '10px',
                fontWeight: 700, cursor: 'pointer', fontFamily: 'Lato, sans-serif'
              }}>
              {confirming ? 'Adding...' : '+ Add to Stash'}
            </button>
            <button
              onClick={() => setResult(null)}
              style={{
                padding: '7px 10px', background: '#FFF', color: '#888',
                border: '1.5px solid #EEE', borderRadius: '7px', fontSize: '10px',
                cursor: 'pointer', fontFamily: 'Lato, sans-serif'
              }}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Not found — route to color match */}
      {result && !result.found && (
        <div style={{
          background: '#FFF8E1', border: '1.5px solid #F5C400',
          borderRadius: '10px', padding: '10px', marginBottom: '8px'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#5C4A1E', marginBottom: '4px' }}>
            Barcode not recognized yet
          </div>
          <div style={{ fontSize: '9px', color: '#888', marginBottom: '8px' }}>
            Barcode: {result.barcode}
          </div>
          <div style={{ fontSize: '9.5px', color: '#5C4A1E', marginBottom: '8px' }}>
            Use Camera Color Match to identify this thread. Once matched, we'll save the barcode for all users!
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => onColorMatch && onColorMatch(result.barcode)}
              style={{
                flex: 1, padding: '7px', background: '#F5C400', color: '#5C4A1E',
                border: 'none', borderRadius: '7px', fontSize: '10px',
                fontWeight: 700, cursor: 'pointer', fontFamily: 'Lato, sans-serif'
              }}>
              📷 Color Match This Thread
            </button>
            <button
              onClick={() => setResult(null)}
              style={{
                padding: '7px 10px', background: '#FFF', color: '#888',
                border: '1.5px solid #EEE', borderRadius: '7px', fontSize: '10px',
                cursor: 'pointer', fontFamily: 'Lato, sans-serif'
              }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── FEET BROWSER TAB ────────────────────────────────────────────────────────
// New tab for browsing and adding presser feet to stash

function FeetBrowser({ userId, supabase }) {
  const [feet, setFeet] = React.useState([])
  const [filter, setFilter] = React.useState('All')
  const [loading, setLoading] = React.useState(true)
  const [added, setAdded] = React.useState({})

  const categories = ['All', 'Quilting', 'Garment', 'Embroidery', 'Specialty', 'Serging', 'General']

  React.useEffect(() => {
    fetchFeet()
    fetchUserFeet()
  }, [])

  async function fetchFeet() {
    setLoading(true)
    const { data } = await supabase
      .from('feet_library')
      .select('*')
      .order('category')
      .order('foot_name')
    setFeet(data || [])
    setLoading(false)
  }

  async function fetchUserFeet() {
    if (!userId) return
    const { data } = await supabase
      .from('user_feet')
      .select('foot_id')
      .eq('user_id', userId)
    if (data) {
      const owned = {}
      data.forEach(r => { owned[r.foot_id] = true })
      setAdded(owned)
    }
  }

  async function toggleFoot(footId) {
    if (!userId) return
    if (added[footId]) {
      await supabase.from('user_feet')
        .delete()
        .eq('user_id', userId)
        .eq('foot_id', footId)
      setAdded(prev => { const n = {...prev}; delete n[footId]; return n })
    } else {
      await supabase.from('user_feet')
        .upsert({ user_id: userId, foot_id: footId, quantity: 1 },
                 { onConflict: 'user_id,foot_id' })
      setAdded(prev => ({ ...prev, [footId]: true }))
    }
  }

  const filtered = filter === 'All' ? feet : feet.filter(f => f.category === filter)

  const catColor = {
    'Quilting': { bg: '#E8F0FF', text: '#0047AB' },
    'Garment': { bg: '#E0F5EC', text: '#1A6B4A' },
    'Embroidery': { bg: '#F3EAF8', text: '#6B3FA0' },
    'Serging': { bg: '#FFF8E1', text: '#5C4A1E' },
    'Specialty': { bg: '#FDECEA', text: '#C0392B' },
    'General': { bg: '#F5F5F5', text: '#888' },
  }

  if (loading) return (
    <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: '12px' }}>
      Loading feet library...
    </div>
  )

  return (
    <div>
      {/* Category filter */}
      <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            style={{
              padding: '3px 7px', borderRadius: '10px', fontSize: '8px',
              fontWeight: 700, cursor: 'pointer', border: '1.5px solid',
              background: filter === cat ? (catColor[cat]?.text || '#1A5C1A') : '#FFF',
              borderColor: filter === cat ? (catColor[cat]?.text || '#1A5C1A') : '#EEE',
              color: filter === cat ? '#FFF' : '#888',
              fontFamily: 'Lato, sans-serif'
            }}>{cat}</button>
        ))}
      </div>

      <div style={{ fontSize: '9px', color: '#888', marginBottom: '6px' }}>
        {filtered.length} feet — tap to add to your stash
      </div>

      {/* Feet list */}
      {filtered.map((foot) => {
        const c = catColor[foot.category] || catColor['General']
        const isOwned = added[foot.id]
        return (
          <div
            key={foot.id}
            style={{
              background: '#FFF', borderRadius: '9px',
              border: `1.5px solid ${isOwned ? '#1A5C1A' : '#EEE'}`,
              padding: '8px 10px', marginBottom: '5px',
              display: 'flex', alignItems: 'flex-start', gap: '8px'
            }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                <span style={{
                  fontSize: '7px', fontWeight: 700, padding: '1px 5px',
                  borderRadius: '6px', background: c.bg, color: c.text, flexShrink: 0
                }}>{foot.category}</span>
                {foot.foot_number && (
                  <span style={{ fontSize: '8px', color: '#888' }}>#{foot.foot_number}</span>
                )}
              </div>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#2C2C2C', marginBottom: '2px' }}>
                {foot.foot_name}
              </div>
              <div style={{ fontSize: '8.5px', color: '#888', marginBottom: '2px' }}>
                {foot.brand} · {foot.shank_type}
              </div>
              {foot.description && (
                <div style={{ fontSize: '8.5px', color: '#5C4A1E', lineHeight: 1.4 }}>
                  {foot.description}
                </div>
              )}
              {foot.best_for && foot.best_for.length > 0 && (
                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {foot.best_for.slice(0, 3).map((use, i) => (
                    <span key={i} style={{
                      fontSize: '7px', padding: '1px 4px',
                      background: '#F5F5F5', color: '#888',
                      borderRadius: '4px'
                    }}>{use}</span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => toggleFoot(foot.id)}
              style={{
                padding: '5px 8px', borderRadius: '7px', border: '1.5px solid',
                fontSize: '9px', fontWeight: 700, cursor: 'pointer',
                flexShrink: 0,
                background: isOwned ? '#1A5C1A' : '#FFF',
                borderColor: isOwned ? '#1A5C1A' : '#EEE',
                color: isOwned ? '#FFF' : '#888',
                fontFamily: 'Lato, sans-serif'
              }}>
              {isOwned ? '✓ Owned' : '+ Add'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

export { UniversalStash, BarcodeScanner, FeetBrowser }
