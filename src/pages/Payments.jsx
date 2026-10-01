import { Page, Tag, DataTable, useApp } from '../components/ui.jsx';
import { remove, update } from '../lib/db.js';
import { fmtRs, fmtDate, byDateDesc, num } from '../lib/format.js';

export default function Payments() {
  const { data: d, run, confirm } = useApp();
  const out = d.payments.filter((p) => p.ref_type === 'grn');
  const inc = d.payments.filter((p) => p.ref_type === 'sale');
  const stats = [
    { label: 'Paid to Vendors', val: fmtRs(out.reduce((a, p) => a + num(p.amount), 0)), cls: 'bad' },
    { label: 'Received from Customers', val: fmtRs(inc.reduce((a, p) => a + num(p.amount), 0)), cls: 'green' },
    { label: 'Payment Entries', val: d.payments.length },
  ];

  const del = async (p) => {
    if (!(await confirm(`Delete this payment of ${fmtRs(p.amount)} (${p.party}, ${p.ref_no})? The bill's paid amount will be reduced.`, 'Delete'))) return;
    run(async () => {
      const table = p.ref_type === 'grn' ? 'grns' : 'sales';
      const bill = d[table].find((b) => b.id === p.ref_id);
      await remove('payments', p.id);
      if (bill) await update(table, bill.id, { paid_amount: Math.max(0, num(bill.paid_amount) - num(p.amount)) });
    }, 'Payment deleted');
  };

  const cols = [
    { label: 'Date', key: 'date', render: (r) => fmtDate(r.date) },
    { label: 'Direction', key: 'ref_type', render: (r) => r.ref_type === 'grn' ? <Tag cls="vendor">Paid out</Tag> : <Tag cls="paid">Received</Tag>, csv: (r) => r.ref_type === 'grn' ? 'Paid out' : 'Received' },
    { label: 'Party', key: 'party' },
    { label: 'Against', key: 'ref_no', className: 'mono' },
    { label: 'Mode', key: 'mode', render: (r) => r.mode || '—' },
    { label: 'Reference', key: 'note', render: (r) => r.note || '—' },
    { label: 'Amount', key: 'amount', num: true, render: (r) => fmtRs(r.amount), total: (rs) => fmtRs(rs.reduce((a, r) => a + num(r.amount), 0)) },
    { label: '', actions: true, noCsv: true, render: (r) => <button className="btn link red" onClick={() => del(r)}>Delete</button> },
  ];
  return (
    <Page id="payments" stats={stats}>
      <DataTable title="Payment Register" columns={cols} rows={[...d.payments].sort(byDateDesc)} empty="No payments recorded yet. Use Pay / Receive on the GRN, Sales or Party Ledger pages." csvName="payments" dateFilter />
    </Page>
  );
}
