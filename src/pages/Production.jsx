import { useState } from 'react';
import { Page, Panel, Field, DataTable, useApp } from '../components/ui.jsx';
import { insert, remove } from '../lib/db.js';
import { fmtKg, fmtPct, fmtDate, todayStr, byDateDesc, num, durationLabel, fmtNum } from '../lib/format.js';
import { avgRecovery, rawStock, ingotStock, recoveryOf } from '../lib/derived.js';

function ProductionForm({ onDone }) {
  const { data, run, toast, confirm } = useApp();
  const DIV = data.settings.divisions;
  const SCRAP = data.settings.scrap_types;
  const firstDiv = Object.keys(DIV)[0];
  const [f, setF] = useState({
    date: todayStr(), division: firstDiv, unit: DIV[firstDiv].units[0],
    scrapRows: [{ type: SCRAP[0], weight: '' }], startTime: '', endTime: '',
    skelnerStart: '', skelnerEnd: '', skelnerRows: [], grade: data.settings.ingot_grades[0], output: '', dross: '', remarks: '',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const div = DIV[f.division];
  const twoStage = !!div?.twoStage;
  const stock = rawStock(data);

  const setRow = (list, i, k, v) => setF({ ...f, [list]: f[list].map((r, j) => (j === i ? { ...r, [k]: v } : r)) });
  const addRow = (list, row) => setF({ ...f, [list]: [...f[list], row] });
  const delRow = (list, i) => setF({ ...f, [list]: f[list].filter((_, j) => j !== i) });

  const scrapTotal = f.scrapRows.reduce((a, r) => a + num(r.weight), 0);
  const skTotal = twoStage ? f.skelnerRows.reduce((a, r) => a + (r.name ? num(r.weight) : 0), 0) : 0;
  const totalInput = scrapTotal + skTotal;
  const recovery = totalInput ? (num(f.output) / totalInput) * 100 : 0;

  const save = async () => {
    const scrapRows = f.scrapRows.filter((r) => parseFloat(r.weight) > 0).map((r) => ({ type: r.type, weight_kg: parseFloat(r.weight) }));
    if (!scrapRows.length) return toast('Add at least one scrap type with weight.', true);
    const output = parseFloat(f.output);
    if (!output) return toast('Enter output weight.', true);
    // Check scrap availability (combined per type)
    const need = {};
    scrapRows.forEach((r) => (need[r.type] = (need[r.type] || 0) + r.weight_kg));
    const short = Object.entries(need).filter(([t, w]) => w > (stock[t] || 0) + 0.001);
    if (short.length && !(await confirm(`Not enough stock for: ${short.map(([t, w]) => `${t} (need ${fmtKg(w)}, have ${fmtKg(stock[t] || 0)})`).join('; ')}. Save anyway?`, 'Save anyway'))) return;

    let skelner = null;
    let total = scrapRows.reduce((a, r) => a + r.weight_kg, 0);
    if (twoStage) {
      const additions = f.skelnerRows.filter((r) => r.name && parseFloat(r.weight) > 0).map((r) => ({ name: r.name.trim(), weight_kg: parseFloat(r.weight) }));
      skelner = { start_time: f.skelnerStart, end_time: f.skelnerEnd, additions };
      total += additions.reduce((a, r) => a + r.weight_kg, 0);
    }
    if (output > total && !(await confirm('Output weight is more than total charge weight. Save anyway?', 'Save anyway'))) return;

    const ok = await run(() => insert('production_batches', {
      date: f.date || todayStr(), division: f.division, unit: f.unit, scrap_inputs: scrapRows,
      start_time: f.startTime || null, end_time: f.endTime || null, skelner, grade: f.grade,
      output_kg: output, dross_kg: num(f.dross), total_input_kg: total, recovery_pct: total ? Math.round((output / total) * 100000) / 1000 : 0,
      remarks: f.remarks.trim() || null,
    }), 'Batch saved');
    if (ok) onDone();
  };

  return (
    <Panel title="Log Batch / Heat" className="form" body>
      <div className="form-grid">
        <Field label="Date"><input type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Division">
          <select value={f.division} onChange={(e) => {
            const k = e.target.value;
            setF({ ...f, division: k, unit: DIV[k].units[0], ...(DIV[k].twoStage ? {} : { skelnerRows: [], skelnerStart: '', skelnerEnd: '' }) });
          }}>
            {Object.entries(DIV).map(([k, dv]) => <option key={k} value={k}>{dv.label}</option>)}
          </select>
        </Field>
        <Field label="Unit"><select value={f.unit} onChange={set('unit')}>{div.units.map((u) => <option key={u}>{u}</option>)}</select></Field>
      </div>

      <div className="field" style={{ marginBottom: 14 }}>
        <label>Scrap charged (add more than one type for the same heat if needed)</label>
        {f.scrapRows.map((row, i) => (
          <div className="dyn-row" key={i}>
            <select value={row.type} onChange={(e) => setRow('scrapRows', i, 'type', e.target.value)}>
              {SCRAP.map((t) => <option key={t} value={t}>{t} — stock {fmtNum(stock[t] || 0, 0)} kg</option>)}
            </select>
            <input type="number" step="0.1" placeholder="kg" value={row.weight} onChange={(e) => setRow('scrapRows', i, 'weight', e.target.value)} />
            {f.scrapRows.length > 1 && <button className="btn secondary small" type="button" onClick={() => delRow('scrapRows', i)}>Remove</button>}
          </div>
        ))}
        <button className="btn secondary small" type="button" style={{ marginTop: 4 }} onClick={() => addRow('scrapRows', { type: SCRAP[0], weight: '' })}>+ Add scrap type</button>
      </div>

      <div className="form-grid">
        <Field label={twoStage ? `${div.label} start time` : 'Process start time'}><input type="time" value={f.startTime} onChange={set('startTime')} /></Field>
        <Field label={twoStage ? `${div.label} end time` : 'Process end time'}><input type="time" value={f.endTime} onChange={set('endTime')} /></Field>
      </div>

      {twoStage && (
        <div className="subpanel">
          <div className="panel-head"><h3>Skelner stage</h3></div>
          <div className="panel-body">
            <div className="form-grid">
              <Field label="Skelner start time"><input type="time" value={f.skelnerStart} onChange={set('skelnerStart')} /></Field>
              <Field label="Skelner end time"><input type="time" value={f.skelnerEnd} onChange={set('skelnerEnd')} /></Field>
            </div>
            <div className="field">
              <label>Alloys / metals added (increases total charge weight)</label>
              {!f.skelnerRows.length && <div className="hint" style={{ margin: '4px 0' }}>No additions yet.</div>}
              {f.skelnerRows.map((row, i) => (
                <div className="dyn-row" key={i}>
                  <input type="text" placeholder="Alloy / metal name (e.g. Silicon, Copper)" value={row.name} onChange={(e) => setRow('skelnerRows', i, 'name', e.target.value)} />
                  <input type="number" step="0.1" placeholder="kg" value={row.weight} onChange={(e) => setRow('skelnerRows', i, 'weight', e.target.value)} />
                  <button className="btn secondary small" type="button" onClick={() => delRow('skelnerRows', i)}>Remove</button>
                </div>
              ))}
              <button className="btn secondary small" type="button" style={{ marginTop: 4 }} onClick={() => addRow('skelnerRows', { name: '', weight: '' })}>+ Add alloy addition</button>
            </div>
          </div>
        </div>
      )}

      <div className="form-grid">
        <Field label="Ingot grade produced"><select value={f.grade} onChange={set('grade')}>{data.settings.ingot_grades.map((g) => <option key={g}>{g}</option>)}</select></Field>
        <Field label="Output weight (kg)"><input type="number" step="0.1" value={f.output} onChange={set('output')} /></Field>
        <Field label="Dross / loss (kg, optional)"><input type="number" step="0.1" value={f.dross} onChange={set('dross')} /></Field>
        <Field label="Remarks"><input type="text" value={f.remarks} onChange={set('remarks')} placeholder="Optional" /></Field>
      </div>
      <div className="calc">
        <span>Scrap charged: <b>{fmtKg(scrapTotal)}</b></span>
        {twoStage && <span>Skelner additions: <b>{fmtKg(skTotal)}</b></span>}
        <span>Total charge: <b>{fmtKg(totalInput)}</b></span>
        <span>Recovery: <b>{fmtPct(recovery)}</b></span>
        <span>Process time: <b>{durationLabel(f.startTime, f.endTime)}</b></span>
      </div>
      <div className="hint">Total charge weight = scrap charged{twoStage ? ' + skelner additions' : ''}. Recovery % and process durations are calculated automatically.</div>
      <div className="form-actions"><button className="btn" onClick={save}>Save Batch</button><button className="btn secondary" onClick={onDone}>Cancel</button></div>
    </Panel>
  );
}

export default function Production() {
  const { data, run, confirm } = useApp();
  const [show, setShow] = useState(false);
  const d = data;
  const DIV = d.settings.divisions;
  const batches = d.production_batches;
  const stats = [
    { label: 'Batches Logged', val: batches.length },
    { label: 'Total Charged', val: fmtKg(batches.reduce((a, b) => a + num(b.total_input_kg), 0)), cls: 'blue' },
    { label: 'Total Ingot Output', val: fmtKg(batches.reduce((a, b) => a + num(b.output_kg), 0)), cls: 'green' },
    { label: 'Avg Recovery', val: fmtPct(avgRecovery(d)), cls: 'teal' },
  ];

  const del = async (b) => {
    const after = (ingotStock(d)[b.grade] || 0) - num(b.output_kg);
    const warn = after < -0.001 ? ` Warning: ${b.grade} ingot stock will become ${fmtKg(after)} because some of it has already been sold.` : '';
    if (await confirm(`Delete batch #${b.batch_no}? Scrap charged will return to raw stock.${warn}`, 'Delete')) run(() => remove('production_batches', b.id), `Batch #${b.batch_no} deleted`);
  };

  const rows = [...batches].sort(byDateDesc);
  const cols = [
    { label: 'Date', key: 'date', render: (r) => fmtDate(r.date) },
    { label: 'Batch', key: 'batch_no', className: 'mono', render: (r) => '#' + r.batch_no },
    { label: 'Division / Unit', key: 'unit', render: (r) => `${(DIV[r.division] || { label: r.division }).label} — ${r.unit}`, csv: (r) => `${(DIV[r.division] || { label: r.division }).label} - ${r.unit}` },
    { label: 'Scrap Charged', key: 'scrap_inputs', className: 'wrap', render: (r) => (r.scrap_inputs || []).map((s) => `${s.type} ${fmtKg(s.weight_kg)}`).join(', '), csv: (r) => (r.scrap_inputs || []).map((s) => `${s.type} ${s.weight_kg}kg`).join('; ') },
    { label: 'Process Time', key: 'start_time', className: 'mono', render: (r) => (!r.start_time && !r.end_time) ? '—' : <>{r.start_time || '—'}–{r.end_time || '—'} <span className="dim">({durationLabel(r.start_time, r.end_time)})</span></>, csv: (r) => `${r.start_time || ''}-${r.end_time || ''} (${durationLabel(r.start_time, r.end_time)})` },
    { label: 'Skelner Additions', key: 'skelner', className: 'wrap', render: (r) => r.skelner ? <>{(r.skelner.additions || []).map((a) => `${a.name} ${fmtKg(a.weight_kg)}`).join(', ') || '—'} {r.skelner.start_time && r.skelner.end_time && <span className="dim">({durationLabel(r.skelner.start_time, r.skelner.end_time)})</span>}</> : '—', csv: (r) => r.skelner ? (r.skelner.additions || []).map((a) => `${a.name} ${a.weight_kg}kg`).join('; ') : '' },
    { label: 'Grade', key: 'grade' },
    { label: 'Charge', key: 'total_input_kg', num: true, render: (r) => fmtKg(r.total_input_kg), total: (rs) => fmtKg(rs.reduce((a, r) => a + num(r.total_input_kg), 0)) },
    { label: 'Output', key: 'output_kg', num: true, render: (r) => fmtKg(r.output_kg), total: (rs) => fmtKg(rs.reduce((a, r) => a + num(r.output_kg), 0)) },
    { label: 'Recovery', key: 'recovery_pct', num: true, render: (r) => fmtPct(r.recovery_pct), total: (rs) => fmtPct(recoveryOf(rs)) },
    { label: '', actions: true, noCsv: true, render: (r) => <button className="btn link red" onClick={() => del(r)}>Delete</button> },
  ];

  // Division / unit summary
  const units = {};
  batches.forEach((b) => {
    const k = `${b.division}|${b.unit}`;
    units[k] = units[k] || { division: b.division, unit: b.unit, list: [] };
    units[k].list.push(b);
  });
  const unitRows = Object.values(units).sort((a, b) => a.division.localeCompare(b.division) || a.unit.localeCompare(b.unit));

  return (
    <Page id="production" stats={stats} actions={<button className="btn" onClick={() => setShow(!show)}>+ Log Batch / Heat</button>}>
      {show && <ProductionForm onDone={() => setShow(false)} />}
      <DataTable title="Batch / Heat History" columns={cols} rows={rows} empty="No batches logged yet." csvName="production" dateFilter />
      {unitRows.length > 0 && (
        <Panel title="Division / Unit Performance">
          <div className="table-scroll"><table>
            <thead><tr><th>Division</th><th>Unit</th><th className="num">Heats</th><th className="num">Charged</th><th className="num">Output</th><th className="num">Recovery</th></tr></thead>
            <tbody>{unitRows.map((u) => (
              <tr key={u.division + u.unit}>
                <td>{(DIV[u.division] || { label: u.division }).label}</td><td>{u.unit}</td><td className="num">{u.list.length}</td>
                <td className="num">{fmtKg(u.list.reduce((a, b) => a + num(b.total_input_kg), 0))}</td>
                <td className="num">{fmtKg(u.list.reduce((a, b) => a + num(b.output_kg), 0))}</td>
                <td className="num">{fmtPct(recoveryOf(u.list))}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </Panel>
      )}
    </Page>
  );
}
