import { useState } from 'react';
import { Page, Panel, Field, PayTag, DataTable, useApp } from '../components/ui.jsx';
import PaymentModal from '../components/PaymentModal.jsx';
import { insert, update, remove } from '../lib/db.js';
import { fmtKg, fmtRs, fmtRate, fmtDate, todayStr, byDateDesc, num, fmtNum } from '../lib/format.js';
import { payable, paymentStatus } from '../lib/derived.js';

function GRNForm({ onDone }) {
  const { data, run, toast } = useApp();
  const pending = data.gate_entries.filter((g) => g.status === 'in-yard').sort(byDateDesc);
  const defaultsFor = (ge) => {
    const po = ge && data.purchase_orders.find((p) => p.id === ge.po_id);
    const wb = ge && ge.gross_kg && ge.tare_kg ? String(num(ge.gross_kg) - num(ge.tare_kg)) : '';
    return { rate: po ? String(po.rate_kg) : '', weight: wb };
  };
  const first = pending[0];
  const [f, setF] = useState({ date: todayStr(), gate_id: first?.id ?? '', weight: defaultsFor(first).weight, rate: defaultsFor(first).rate, paid: '', remarks: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const ge = data.gate_entries.find((g) => String(g.id) === String(f.gate_id));
  const po = ge && data.purchase_orders.find((p) => p.id === ge.po_id);
  const amount = num(f.weight) * num(f.rate);

  const changeGate = (e) => {
    const g = data.gate_entries.find((x) => String(x.id) === e.target.value);
    const df = defaultsFor(g);
    setF({ ...f, gate_id: e.target.value, rate: df.rate, weight: df.weight || f.weight });
  };

  const save = async () => {
    const weight = parseFloat(f.weight), rate = parseFloat(f.rate);
    if (!ge || !weight || f.rate === '' || !(rate >= 0)) return toast('Select a gate entry and fill weight and rate.', true);
    const paid = Math.min(num(f.paid), amount);
    const ok = await run(async () => {
      const g = await insert('grns', {
        date: f.date || todayStr(), po_id: po ? po.id : null, po_no: po ? po.po_no : '—', gate_id: ge.id, gate_no: ge.gate_no,
        vendor: ge.vendor, scrap_type: po ? po.scrap_type : 'Other', weight_kg: weight, rate_kg: rate,
        amount: Math.round(amount * 100) / 100, paid_amount: paid, remarks: f.remarks.trim() || null,
      });
      if (paid > 0) await insert('payments', { date: g.date, ref_type: 'grn', ref_id: g.id, ref_no: g.grn_no, party: g.vendor, amount: paid, mode: 'Advance / at GRN', note: null });
      await update('gate_entries', ge.id, { status: 'grn-done' });
      if (ge.container_id) await update('containers', ge.container_id, { status: 'received' });
    }, 'GRN saved');
    if (ok) onDone();
  };

  return (
    <Panel title="New GRN" className="form" body>
      <div className="form-grid">
        <Field label="Date"><input type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Gate Entry" style={{ gridColumn: 'span 2' }}>
          <select value={f.gate_id} onChange={changeGate}>
            {pending.length ? pending.map((g) => <option key={g.id} value={g.id}>{g.gate_no} — {g.po_no} — {g.container_no} — {g.vendor}</option>) : <option value="">No containers in yard</option>}
          </select>
        </Field>
        <Field label="Weight Received (kg)"><input type="number" step="0.1" value={f.weight} onChange={set('weight')} placeholder="0.0" /></Field>
        <Field label="Rate (₹/kg)"><input type="number" step="0.01" value={f.rate} onChange={set('rate')} placeholder="0.00" /></Field>
        <Field label="Paid Amount (₹)"><input type="number" step="1" value={f.paid} onChange={set('paid')} placeholder="0" /></Field>
        <Field label="Remarks"><input type="text" value={f.remarks} onChange={set('remarks')} placeholder="Optional" /></Field>
      </div>
      <div className="calc">
        {po && <span>Scrap: <b>{po.scrap_type}</b></span>}
        {po && <span>PO pending: <b>{fmtKg(Math.max(0, num(po.qty_kg) - data.grns.filter((g) => g.po_id === po.id).reduce((a, g) => a + num(g.weight_kg), 0)))}</b></span>}
        <span>GRN amount: <b>{fmtRs(amount)}</b></span>
      </div>
      <div className="hint">GRN No is generated automatically and linked to this PO No and Gate No. Rate is pre-filled from the PO.</div>
      <div className="form-actions"><button className="btn" onClick={save}>Save GRN</button><button className="btn secondary" onClick={onDone}>Cancel</button></div>
    </Panel>
  );
}

export default function GRN() {
  const { data, run, confirm } = useApp();
  const [show, setShow] = useState(false);
  const [payFor, setPayFor] = useState(null);
  const d = data;
  const stats = [
    { label: 'Total GRNs', val: d.grns.length },
    { label: 'Total Weight Received', val: fmtKg(d.grns.reduce((a, g) => a + num(g.weight_kg), 0)), cls: 'blue' },
    { label: 'Total Purchase Value', val: fmtRs(d.grns.reduce((a, g) => a + num(g.amount), 0)), cls: 'teal' },
    { label: 'Outstanding to Vendors', val: fmtRs(payable(d)), cls: 'bad' },
  ];

  const del = async (g) => {
    const pays = d.payments.filter((p) => p.ref_type === 'grn' && p.ref_id === g.id);
    const msg = `Delete ${g.grn_no}? The gate entry will go back to "In Yard"` + (pays.length ? ` and ${pays.length} payment record(s) will also be deleted.` : '.');
    if (!(await confirm(msg, 'Delete'))) return;
    run(async () => {
      for (const p of pays) await remove('payments', p.id);
      await remove('grns', g.id);
      const ge = d.gate_entries.find((x) => x.id === g.gate_id);
      if (ge) {
        await update('gate_entries', ge.id, { status: 'in-yard' });
        if (ge.container_id) await update('containers', ge.container_id, { status: 'gate-in' });
      }
    }, `${g.grn_no} deleted`);
  };

  const rows = [...d.grns].sort(byDateDesc);
  const cols = [
    { label: 'GRN No', key: 'grn_no', className: 'mono' },
    { label: 'Date', key: 'date', render: (r) => fmtDate(r.date) },
    { label: 'PO No', key: 'po_no', className: 'mono' },
    { label: 'Gate No', key: 'gate_no', className: 'mono' },
    { label: 'Vendor', key: 'vendor' },
    { label: 'Scrap Type', key: 'scrap_type' },
    { label: 'Weight', key: 'weight_kg', num: true, render: (r) => fmtKg(r.weight_kg), total: (rs) => fmtKg(rs.reduce((a, r) => a + num(r.weight_kg), 0)) },
    { label: 'Rate', key: 'rate_kg', num: true, render: (r) => fmtRate(r.rate_kg) },
    { label: 'Amount', key: 'amount', num: true, render: (r) => fmtRs(r.amount), total: (rs) => fmtRs(rs.reduce((a, r) => a + num(r.amount), 0)) },
    { label: 'Paid', key: 'paid_amount', num: true, render: (r) => fmtRs(r.paid_amount), total: (rs) => fmtRs(rs.reduce((a, r) => a + num(r.paid_amount), 0)) },
    { label: 'Balance', key: 'bal', num: true, render: (r) => fmtRs(num(r.amount) - num(r.paid_amount)), csv: (r) => fmtNum(num(r.amount) - num(r.paid_amount), 2), total: (rs) => fmtRs(rs.reduce((a, r) => a + num(r.amount) - num(r.paid_amount), 0)) },
    { label: 'Status', key: 'paid_amount', render: (r) => <PayTag amount={r.amount} paid={r.paid_amount} />, csv: (r) => paymentStatus(r.amount, r.paid_amount) },
    { label: '', actions: true, noCsv: true, render: (r) => <>
      {paymentStatus(r.amount, r.paid_amount) !== 'paid' && <button className="btn link" onClick={() => setPayFor(r)}>Pay</button>}
      <button className="btn link red" onClick={() => del(r)}>Delete</button>
    </> },
  ];

  return (
    <Page id="grn" stats={stats} actions={<button className="btn" onClick={() => setShow(!show)}>+ New GRN</button>}>
      {show && <GRNForm onDone={() => setShow(false)} />}
      <DataTable title="GRN History" columns={cols} rows={rows} empty="No GRNs recorded yet." csvName="grn" dateFilter />
      {payFor && <PaymentModal refType="grn" record={payFor} onClose={() => setPayFor(null)} />}
    </Page>
  );
}
