import { useState } from 'react';
import { Page, Panel, Field, Tag, DataTable, DatalistInput, useApp } from '../components/ui.jsx';
import { insert, remove } from '../lib/db.js';
import { fmtDate, todayStr, byDateDesc, fmtNum, num } from '../lib/format.js';
import { storeBalances, uniq } from '../lib/derived.js';

function StoreForm({ onDone }) {
  const { data, run, toast, confirm } = useApp();
  const bal = storeBalances(data);
  const [f, setF] = useState({ date: todayStr(), type: 'in', item: '', qty: '', unit: 'kg', slip_no: '', party: '', remarks: '' });
  const set = (k) => (e) => {
    const v = e.target.value;
    const next = { ...f, [k]: v };
    if (k === 'item' && bal[v]) next.unit = bal[v].unit; // auto-fill unit for known items
    setF(next);
  };
  const cur = bal[f.item.trim()];

  const save = async () => {
    const item = f.item.trim(), qty = parseFloat(f.qty);
    if (!item || !qty) return toast('Enter item and quantity.', true);
    if (f.type === 'out' && (!cur || cur.qty < qty - 0.001)
      && !(await confirm(`Only ${fmtNum(cur ? cur.qty : 0, 1)} ${cur ? cur.unit : f.unit} of ${item} in store. Issue anyway?`, 'Issue anyway'))) return;
    const ok = await run(() => insert('store_transactions', {
      date: f.date || todayStr(), type: f.type, item, qty, unit: f.unit.trim() || 'kg',
      slip_no: f.slip_no.trim() || null, party: f.party.trim() || null, remarks: f.remarks.trim() || null,
    }), 'Store entry saved');
    if (ok) onDone();
  };

  return (
    <Panel title="Store Entry" className="form" body>
      <div className="form-grid">
        <Field label="Date"><input type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Type"><select value={f.type} onChange={set('type')}><option value="in">Material In</option><option value="out">Material Out</option></select></Field>
        <Field label="Item"><DatalistInput id="store-item-list" options={uniq(data.store_transactions.map((s) => s.item))} value={f.item} onChange={set('item')} placeholder="e.g. Flux, Diesel, Crucible" /></Field>
        <Field label="Quantity"><input type="number" step="0.1" value={f.qty} onChange={set('qty')} placeholder="0.0" /></Field>
        <Field label="Unit"><input type="text" value={f.unit} onChange={set('unit')} /></Field>
        <Field label="Slip No"><input type="text" value={f.slip_no} onChange={set('slip_no')} placeholder="Issue slip / receipt no" /></Field>
        <Field label={f.type === 'in' ? 'Received From' : 'Issued To'}><input type="text" value={f.party} onChange={set('party')} placeholder="Department, person or supplier" /></Field>
      </div>
      <Field label="Purpose / Remarks" style={{ marginBottom: 14 }}><input type="text" value={f.remarks} onChange={set('remarks')} placeholder="Optional" /></Field>
      {cur && <div className="calc">Current balance of {f.item.trim()}: <b>{fmtNum(cur.qty, 1)} {cur.unit}</b></div>}
      <div className="form-actions"><button className="btn" onClick={save}>Save Entry</button><button className="btn secondary" onClick={onDone}>Cancel</button></div>
    </Panel>
  );
}

export default function Store() {
  const { data, run, confirm } = useApp();
  const [show, setShow] = useState(false);
  const d = data;
  const bal = storeBalances(d);
  const stats = [
    { label: 'Items Tracked', val: Object.keys(bal).length },
    { label: 'Total In (entries)', val: d.store_transactions.filter((t) => t.type === 'in').length, cls: 'green' },
    { label: 'Total Out (entries)', val: d.store_transactions.filter((t) => t.type === 'out').length, cls: 'blue' },
    { label: 'Items at / below zero', val: Object.values(bal).filter((b) => b.qty <= 0.001).length, cls: 'bad' },
  ];

  const del = async (t) => {
    if (await confirm(`Delete this ${t.type === 'in' ? 'In' : 'Out'} entry for ${fmtNum(t.qty, 1)} ${t.unit} ${t.item}?`, 'Delete')) run(() => remove('store_transactions', t.id), 'Entry deleted');
  };

  const balRows = Object.values(bal).map((b) => ({ ...b, id: b.item })).sort((a, b) => a.item.localeCompare(b.item));
  const balCols = [
    { label: 'Item', key: 'item' },
    { label: 'In', key: 'inQty', num: true, render: (r) => `${fmtNum(r.inQty, 1)} ${r.unit}` },
    { label: 'Out', key: 'outQty', num: true, render: (r) => `${fmtNum(r.outQty, 1)} ${r.unit}` },
    { label: 'Balance', key: 'qty', num: true, render: (r) => <span style={{ color: r.qty <= 0.001 ? 'var(--bad)' : undefined }}>{fmtNum(r.qty, 1)} {r.unit}</span>, csv: (r) => fmtNum(r.qty, 1) },
  ];
  const logCols = [
    { label: 'Date', key: 'date', render: (r) => fmtDate(r.date) },
    { label: 'Type', key: 'type', render: (r) => <Tag cls={r.type === 'in' ? 'paid' : 'blue'}>{r.type === 'in' ? 'In' : 'Out'}</Tag> },
    { label: 'Item', key: 'item' },
    { label: 'Qty', key: 'qty', num: true, render: (r) => `${fmtNum(r.qty, 1)} ${r.unit}`, csv: (r) => num(r.qty) },
    { label: 'Unit', key: 'unit', render: (r) => r.unit, className: 'dim' },
    { label: 'Slip No', key: 'slip_no', className: 'mono', render: (r) => r.slip_no || '—' },
    { label: 'Issued To / From', key: 'party', render: (r) => r.party || '—' },
    { label: 'Remarks', key: 'remarks', render: (r) => r.remarks || '—' },
    { label: '', actions: true, noCsv: true, render: (r) => <button className="btn link red" onClick={() => del(r)}>Delete</button> },
  ];

  return (
    <Page id="store" stats={stats} actions={<button className="btn" onClick={() => setShow(!show)}>+ New Store Entry</button>}>
      {show && <StoreForm onDone={() => setShow(false)} />}
      <DataTable title="Item Balances" columns={balCols} rows={balRows} empty="No store items yet." csvName="store-balances" />
      <DataTable title="Transaction Log" columns={logCols} rows={[...d.store_transactions].sort(byDateDesc)} empty="No store transactions yet." csvName="store-transactions" dateFilter />
    </Page>
  );
}
