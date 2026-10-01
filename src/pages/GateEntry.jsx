import { useState } from 'react';
import { Page, Panel, Field, Tag, DataTable, useApp } from '../components/ui.jsx';
import { insert, update, remove } from '../lib/db.js';
import { fmtDate, todayStr, nowTime, byDateDesc, fmtKg, num } from '../lib/format.js';

function GateForm({ onDone }) {
  const { data, run, toast } = useApp();
  const posWithPending = data.purchase_orders.filter((p) => !p.closed && data.containers.some((c) => c.po_id === p.id && c.status === 'pending'));
  const [f, setF] = useState({ date: todayStr(), time: nowTime(), po_id: posWithPending[0]?.id ?? '', container_id: '', vehicle_no: '', gross_kg: '', tare_kg: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const po = data.purchase_orders.find((p) => String(p.id) === String(f.po_id));
  const conts = po ? data.containers.filter((c) => c.po_id === po.id && c.status === 'pending') : [];
  const contId = f.container_id || conts[0]?.id || '';
  const net = num(f.gross_kg) - num(f.tare_kg);

  const save = async () => {
    const container = conts.find((c) => String(c.id) === String(contId));
    if (!po || !container) return toast('Select a PO and container.', true);
    const ok = await run(async () => {
      await insert('gate_entries', {
        date: f.date || todayStr(), time: f.time, po_id: po.id, po_no: po.po_no, container_id: container.id, container_no: container.container_no,
        vendor: po.vendor, vehicle_no: f.vehicle_no.trim().toUpperCase() || null,
        gross_kg: f.gross_kg ? num(f.gross_kg) : null, tare_kg: f.tare_kg ? num(f.tare_kg) : null, status: 'in-yard',
      });
      await update('containers', container.id, { status: 'gate-in' });
    }, `Gate entry saved — ${container.container_no} in yard`);
    if (ok) onDone();
  };

  return (
    <Panel title="Log Gate Entry" className="form" body>
      <div className="form-grid">
        <Field label="Date"><input type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Time"><input type="time" value={f.time} onChange={set('time')} /></Field>
        <Field label="Purchase Order">
          <select value={f.po_id} onChange={(e) => setF({ ...f, po_id: e.target.value, container_id: '' })}>
            {posWithPending.length ? posWithPending.map((p) => <option key={p.id} value={p.id}>{p.po_no} — {p.vendor}</option>) : <option value="">No containers pending arrival</option>}
          </select>
        </Field>
        <Field label="Container No">
          <select value={contId} onChange={set('container_id')}>
            {conts.length ? conts.map((c) => <option key={c.id} value={c.id}>{c.container_no}{c.expected_arrival ? ` (ETA ${fmtDate(c.expected_arrival)})` : ''}</option>) : <option value="">—</option>}
          </select>
        </Field>
        <Field label="Vehicle No (optional)"><input type="text" value={f.vehicle_no} onChange={set('vehicle_no')} placeholder="GJ-01-AB-1234" /></Field>
        <Field label="Gross weight kg (optional)"><input type="number" step="1" value={f.gross_kg} onChange={set('gross_kg')} placeholder="Weighbridge" /></Field>
        <Field label="Tare weight kg (optional)"><input type="number" step="1" value={f.tare_kg} onChange={set('tare_kg')} placeholder="Weighbridge" /></Field>
      </div>
      {f.gross_kg && f.tare_kg && <div className="calc">Net weighbridge weight: <b>{fmtKg(net)}</b></div>}
      <div className="hint">Containers must first be added to a PO on the Purchase Orders page.</div>
      <div className="form-actions"><button className="btn" onClick={save}>Save Gate Entry</button><button className="btn secondary" onClick={onDone}>Cancel</button></div>
    </Panel>
  );
}

export default function GateEntry() {
  const { data, run, confirm } = useApp();
  const [show, setShow] = useState(false);
  const d = data;
  const today = todayStr();
  const stats = [
    { label: 'Total Gate Entries', val: d.gate_entries.length },
    { label: 'Arrived Today', val: d.gate_entries.filter((g) => g.date === today).length, cls: 'blue' },
    { label: 'Containers In Yard', val: d.gate_entries.filter((g) => g.status === 'in-yard').length, cls: 'teal' },
    { label: 'GRN Completed', val: d.gate_entries.filter((g) => g.status === 'grn-done').length, cls: 'green' },
  ];

  const del = async (g) => {
    if (g.status !== 'in-yard') return;
    if (await confirm(`Delete gate entry ${g.gate_no}? Container ${g.container_no} will go back to "Pending Arrival".`, 'Delete')) {
      run(async () => {
        await remove('gate_entries', g.id);
        if (g.container_id) await update('containers', g.container_id, { status: 'pending' });
      }, 'Gate entry deleted');
    }
  };

  const rows = [...d.gate_entries].sort((a, b) => byDateDesc(a, b) || (b.time || '').localeCompare(a.time || ''));
  const cols = [
    { label: 'Date', key: 'date', render: (r) => fmtDate(r.date) },
    { label: 'Gate No', key: 'gate_no', className: 'mono' },
    { label: 'Time', key: 'time', className: 'mono' },
    { label: 'PO No', key: 'po_no', className: 'mono' },
    { label: 'Vendor', key: 'vendor' },
    { label: 'Container No', key: 'container_no', className: 'mono' },
    { label: 'Vehicle', key: 'vehicle_no', render: (r) => r.vehicle_no || '—' },
    { label: 'Net (WB)', key: 'gross_kg', num: true, render: (r) => r.gross_kg && r.tare_kg ? fmtKg(num(r.gross_kg) - num(r.tare_kg)) : '—', csv: (r) => r.gross_kg && r.tare_kg ? num(r.gross_kg) - num(r.tare_kg) : '' },
    { label: 'Status', key: 'status', render: (r) => r.status === 'grn-done' ? <Tag cls="paid">GRN Done</Tag> : <Tag cls="partial">In Yard</Tag> },
    { label: '', actions: true, noCsv: true, render: (r) => r.status === 'in-yard' ? <button className="btn link red" onClick={() => del(r)}>Delete</button> : null },
  ];

  return (
    <Page id="gate" stats={stats} actions={<button className="btn" onClick={() => setShow(!show)}>+ New Gate Entry</button>}>
      {show && <GateForm onDone={() => setShow(false)} />}
      <DataTable title="Container Receiving — Day Wise" columns={cols} rows={rows} empty="No gate entries yet." csvName="gate-entries" dateFilter />
    </Page>
  );
}
