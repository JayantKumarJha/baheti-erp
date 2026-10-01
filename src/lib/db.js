// Data layer.
// • If VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set → all data lives in your Supabase Postgres database.
// • Otherwise → "Local demo mode": data is kept in this browser's localStorage (for trying the app before setup).
import { createClient } from '@supabase/supabase-js';
import { TABLES, DEFAULT_SETTINGS } from './constants.js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY_ = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const MODE = URL_ && KEY_ ? 'supabase' : 'local';
const supabase = MODE === 'supabase' ? createClient(URL_, KEY_) : null;

// ---------------------------------------------------------------- local mode
const LS_KEY = 'baheti-erp-local-v1';
function lsRead() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const blank = { seq: {}, settings: {} };
  TABLES.forEach((t) => (blank[t] = []));
  return blank;
}
function lsWrite(store) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(store)); }
  catch (e) { throw new Error('Could not save to browser storage: ' + e.message); }
}
function nextSeq(store, name) {
  store.seq[name] = (store.seq[name] || 0) + 1;
  return store.seq[name];
}
const pad = (n) => String(n).padStart(4, '0');
function localDocNo(store, table, row) {
  if (table === 'purchase_orders' && !row.po_no) row.po_no = 'PO-' + pad(nextSeq(store, 'po'));
  if (table === 'gate_entries' && !row.gate_no) row.gate_no = 'GN-' + pad(nextSeq(store, 'gate'));
  if (table === 'grns' && !row.grn_no) row.grn_no = 'GRN-' + pad(nextSeq(store, 'grn'));
  if (table === 'production_batches' && !row.batch_no) row.batch_no = nextSeq(store, 'batch');
  if (table === 'sales' && !row.invoice_no) row.invoice_no = 'INV-' + pad(nextSeq(store, 'inv'));
}

// ---------------------------------------------------------------- helpers
function fail(error, what) {
  if (error) throw new Error(`${what}: ${error.message || error}`);
}

async function fetchAllRows(table) {
  // PostgREST returns max 1000 rows per request — page through.
  const size = 1000;
  let from = 0, out = [];
  for (;;) {
    const { data, error } = await supabase.from(table).select('*').order('id', { ascending: true }).range(from, from + size - 1);
    fail(error, `Loading ${table}`);
    out = out.concat(data);
    if (data.length < size) break;
    from += size;
  }
  return out;
}

// ---------------------------------------------------------------- public API
export async function loadAll() {
  if (MODE === 'local') {
    const s = lsRead();
    const data = {};
    TABLES.forEach((t) => (data[t] = s[t] || []));
    data.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
    return data;
  }
  const results = await Promise.all(TABLES.map(fetchAllRows));
  const data = {};
  TABLES.forEach((t, i) => (data[t] = results[i]));
  const { data: st, error } = await supabase.from('settings').select('*');
  fail(error, 'Loading settings');
  const settings = { ...DEFAULT_SETTINGS };
  (st || []).forEach((r) => (settings[r.key] = r.value));
  data.settings = settings;
  return data;
}

export async function insert(table, row) {
  if (MODE === 'local') {
    const s = lsRead();
    const r = { ...row, id: nextSeq(s, 'id:' + table), created_at: new Date().toISOString() };
    localDocNo(s, table, r);
    s[table] = s[table] || [];
    s[table].push(r);
    lsWrite(s);
    return r;
  }
  const { data, error } = await supabase.from(table).insert(row).select().single();
  fail(error, `Saving to ${table}`);
  return data;
}

export async function update(table, id, patch) {
  if (MODE === 'local') {
    const s = lsRead();
    const r = (s[table] || []).find((x) => x.id === id);
    if (!r) throw new Error(`Record ${id} not found in ${table}`);
    Object.assign(r, patch);
    lsWrite(s);
    return r;
  }
  const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single();
  fail(error, `Updating ${table}`);
  return data;
}

export async function remove(table, id) {
  if (MODE === 'local') {
    const s = lsRead();
    s[table] = (s[table] || []).filter((x) => x.id !== id);
    if (table === 'purchase_orders') s.containers = s.containers.filter((c) => c.po_id !== id);
    lsWrite(s);
    return;
  }
  const { error } = await supabase.from(table).delete().eq('id', id);
  fail(error, `Deleting from ${table}`);
}

export async function saveSetting(key, value) {
  if (MODE === 'local') {
    const s = lsRead();
    s.settings = s.settings || {};
    s.settings[key] = value;
    lsWrite(s);
    return;
  }
  const { error } = await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() });
  fail(error, 'Saving settings');
}

// Full backup (works in both modes)
export async function exportBackup() {
  const data = await loadAll();
  return { app: 'baheti-erp', version: 1, exported_at: new Date().toISOString(), mode: MODE, data };
}

// Restore (local mode only — in Supabase, restore through the Supabase dashboard / point-in-time backups)
export function importBackupLocal(backup) {
  if (MODE !== 'local') throw new Error('Import is only available in local demo mode.');
  if (!backup || backup.app !== 'baheti-erp' || !backup.data) throw new Error('This is not a Baheti ERP backup file.');
  const s = { seq: {}, settings: backup.data.settings || {} };
  TABLES.forEach((t) => {
    s[t] = backup.data[t] || [];
    s.seq['id:' + t] = s[t].reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
  });
  const maxNo = (rows, f) => rows.reduce((m, r) => Math.max(m, parseInt(String(r[f] || '').replace(/\D/g, ''), 10) || 0), 0);
  s.seq.po = maxNo(s.purchase_orders, 'po_no');
  s.seq.gate = maxNo(s.gate_entries, 'gate_no');
  s.seq.grn = maxNo(s.grns, 'grn_no');
  s.seq.batch = maxNo(s.production_batches, 'batch_no');
  s.seq.inv = maxNo(s.sales, 'invoice_no');
  lsWrite(s);
}

export function clearLocal() {
  if (MODE !== 'local') return;
  localStorage.removeItem(LS_KEY);
}

export async function pingSupabase() {
  if (MODE !== 'supabase') return { ok: true };
  const { error } = await supabase.from('settings').select('key').limit(1);
  return error ? { ok: false, message: error.message } : { ok: true };
}
