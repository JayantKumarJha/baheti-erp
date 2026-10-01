import { useState } from 'react';
import { Page, Panel, Field, Tag, DataTable, DatalistInput, useApp } from '../components/ui.jsx';
import { insert, update, remove } from '../lib/db.js';
import { fmtKg, fmtRs, fmtRate, fmtDate, todayStr, byDateDesc, num, fmtNum } from '../lib/format.js';
import { poReceivedQty, poPendingQty, poContainers, poIsOpen, vendorNames } from '../lib/derived.js';

export function containerStatusTag(s) {
  if (s === 'received') return <Tag cls="paid">Received</Tag>;
  if (s === 'gate-in') return <Tag cls="partial">In Yard</Tag>;
  return <Tag cls="blue">Pending Arrival</Tag>;
}

function POForm({ onDone }) {
  const { data, run, toast } = useApp();
  const [f, setF] = useState({ date: todayStr(), vendor: '', scrap_type: data.settings.scrap_types[0], qty_kg: '', rate_kg: '', remarks: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const value = num(f.qty_kg) * num(f.rate_kg);
  const save = async () => {
    const qty = parseFloat(f.qty_kg), rate = parseFloat(f.rate_kg);
    if (!f.vendor.trim() || !qty || !(rate >= 0) || f.rate_kg === '') return toast('Please fill vendor, quantity and rate.', true);
    const ok = await run(() => insert('purchase_orders', {
      date: f.date || todayStr(), vendor: f.vendor.trim(), scrap_type: f.scrap_type, qty_kg: qty, rate_kg: rate, remarks: f.remarks.trim() || null,
    }), 'Purchase order saved');
    if (ok) onDone();
  };
  return (
    <Panel title="Book Purchase Order" className="form" body>
      <div className="form-grid">
        <Field label="Date"><input type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Vendor"><DatalistInput id="vendor-list" options={vendorNames(data)} value={f.vendor} onChange={set('vendor')} placeholder="Vendor name" /></Field>
        <Field label="Scrap Type"><select value={f.scrap_type} onChange={set('scrap_type')}>{data.settings.scrap_types.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Quantity Ordered (kg)"><input type="number" step="0.1" value={f.qty_kg} onChange={set('qty_kg')} placeholder="0.0" /></Field>
        <Field label="Rate (₹/kg)"><input type="number" step="0.01" value={f.rate_kg} onChange={set('rate_kg')} placeholder="0.00" /></Field>
        <Field label="Remarks"><input type="text" value={f.remarks} onChange={set('remarks')} placeholder="Optional" /></Field>
      </div>
      <div className="calc">PO value: <b>{fmtRs(value)}</b><span>PO No is generated automatically.</span></div>
      <div className="form-actions"><button className="btn" onClick={save}>Save PO</button><button className="btn secondary" onClick={onDone}>Cancel</button></div>
    </Panel>
  );
}

function ContainerForm({ onDone }) {
  const { data, run, toast } = useApp();
  const openPos = data.purchase_orders.filter((p) => !p.closed).sort(byDateDesc);
  const [poId, setPoId] = useState(openPos[0]?.id ?? '');
  const [nos, setNos] = useState('');
  const [eta, setEta] = useState('');
  const save = async () => {
    const po = data.purchase_orders.find((p) => String(p.id) === String(poId));
    const list = nos.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (!po || !list.length) return toast('Select a PO and enter a container number.', true);
    const existing = new Set(data.containers.map((c) => c.container_no.toUpperCase()));
    const dupes = list.filter((n) => existing.has(n.toUpperCase()));
    if (dupes.length) return toast(`Container already exists: ${dupes.join(', ')}`, true);
    const ok = await run(async () => {
      for (const no of list) await insert('containers', { po_id: po.id, container_no: no.toUpperCase(), expected_arrival: eta || null, status: 'pending' });
    }, `${list.length} container(s) added to ${po.po_no}`);
    if (ok) onDone();
  };
  return (
    <Panel title="Add Container(s) to PO" className="form" body>
      <div className="form-grid">
        <Field label="Purchase Order">
          <select value={poId} onChange={(e) => setPoId(e.target.value)}>
            {openPos.length ? openPos.map((p) => <option key={p.id} value={p.id}>{p.po_no} — {p.vendor} — {p.scrap_type}</option>) : <option value="">No open POs</option>}
          </select>
        </Field>
        <Field label="Container No(s)"><input type="text" value={nos} onChange={(e) => setNos(e.target.value)} placeholder="MSCU1234567, TGHU7654321" /></Field>
        <Field label="Expected Arrival"><input type="date" value={eta} onChange={(e) => setEta(e.target.value)} /></Field>
      </div>
      <div className="hint">Separate several container numbers with commas to add them in one go.</div>
      <div className="form-actions"><button className="btn" onClick={save}>Add Container</button><button className="btn secondary" onClick={onDone}>Cancel</button></div>
    </Panel>
  );
}

export default function PurchaseOrders() {
  const { data, run, confirm } = useApp();
  const [show, setShow] = useState(null); // 'po' | 'container'
  const d = data;

  const ordered = d.purchase_orders.reduce((a, p) => a + num(p.qty_kg), 0);
  const received = d.purchase_orders.reduce((a, p) => a + poReceivedQty(d, p), 0);
  const pending = d.purchase_orders.reduce((a, p) => a + (p.closed ? 0 : poPendingQty(d, p)), 0);
  const stats = [
    { label: 'Open POs', val: d.purchase_orders.filter((p) => poIsOpen(d, p)).length },
    { label: 'Total Ordered', val: fmtKg(ordered), cls: 'blue' },
    { label: 'Total Received', val: fmtKg(received), cls: 'green' },
    { label: 'Total Pending', val: fmtKg(pending), cls: 'bad' },
  ];

  const delPO = async (p) => {
    if (d.gate_entries.some((g) => g.po_id === p.id)) return run(async () => { throw new Error(`${p.po_no} already has gate entries — it cannot be deleted. Close it instead.`); });
    if (await confirm(`Delete ${p.po_no} (${p.vendor}) and its containers?`, 'Delete')) run(() => remove('purchase_orders', p.id), `${p.po_no} deleted`);
  };
  const toggleClose = async (p) => {
    const msg = p.closed ? `Re-open ${p.po_no}?` : `Close ${p.po_no}? Pending quantity of ${fmtKg(poPendingQty(d, p))} will be cancelled.`;
    if (await confirm(msg)) run(() => update('purchase_orders', p.id, { closed: !p.closed }), p.closed ? 'PO re-opened' : 'PO closed');
  };
  const delContainer = async (c) => {
    if (c.status !== 'pending') return;
    if (await confirm(`Remove container ${c.container_no}?`, 'Remove')) run(() => remove('containers', c.id), 'Container removed');
  };

  const poRows = [...d.purchase_orders].sort(byDateDesc).map((p) => {
    const cs = poContainers(d, p);
    return { ...p, recv: poReceivedQty(d, p), pend: p.closed ? 0 : poPendingQty(d, p), contTxt: `${cs.filter((c) => c.status === 'received').length}/${cs.length} received`, value: num(p.qty_kg) * num(p.rate_kg) };
  });
  const poCols = [
    { label: 'PO No', key: 'po_no', className: 'mono' },
    { label: 'Date', key: 'date', render: (r) => fmtDate(r.date) },
    { label: 'Vendor', key: 'vendor' },
    { label: 'Scrap Type', key: 'scrap_type' },
    { label: 'Ordered', key: 'qty_kg', num: true, render: (r) => fmtKg(r.qty_kg), total: (rs) => fmtKg(rs.reduce((a, r) => a + num(r.qty_kg), 0)) },
    { label: 'Rate', key: 'rate_kg', num: true, render: (r) => fmtRate(r.rate_kg) },
    { label: 'Value', key: 'value', num: true, render: (r) => fmtRs(r.value), total: (rs) => fmtRs(rs.reduce((a, r) => a + r.value, 0)) },
    { label: 'Received', key: 'recv', num: true, render: (r) => fmtKg(r.recv), csv: (r) => fmtNum(r.recv, 1), total: (rs) => fmtKg(rs.reduce((a, r) => a + r.recv, 0)) },
    { label: 'Pending', key: 'pend', num: true, render: (r) => fmtKg(r.pend), csv: (r) => fmtNum(r.pend, 1), total: (rs) => fmtKg(rs.reduce((a, r) => a + r.pend, 0)) },
    { label: 'Containers', key: 'contTxt' },
    { label: 'Status', key: 'closed', render: (r) => r.closed ? <Tag cls="bad">Closed</Tag> : r.pend > 0.01 ? <Tag cls="blue">Open</Tag> : <Tag cls="paid">Completed</Tag>, csv: (r) => r.closed ? 'Closed' : r.pend > 0.01 ? 'Open' : 'Completed' },
    { label: '', actions: true, noCsv: true, render: (r) => <>
      <button className="btn link" onClick={() => toggleClose(r)}>{r.closed ? 'Re-open' : 'Close'}</button>
      <button className="btn link red" onClick={() => delPO(r)}>Delete</button>
    </> },
  ];

  const poById = Object.fromEntries(d.purchase_orders.map((p) => [p.id, p]));
  const contRows = d.containers.map((c) => ({ ...c, po_no: poById[c.po_id]?.po_no, vendor: poById[c.po_id]?.vendor }))
    .sort((a, b) => (a.status === 'received') - (b.status === 'received') || (a.expected_arrival || '9').localeCompare(b.expected_arrival || '9'));
  const contCols = [
    { label: 'Container No', key: 'container_no', className: 'mono' },
    { label: 'PO No', key: 'po_no', className: 'mono' },
    { label: 'Vendor', key: 'vendor' },
    { label: 'Expected Arrival', key: 'expected_arrival', render: (r) => fmtDate(r.expected_arrival) },
    { label: 'Status', key: 'status', render: (r) => containerStatusTag(r.status) },
    { label: '', actions: true, noCsv: true, render: (r) => r.status === 'pending' ? <button className="btn link red" onClick={() => delContainer(r)}>Remove</button> : null },
  ];

  return (
    <Page id="po" stats={stats} actions={<>
      <button className="btn" onClick={() => setShow(show === 'po' ? null : 'po')}>+ New PO</button>
      <button className="btn secondary" onClick={() => setShow(show === 'container' ? null : 'container')}>Add Container</button>
    </>}>
      {show === 'po' && <POForm onDone={() => setShow(null)} />}
      {show === 'container' && <ContainerForm onDone={() => setShow(null)} />}
      <DataTable title="Purchase Order Status" columns={poCols} rows={poRows} empty="No purchase orders booked yet." csvName="purchase-orders" dateFilter />
      <DataTable title="Containers Assigned" columns={contCols} rows={contRows} empty="No containers assigned yet." csvName="containers" />
    </Page>
  );
}
