import { createContext, useContext, useMemo, useState } from 'react';
import { PAGES } from '../lib/constants.js';
import { matches, toCSV, downloadFile, fmtNum, todayStr } from '../lib/format.js';
import { paymentStatus } from '../lib/derived.js';

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function Page({ id, actions, stats, children }) {
  const p = PAGES[id];
  return (
    <>
      <div className="topbar">
        <div><h1>{p.title}</h1><p>{p.sub}</p></div>
        <div className="page-action">{actions}</div>
      </div>
      {stats && stats.length > 0 && (
        <div className="stats">
          {stats.map((s) => (
            <div key={s.label} className={'stat ' + (s.cls || '')}>
              <div className="stat-label">{s.label}</div>
              <div className={'stat-val ' + (s.cls || '')}>{s.val}</div>
            </div>
          ))}
        </div>
      )}
      {children}
    </>
  );
}

export function Panel({ title, tools, children, className = '', body = false }) {
  return (
    <div className={'panel ' + className}>
      {(title || tools) && (
        <div className="panel-head"><h3>{title}</h3>{tools && <div className="tools">{tools}</div>}</div>
      )}
      {body ? <div className="panel-body">{children}</div> : children}
    </div>
  );
}

export function Field({ label, children, style }) {
  return <div className="field" style={style}><label>{label}</label>{children}</div>;
}

export function Tag({ cls, children }) { return <span className={'tag ' + cls}>{children}</span>; }

export function PayTag({ amount, paid }) {
  const s = paymentStatus(amount, paid);
  return <Tag cls={s}>{s === 'paid' ? 'Paid' : s === 'partial' ? 'Partial' : 'Unpaid'}</Tag>;
}

export function Empty({ children }) { return <div className="empty">{children}</div>; }

/**
 * Generic table with search, date filter, CSV export and footer totals.
 * columns: [{ key, label, num, render(row), csv(row), total: true | fn(rows), className }]
 */
export function DataTable({ title, columns, rows, empty = 'No records yet.', csvName, search = true, dateFilter = false, tools, rowKey = 'id' }) {
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const filtered = useMemo(() => rows.filter((r) =>
    matches(r, q) && (!dateFilter || ((!from || r.date >= from) && (!to || r.date <= to)))
  ), [rows, q, from, to, dateFilter]);
  const hasTotals = columns.some((c) => c.total);

  const exportCsv = () => {
    const cols = columns.filter((c) => !c.noCsv);
    downloadFile(`${csvName || 'export'}-${todayStr()}.csv`, toCSV(cols, filtered), 'text/csv');
  };

  return (
    <Panel
      title={title}
      tools={<>
        {tools}
        {dateFilter && <>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" style={{ width: 140 }} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To date" style={{ width: 140 }} />
        </>}
        {search && rows.length > 0 && <input type="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />}
        {csvName && rows.length > 0 && <button className="btn secondary small" onClick={exportCsv}>Export CSV</button>}
      </>}
    >
      <div className="table-scroll">
        {!rows.length ? <Empty>{empty}</Empty> : !filtered.length ? <Empty>No records match your filter.</Empty> : (
          <table>
            <thead><tr>{columns.map((c) => <th key={c.label} className={(c.num ? 'num ' : '') + (c.actions ? 'actions' : '')}>{c.label}</th>)}</tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r[rowKey]}>
                  {columns.map((c) => (
                    <td key={c.label} className={[c.num && 'num', c.className, c.actions && 'actions'].filter(Boolean).join(' ')}>
                      {c.render ? c.render(r) : r[c.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {hasTotals && filtered.length > 1 && (
              <tfoot><tr>
                {columns.map((c, i) => (
                  <td key={c.label} className={c.num ? 'num' : ''}>
                    {i === 0 ? 'Total' : c.total ? (typeof c.total === 'function' ? c.total(filtered) : fmtNum(filtered.reduce((a, r) => a + (Number(r[c.key]) || 0), 0), 1)) : ''}
                  </td>
                ))}
              </tr></tfoot>
            )}
          </table>
        )}
      </div>
    </Panel>
  );
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal panel">
        <div className="panel-head"><h3>{title}</h3><button className="btn link" onClick={onClose}>Close</button></div>
        <div className="panel-body">{children}</div>
      </div>
    </div>
  );
}

export function DatalistInput({ id, options, ...props }) {
  return (<>
    <input type="text" list={id} {...props} />
    <datalist id={id}>{options.map((o) => <option key={o} value={o} />)}</datalist>
  </>);
}
