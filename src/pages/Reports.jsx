import { useState } from 'react';
import { Page, Panel, Empty, useApp } from '../components/ui.jsx';
import { fmtKg, fmtRs, fmtPct, fmtMonth, num, inRange, toCSV, downloadFile, todayStr, fmtNum } from '../lib/format.js';
import { recoveryOf } from '../lib/derived.js';

function Bar({ value, max }) {
  return <div className="bar-track"><div className="bar-fill" style={{ width: (max ? Math.max(2, (value / max) * 100) : 0) + '%' }} /></div>;
}

function TopTable({ title, head, rows }) {
  const max = rows[0]?.[1] || 0;
  return (
    <Panel title={title}>
      <div className="table-scroll"><table>
        <thead><tr><th>{head}</th><th className="num">Kg</th><th style={{ width: '35%' }}></th><th className="num">Value</th></tr></thead>
        <tbody>{rows.length ? rows.map(([n, kg, amt]) => (
          <tr key={n}><td>{n}</td><td className="num">{fmtKg(kg)}</td><td><Bar value={kg} max={max} /></td><td className="num">{fmtRs(amt)}</td></tr>
        )) : <tr><td colSpan={4} className="empty">No data</td></tr>}</tbody>
      </table></div>
    </Panel>
  );
}

export default function Reports() {
  const { data } = useApp();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const f = (r) => inRange(r.date, from, to);
  const grns = data.grns.filter(f), batches = data.production_batches.filter(f), sales = data.sales.filter(f);
  const DIV = data.settings.divisions;

  const filters = <>
    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From" style={{ width: 150 }} />
    <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To" style={{ width: 150 }} />
    <button className="btn secondary" onClick={() => window.print()}>Print</button>
  </>;

  if (!grns.length && !batches.length && !sales.length) {
    return <Page id="reports" actions={filters}><Panel><Empty>Reports will appear once you log some activity{from || to ? ' in this date range' : ''}.</Empty></Panel></Page>;
  }

  const byMonth = {};
  const m = (d) => (byMonth[d.slice(0, 7)] = byMonth[d.slice(0, 7)] || { inKg: 0, purchaseAmt: 0, charged: 0, produced: 0, outKg: 0, salesAmt: 0, batches: [] });
  grns.forEach((g) => { const x = m(g.date); x.inKg += num(g.weight_kg); x.purchaseAmt += num(g.amount); });
  batches.forEach((b) => { const x = m(b.date); x.charged += num(b.total_input_kg); x.produced += num(b.output_kg); x.batches.push(b); });
  sales.forEach((s) => { const x = m(s.date); x.outKg += num(s.weight_kg); x.salesAmt += num(s.amount); });
  const months = Object.keys(byMonth).sort().reverse();

  const agg = (list, keyF) => {
    const o = {};
    list.forEach((r) => { const k = keyF(r); o[k] = o[k] || [k, 0, 0]; o[k][1] += num(r.weight_kg); o[k][2] += num(r.amount); });
    return Object.values(o).sort((a, b) => b[1] - a[1]);
  };
  const topVend = agg(grns, (g) => g.vendor).slice(0, 8);
  const topCust = agg(sales, (s) => s.customer).slice(0, 8);

  const gradeRec = {};
  batches.forEach((b) => (gradeRec[b.grade] = gradeRec[b.grade] || []).push(b));
  const divRec = {};
  batches.forEach((b) => (divRec[b.division] = divRec[b.division] || []).push(b));

  const totalPurchase = grns.reduce((a, g) => a + num(g.amount), 0);
  const totalSales = sales.reduce((a, s) => a + num(s.amount), 0);
  const avgBuy = grns.reduce((a, g) => a + num(g.weight_kg), 0) ? totalPurchase / grns.reduce((a, g) => a + num(g.weight_kg), 0) : 0;
  const avgSell = sales.reduce((a, s) => a + num(s.weight_kg), 0) ? totalSales / sales.reduce((a, s) => a + num(s.weight_kg), 0) : 0;

  const exportMonthly = () => {
    const cols = [
      { label: 'Month', key: 'month' }, { label: 'Scrap In (kg)', key: 'inKg' }, { label: 'Purchase (Rs)', key: 'purchaseAmt' },
      { label: 'Charged (kg)', key: 'charged' }, { label: 'Produced (kg)', key: 'produced' }, { label: 'Recovery %', key: 'rec' },
      { label: 'Ingot Sold (kg)', key: 'outKg' }, { label: 'Sales (Rs)', key: 'salesAmt' },
    ];
    const rows = months.map((k) => ({ month: k, ...byMonth[k], rec: fmtNum(recoveryOf(byMonth[k].batches), 2) }));
    downloadFile(`monthly-report-${todayStr()}.csv`, toCSV(cols, rows), 'text/csv');
  };

  return (
    <Page id="reports" actions={filters} stats={[
      { label: 'Purchases', val: fmtRs(totalPurchase), cls: 'blue' },
      { label: 'Sales', val: fmtRs(totalSales), cls: 'green' },
      { label: 'Avg buy rate', val: '₹' + fmtNum(avgBuy, 2) + '/kg' },
      { label: 'Avg sell rate', val: '₹' + fmtNum(avgSell, 2) + '/kg' },
      { label: 'Recovery', val: fmtPct(recoveryOf(batches)), cls: 'teal' },
    ]}>
      <Panel title="Monthly Volume & Value" tools={<button className="btn secondary small" onClick={exportMonthly}>Export CSV</button>}>
        <div className="table-scroll"><table>
          <thead><tr><th>Month</th><th className="num">Scrap In</th><th className="num">Purchase ₹</th><th className="num">Charged</th><th className="num">Produced</th><th className="num">Recovery</th><th className="num">Ingot Sold</th><th className="num">Sales ₹</th></tr></thead>
          <tbody>{months.map((k) => { const x = byMonth[k]; return (
            <tr key={k}><td>{fmtMonth(k)}</td><td className="num">{fmtKg(x.inKg)}</td><td className="num">{fmtRs(x.purchaseAmt)}</td>
              <td className="num">{fmtKg(x.charged)}</td><td className="num">{fmtKg(x.produced)}</td><td className="num">{x.batches.length ? fmtPct(recoveryOf(x.batches)) : '—'}</td>
              <td className="num">{fmtKg(x.outKg)}</td><td className="num">{fmtRs(x.salesAmt)}</td></tr>
          ); })}</tbody>
        </table></div>
      </Panel>
      <div className="row-two">
        <TopTable title="Top Vendors by Volume" head="Vendor" rows={topVend} />
        <TopTable title="Top Customers by Volume" head="Customer" rows={topCust} />
      </div>
      <div className="row-two">
        <Panel title="Recovery by Ingot Grade">
          <div className="table-scroll"><table>
            <thead><tr><th>Grade</th><th className="num">Heats</th><th className="num">Output</th><th className="num">Recovery</th></tr></thead>
            <tbody>{Object.entries(gradeRec).map(([g, l]) => (
              <tr key={g}><td>{g}</td><td className="num">{l.length}</td><td className="num">{fmtKg(l.reduce((a, b) => a + num(b.output_kg), 0))}</td><td className="num">{fmtPct(recoveryOf(l))}</td></tr>
            ))}{!batches.length && <tr><td colSpan={4} className="empty">No batches</td></tr>}</tbody>
          </table></div>
        </Panel>
        <Panel title="Recovery by Division">
          <div className="table-scroll"><table>
            <thead><tr><th>Division</th><th className="num">Heats</th><th className="num">Charged</th><th className="num">Recovery</th></tr></thead>
            <tbody>{Object.entries(divRec).map(([k, l]) => (
              <tr key={k}><td>{(DIV[k] || { label: k }).label}</td><td className="num">{l.length}</td><td className="num">{fmtKg(l.reduce((a, b) => a + num(b.total_input_kg), 0))}</td><td className="num">{fmtPct(recoveryOf(l))}</td></tr>
            ))}{!batches.length && <tr><td colSpan={4} className="empty">No batches</td></tr>}</tbody>
          </table></div>
        </Panel>
      </div>
    </Page>
  );
}
