import { Page, Panel, useApp } from '../components/ui.jsx';
import { fmtKg, num } from '../lib/format.js';
import { rawStock, ingotStock, totalRawStock, totalIngotStock } from '../lib/derived.js';

function StockTable({ title, label, map, received, issued, inLabel, outLabel }) {
  const keys = Object.keys(map);
  return (
    <Panel title={title}>
      <div className="table-scroll"><table>
        <thead><tr><th>{label}</th><th className="num">{inLabel}</th><th className="num">{outLabel}</th><th className="num">Stock</th></tr></thead>
        <tbody>{keys.map((k) => (
          <tr key={k}>
            <td>{k}</td>
            <td className="num">{fmtKg(received[k] || 0)}</td>
            <td className="num">{fmtKg(issued[k] || 0)}</td>
            <td className="num" style={{ fontWeight: 600, color: map[k] < -0.001 ? 'var(--bad)' : undefined }}>{fmtKg(map[k] || 0)}</td>
          </tr>
        ))}</tbody>
        <tfoot><tr>
          <td>Total</td>
          <td className="num">{fmtKg(Object.values(received).reduce((a, b) => a + b, 0))}</td>
          <td className="num">{fmtKg(Object.values(issued).reduce((a, b) => a + b, 0))}</td>
          <td className="num">{fmtKg(Object.values(map).reduce((a, b) => a + b, 0))}</td>
        </tr></tfoot>
      </table></div>
    </Panel>
  );
}

export default function Inventory() {
  const { data: d } = useApp();
  const rawIn = {}, rawOut = {}, ingIn = {}, ingOut = {};
  d.grns.forEach((g) => (rawIn[g.scrap_type] = (rawIn[g.scrap_type] || 0) + num(g.weight_kg)));
  d.production_batches.forEach((b) => {
    (b.scrap_inputs || []).forEach((s) => (rawOut[s.type] = (rawOut[s.type] || 0) + num(s.weight_kg)));
    ingIn[b.grade] = (ingIn[b.grade] || 0) + num(b.output_kg);
  });
  d.sales.forEach((s) => (ingOut[s.grade] = (ingOut[s.grade] || 0) + num(s.weight_kg)));

  const stats = [
    { label: 'Raw Scrap Stock', val: fmtKg(totalRawStock(d)), cls: 'blue' },
    { label: 'Finished Ingot Stock', val: fmtKg(totalIngotStock(d)), cls: 'green' },
  ];
  return (
    <Page id="inventory" stats={stats} actions={<button className="btn secondary" onClick={() => window.print()}>Print</button>}>
      <div className="row-two">
        <StockTable title="Raw Scrap Stock" label="Scrap Type" map={rawStock(d)} received={rawIn} issued={rawOut} inLabel="Received (GRN)" outLabel="Charged" />
        <StockTable title="Finished Ingot Stock" label="Grade" map={ingotStock(d)} received={ingIn} issued={ingOut} inLabel="Produced" outLabel="Sold" />
      </div>
    </Page>
  );
}
