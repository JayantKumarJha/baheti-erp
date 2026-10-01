import { useState } from 'react';
import { Page, Panel, Field, PayTag, DataTable, DatalistInput, useApp } from '../components/ui.jsx';
import PaymentModal from '../components/PaymentModal.jsx';
import { insert, remove } from '../lib/db.js';
import { fmtKg, fmtRs, fmtRate, fmtDate, todayStr, byDateDesc, num, fmtNum } from '../lib/format.js';
import { receivable, ingotStock, customerNames, paymentStatus } from '../lib/derived.js';

function SaleForm({ onDone }) {
  const { data, run, toast, confirm } = useApp();
  const stock = ingotStock(data);
  const [f, setF] = useState({ date: todayStr(), customer: '', grade: data.settings.ingot_grades[0], weight: '', rate: '', paid: '', vehicle_no: '', remarks: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const amount = num(f.weight) * num(f.rate);
  const available = stock[f.grade] || 0;

  const save = async () => {
    const customer = f.customer.trim(), weight = parseFloat(f.weight), rate = parseFloat(f.rate);
    if (!customer || !weight || f.rate === '' || !(rate >= 0)) return toast('Please fill customer, weight and rate.', true);
    if (weight > available + 0.001 && !(await confirm(`Only ${fmtKg(available)} of ${f.grade} in stock. Log this sale anyway?`, 'Log anyway'))) return;
    const paid = Math.min(num(f.paid), amount);
    const ok = await run(async () => {
      const s = await insert('sales', {
        date: f.date || todayStr(), customer, grade: f.grade, weight_kg: weight, rate_kg: rate,
        amount: Math.round(amount * 100) / 100, paid_amount: paid, vehicle_no: f.vehicle_no.trim().toUpperCase() || null, remarks: f.remarks.trim() || null,
      });
      if (paid > 0) await insert('payments', { date: s.date, ref_type: 'sale', ref_id: s.id, ref_no: s.invoice_no, party: customer, amount: paid, mode: 'Advance / at sale', note: null });
    }, 'Sale saved');
    if (ok) onDone();
  };

  return (
    <Panel title="Log Sale" className="form" body>
      <div className="form-grid">
        <Field label="Date"><input type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Customer"><DatalistInput id="customer-list" options={customerNames(data)} value={f.customer} onChange={set('customer')} placeholder="Customer name" /></Field>
        <Field label="Ingot Grade">
          <select value={f.grade} onChange={set('grade')}>
            {data.settings.ingot_grades.map((g) => <option key={g} value={g}>{g} — stock {fmtNum(stock[g] || 0, 0)} kg</option>)}
          </select>
        </Field>
        <Field label="Weight (kg)"><input type="number" step="0.1" value={f.weight} onChange={set('weight')} placeholder="0.0" /></Field>
        <Field label="Rate (₹/kg)"><input type="number" step="0.01" value={f.rate} onChange={set('rate')} placeholder="0.00" /></Field>
        <Field label="Paid Amount (₹)"><input type="number" step="1" value={f.paid} onChange={set('paid')} placeholder="0" /></Field>
        <Field label="Vehicle No"><input type="text" value={f.vehicle_no} onChange={set('vehicle_no')} placeholder="Optional" /></Field>
        <Field label="Remarks"><input type="text" value={f.remarks} onChange={set('remarks')} placeholder="Optional" /></Field>
      </div>
      <div className="calc">
        <span>Available {f.grade}: <b>{fmtKg(available)}</b></span>
        <span>Sale amount: <b>{fmtRs(amount)}</b></span>
        <span>Invoice No is generated automatically.</span>
      </div>
      <div className="form-actions"><button className="btn" onClick={save}>Save Entry</button><button className="btn secondary" onClick={onDone}>Cancel</button></div>
    </Panel>
  );
}

export default function Sales() {
  const { data, run, confirm } = useApp();
  const [show, setShow] = useState(false);
  const [payFor, setPayFor] = useState(null);
  const d = data;
  const stats = [
    { label: 'Total Ingot Sold', val: fmtKg(d.sales.reduce((a, s) => a + num(s.weight_kg), 0)), cls: 'green' },
    { label: 'Total Sales Value', val: fmtRs(d.sales.reduce((a, s) => a + num(s.amount), 0)), cls: 'blue' },
    { label: 'Outstanding from Customers', val: fmtRs(receivable(d)), cls: 'teal' },
  ];

  const del = async (s) => {
    const pays = d.payments.filter((p) => p.ref_type === 'sale' && p.ref_id === s.id);
    if (!(await confirm(`Delete ${s.invoice_no} (${s.customer})? ${fmtKg(s.weight_kg)} ${s.grade} returns to stock.` + (pays.length ? ` ${pays.length} payment record(s) will also be deleted.` : ''), 'Delete'))) return;
    run(async () => {
      for (const p of pays) await remove('payments', p.id);
      await remove('sales', s.id);
    }, `${s.invoice_no} deleted`);
  };

  const cols = [
    { label: 'Invoice', key: 'invoice_no', className: 'mono' },
    { label: 'Date', key: 'date', render: (r) => fmtDate(r.date) },
    { label: 'Customer', key: 'customer' },
    { label: 'Grade', key: 'grade' },
    { label: 'Weight', key: 'weight_kg', num: true, render: (r) => fmtKg(r.weight_kg), total: (rs) => fmtKg(rs.reduce((a, r) => a + num(r.weight_kg), 0)) },
    { label: 'Rate', key: 'rate_kg', num: true, render: (r) => fmtRate(r.rate_kg) },
    { label: 'Amount', key: 'amount', num: true, render: (r) => fmtRs(r.amount), total: (rs) => fmtRs(rs.reduce((a, r) => a + num(r.amount), 0)) },
    { label: 'Received', key: 'paid_amount', num: true, render: (r) => fmtRs(r.paid_amount), total: (rs) => fmtRs(rs.reduce((a, r) => a + num(r.paid_amount), 0)) },
    { label: 'Balance', key: 'bal', num: true, render: (r) => fmtRs(num(r.amount) - num(r.paid_amount)), csv: (r) => fmtNum(num(r.amount) - num(r.paid_amount), 2), total: (rs) => fmtRs(rs.reduce((a, r) => a + num(r.amount) - num(r.paid_amount), 0)) },
    { label: 'Status', key: 'status', render: (r) => <PayTag amount={r.amount} paid={r.paid_amount} />, csv: (r) => paymentStatus(r.amount, r.paid_amount) },
    { label: '', actions: true, noCsv: true, render: (r) => <>
      {paymentStatus(r.amount, r.paid_amount) !== 'paid' && <button className="btn link" onClick={() => setPayFor(r)}>Receive</button>}
      <button className="btn link red" onClick={() => del(r)}>Delete</button>
    </> },
  ];

  return (
    <Page id="sales" stats={stats} actions={<button className="btn" onClick={() => setShow(!show)}>+ Log Sale</button>}>
      {show && <SaleForm onDone={() => setShow(false)} />}
      <DataTable title="Sales History" columns={cols} rows={[...d.sales].sort(byDateDesc)} empty="No sales logged yet." csvName="sales" dateFilter />
      {payFor && <PaymentModal refType="sale" record={payFor} onClose={() => setPayFor(null)} />}
    </Page>
  );
}
