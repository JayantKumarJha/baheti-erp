import { useState } from 'react';
import { Page, Panel, Tag, PayTag, Empty, DataTable, useApp } from '../components/ui.jsx';
import PaymentModal from '../components/PaymentModal.jsx';
import { fmtRs, fmtKg, fmtDate, byDateDesc, num } from '../lib/format.js';
import { partyLedger, payable, receivable, paymentStatus } from '../lib/derived.js';

function PartyStatement({ party, onBack }) {
  const { data: d } = useApp();
  const [payFor, setPayFor] = useState(null);
  const isVendor = party.role === 'vendor';
  const bills = isVendor ? d.grns.filter((g) => g.vendor === party.name) : d.sales.filter((s) => s.customer === party.name);
  const pays = d.payments.filter((p) => p.party === party.name && p.ref_type === (isVendor ? 'grn' : 'sale'));

  // Running statement: bills (debit) and payments (credit) in date order
  const lines = [
    ...bills.map((b) => ({ id: 'b' + b.id, date: b.date, doc: isVendor ? b.grn_no : b.invoice_no, text: `${isVendor ? b.scrap_type : b.grade} ${fmtKg(b.weight_kg)}`, bill: num(b.amount), pay: 0 })),
    ...pays.map((p) => ({ id: 'p' + p.id, date: p.date, doc: p.ref_no, text: `Payment${p.mode ? ' — ' + p.mode : ''}${p.note ? ' (' + p.note + ')' : ''}`, bill: 0, pay: num(p.amount) })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.pay - b.pay));
  // Payments made at bill time before the payments table existed (e.g. migrated data) — reconcile
  const recordedPay = pays.reduce((a, p) => a + num(p.amount), 0);
  const billPaid = bills.reduce((a, b) => a + num(b.paid_amount), 0);
  if (billPaid - recordedPay > 0.5) lines.push({ id: 'adj', date: '', doc: '—', text: 'Paid amounts entered on bills (no payment record)', bill: 0, pay: billPaid - recordedPay });
  let run = 0;
  lines.forEach((l) => { run += l.bill - l.pay; l.balance = run; });

  return (
    <>
      <div className="form-actions" style={{ marginBottom: 14 }}>
        <button className="btn secondary" onClick={onBack}>← All parties</button>
        <button className="btn secondary" onClick={() => window.print()}>Print statement</button>
      </div>
      <div className="stats">
        <div className="stat"><div className="stat-label">Party</div><div className="stat-val" style={{ fontSize: 16 }}>{party.name} <Tag cls={party.role}>{isVendor ? 'Vendor' : 'Customer'}</Tag></div></div>
        <div className="stat blue"><div className="stat-label">Total business</div><div className="stat-val blue">{fmtRs(party.total)}</div></div>
        <div className="stat green"><div className="stat-label">{isVendor ? 'Paid' : 'Received'}</div><div className="stat-val green">{fmtRs(party.paid)}</div></div>
        <div className="stat bad"><div className="stat-label">Balance</div><div className="stat-val bad">{fmtRs(party.balance)}</div></div>
      </div>
      <Panel title="Statement of Account">
        <div className="table-scroll"><table>
          <thead><tr><th>Date</th><th>Doc</th><th>Particulars</th><th className="num">Bill</th><th className="num">Payment</th><th className="num">Balance</th></tr></thead>
          <tbody>{lines.map((l) => (
            <tr key={l.id}><td>{fmtDate(l.date)}</td><td className="mono">{l.doc}</td><td className="wrap">{l.text}</td>
              <td className="num">{l.bill ? fmtRs(l.bill) : ''}</td><td className="num">{l.pay ? fmtRs(l.pay) : ''}</td><td className="num">{fmtRs(l.balance)}</td></tr>
          ))}</tbody>
        </table></div>
      </Panel>
      <Panel title="Open Bills">
        {bills.filter((b) => paymentStatus(b.amount, b.paid_amount) !== 'paid').length === 0 ? <Empty>All bills settled.</Empty> : (
          <div className="table-scroll"><table>
            <thead><tr><th>Doc</th><th>Date</th><th className="num">Amount</th><th className="num">Paid</th><th className="num">Balance</th><th>Status</th><th className="actions"></th></tr></thead>
            <tbody>{[...bills].sort(byDateDesc).filter((b) => paymentStatus(b.amount, b.paid_amount) !== 'paid').map((b) => (
              <tr key={b.id}><td className="mono">{isVendor ? b.grn_no : b.invoice_no}</td><td>{fmtDate(b.date)}</td>
                <td className="num">{fmtRs(b.amount)}</td><td className="num">{fmtRs(b.paid_amount)}</td><td className="num">{fmtRs(num(b.amount) - num(b.paid_amount))}</td>
                <td><PayTag amount={b.amount} paid={b.paid_amount} /></td>
                <td className="actions"><button className="btn link" onClick={() => setPayFor(b)}>{isVendor ? 'Pay' : 'Receive'}</button></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Panel>
      {payFor && <PaymentModal refType={isVendor ? 'grn' : 'sale'} record={payFor} onClose={() => setPayFor(null)} />}
    </>
  );
}

export default function Ledger() {
  const { data: d } = useApp();
  const [sel, setSel] = useState(null);
  const [role, setRole] = useState('all');
  const all = partyLedger(d);
  const stats = [
    { label: 'Payable to Vendors', val: fmtRs(payable(d)), cls: 'bad' },
    { label: 'Receivable from Customers', val: fmtRs(receivable(d)), cls: 'green' },
    { label: 'Parties', val: all.length },
  ];

  if (sel) {
    const party = all.find((p) => p.name === sel.name && p.role === sel.role);
    if (party) return <Page id="ledger"><PartyStatement party={party} onBack={() => setSel(null)} /></Page>;
  }

  const rows = all.filter((r) => role === 'all' || r.role === role).map((r) => ({ ...r, id: r.role + ':' + r.name }));
  const cols = [
    { label: 'Party', key: 'name', render: (r) => <button className="btn link" style={{ fontSize: 13 }} onClick={() => setSel(r)}>{r.name}</button>, csv: (r) => r.name },
    { label: 'Role', key: 'role', render: (r) => <Tag cls={r.role}>{r.role === 'vendor' ? 'Vendor' : 'Customer'}</Tag> },
    { label: 'Bills', key: 'count', num: true },
    { label: 'Kg', key: 'kg', num: true, render: (r) => fmtKg(r.kg) },
    { label: 'Total Business', key: 'total', num: true, render: (r) => fmtRs(r.total) },
    { label: 'Paid / Received', key: 'paid', num: true, render: (r) => fmtRs(r.paid) },
    { label: 'Balance', key: 'balance', num: true, render: (r) => r.balance > 0.5 ? (r.role === 'vendor' ? 'We owe ' + fmtRs(r.balance) : 'They owe ' + fmtRs(r.balance)) : 'Settled' },
  ];
  return (
    <Page id="ledger" stats={stats}>
      <DataTable title="Outstanding Balances" columns={cols} rows={rows} empty="No parties recorded yet." csvName="party-ledger"
        tools={<select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: 140, padding: '6px 10px' }}>
          <option value="all">All parties</option><option value="vendor">Vendors</option><option value="customer">Customers</option>
        </select>} />
      <p className="hint" style={{ marginTop: 0 }}>Click a party name to see its full statement and record payments.</p>
    </Page>
  );
}
