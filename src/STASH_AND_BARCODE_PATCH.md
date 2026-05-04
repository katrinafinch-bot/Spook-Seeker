# Haberdash Haven — Stash + Barcode Patch Guide

## What to add to App.jsx

### 1. UNIVERSAL STASH TAB

Replace your existing Stash tab content with the UniversalStash component below.
The stash now shows 6 sections: Threads, Rulers, Machines, AccuQuilt Dies, Feet, and a total count.

### 2. BARCODE SCAN FLOW

Add the BarcodeScanner component. Wire it to the Camera Match button.
Scan flow:
  a. User taps Scan Barcode
  b. BarcodeDetector API reads the barcode
  c. App queries thread_barcodes table
  d. If found → confirms match, asks "Add to stash?"
  e. If not found → opens camera color match → user picks thread → saves barcode

### 3. NEW SUPABASE QUERIES NEEDED

Add these functions to your supabase calls:

// Fetch all user stash items (universal)
async function fetchUniversalStash(userId) {
  const [threads, rulers, machines, feet] = await Promise.all([
    supabase.from('user_inventory')
      .select('*, thread_library(*)')
      .eq('user_id', userId),
    supabase.from('user_rulers')
      .select('*, ruler_library(*)')
      .eq('user_id', userId),
    supabase.from('user_machines')
      .select('*, machine_library(*)')
      .eq('user_id', userId),
    supabase.from('user_feet')
      .select('*, feet_library(*)')
      .eq('user_id', userId),
  ])
  return { threads, rulers, machines, feet }
}

// Barcode lookup
async function lookupBarcode(barcode) {
  const { data } = await supabase
    .from('thread_barcodes')
    .select('*, thread_library_all(brand, color_code, color_name, hex_color, nearest_isacord)')
    .eq('barcode', barcode)
    .single()
  return data
}

// Save new barcode (crowdsource)
async function saveBarcode(barcode, brandKey, colorCode, userId) {
  const { data } = await supabase
    .from('thread_barcodes')
    .upsert({
      barcode,
      brand_key: brandKey,
      color_code: colorCode,
      first_scanned_by: userId,
      confirmed_count: 1
    }, { onConflict: 'barcode' })
  return data
}

// Increment barcode confirmation count
async function confirmBarcode(barcode) {
  await supabase.rpc('increment_barcode_confirmation', { p_barcode: barcode })
}

// Add item to universal stash
async function addToUserFeet(userId, footId) {
  await supabase.from('user_feet')
    .upsert({ user_id: userId, foot_id: footId, quantity: 1 },
             { onConflict: 'user_id,foot_id' })
}

async function addToUserDies(userId, machineId) {
  await supabase.from('user_dies')
    .upsert({ user_id: userId, machine_id: machineId, quantity: 1 },
             { onConflict: 'user_id,machine_id' })
}

