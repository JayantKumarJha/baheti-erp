import { Page, Panel, Tag, Empty, useApp } from '../components/ui.jsx';
import { fmtKg, fmtRs, fmtPct, fmtDate, todayStr, num } from '../lib/format.js';
import { rawStock, ingotStock, totalRawStock, totalIngotStock, avgRecovery, payable, receivable, recoveryOf, poIsOpen } from '../lib/derived.js';

export default function Dashboard() {
  const { data, go } = useApp();
  const d = data;
  const divLabel = (k) => (d.settings.divisions[k] || { label: k }).label;

  const stats = [
    { label: 'Raw Scrap Stock', val: fmtKg(totalRawStock(d)), cls: 'blue' },
    { label: 'Finished Ingot Stock', val: fmtKg(totalIngotStock(d)), cls: 'green' },
    { label: 'Avg Recovery Yield', val: fmtPct(avgRecovery(d)), cls: 'teal' },
    { label: 'Payable to Vendors', val: fmtRs(payable(d)), cls: 'bad' },
    { label: 'Receivable from Customers', val: fmtRs(receivable(d)), cls: 'green' },
  ];

  const nothing = !d.grns.length && !d.production_batches.length && !d.sales.length && !d.purchase_orders.length;
  if (nothing) {
    return (
      <Page id="dashboard" stats={stats}>
        <Panel><Empty>No activity yet. Start by booking a <strong>Purchase Order</strong> for your vendor.
          <div style={{ marginTop: 12 }}><button className="btn" onClick={() => go('po')}>+ New Purchase Order</button></div>
        </Empty></Panel>
      </Page>
    );
  }

  const recent = [
    ...d.grns.map((g) => ({ k: 'g' + g.id, date: g.date, text: `GRN ${g.grn_no}: received ${fmtKg(g.weight_kg)} ${g.scrap_type} from ${g.vendor} (PO ${g.po_no})`, amt: g.amount })),
    ...d.production_batches.map((b) => ({ k: 'b' + b.id, date: b.date, text: `Batch #${b.batch_no}: ${divLabel(b.division)} ${b.unit} produced ${fmtKg(b.output_kg)} ${b.grade}`, amt: null })),
    ...d.sales.map((s) => ({ k: 's' + s.id, date: s.date, text: `${s.invoice_no}: sold ${fmtKg(s.weight_kg)} ${s.grade} to ${s.customer}`, amt: s.amount })),
    ...d.gate_entries.map((g) => ({ k: 'ge' + g.id, date: g.date, text: `Gate ${g.gate_no}: container ${g.container_no} arrived (${g.vendor})`, amt: null })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);

  const ing = Object.entries(ingotStock(d)).filter(([, v]) => Math.abs(v) > 0.001);
  const raw = Object.entries(rawStock(d)).filter(([, v]) => Math.abs(v) > 0.001);

  const today = todayStr();
  const todayBatches = d.production_batches.filter((b) => b.date === today);
  const monthKey = today.slice(0, 7);
  const monthBatches = d.production_batches.filter((b) => (b.date || '').startsWith(monthKey));
  const inYard = d.gate_entries.filter((g) => g.status === 'in-yard');
  const pendingCont = d.containers.filter((c) => c.status === 'pending');
  const openPos = d.purchase_orders.filter((p) => poIsOpen(d, p));

  return (
    <Page id="dashboard" stats={stats}>
      <div className="stats">
        <div className="stat"><div className="stat-label">Open POs</div><div className="stat-val">{openPos.length}</div></div>
        <div className="stat"><div className="stat-label">Containers pending arrival</div><div className="stat-val">{pendingCont.length}</div></div>
        <div className="stat"><div className="stat-label">In yard — awaiting GRN</div><div className="stat-val">{inYard.length}</div></div>
        <div className="stat"><div className="stat-label">Today's output</div><div className="stat-val">{fmtKg(todayBatches.reduce((a, b) => a + num(b.output_kg), 0))}</div></div>
        <div className="stat"><div className="stat-label">This month recovery</div><div className="stat-val">{fmtPct(recoveryOf(monthBatches))}</div></div>
      </div>
      <div className="row-two">
        <Panel title="Recent Activity">
          <div className="table-scroll"><table>
            <thead><tr><th>Date</th><th>Activity</th><th className="num">Amount</th></tr></thead>
            <tbody>{recent.map((r) => (
              <tr key={r.k}><td>{fmtDate(r.date)}</td><td className="wrap">{r.text}</td><td className="num">{r.amt != null ? fmtRs(r.amt) : '—'}</td></tr>
            ))}</tbody>
          </table></div>
        </Panel>
        <Panel title="Stock Snapshot" tools={<button className="btn link" onClick={() => go('inventory')}>View inventory →</button>}>
          <div className="table-scroll"><table>
            <thead><tr><th>Grade / Type</th><th className="num">Kg on hand</th></tr></thead>
            <tbody>
              {ing.map(([k, v]) => <tr key={'i' + k}><td>{k} <Tag cls="customer">Ingot</Tag></td><td className="num">{fmtKg(v)}</td></tr>)}
              {raw.map(([k, v]) => <tr key={'r' + k}><td>{k} <Tag cls="vendor">Scrap</Tag></td><td className="num">{fmtKg(v)}</td></tr>)}
              {!ing.length && !raw.length && <tr><td colSpan={2} className="empty">No stock on hand</td></tr>}
            </tbody>
          </table></div>
        </Panel>
      </div>
      {inYard.length > 0 && (
        <Panel title="Containers in yard — GRN pending" tools={<button className="btn small" onClick={() => go('grn')}>Make GRN</button>}>
          <div className="table-scroll"><table>
            <thead><tr><th>Gate No</th><th>Arrived</th><th>Container</th><th>PO</th><th>Vendor</th></tr></thead>
            <tbody>{inYard.map((g) => (
              <tr key={g.id}><td className="mono">{g.gate_no}</td><td>{fmtDate(g.date)} <span className="dim mono">{g.time}</span></td><td className="mono">{g.container_no}</td><td className="mono">{g.po_no}</td><td>{g.vendor}</td></tr>
            ))}</tbody>
          </table></div>
        </Panel>
      )}
    </Page>
  );
}
