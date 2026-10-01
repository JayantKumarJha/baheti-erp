import { useState } from 'react';
import { Page, Panel, Field, useApp } from '../components/ui.jsx';
import { saveSetting, exportBackup, importBackupLocal, clearLocal, MODE } from '../lib/db.js';
import { downloadFile, todayStr } from '../lib/format.js';
import { TABLES } from '../lib/constants.js';

function ListEditor({ title, settingKey, hint }) {
  const { data, run, toast, confirm } = useApp();
  const list = data.settings[settingKey] || [];
  const [val, setVal] = useState('');
  const add = () => {
    const v = val.trim();
    if (!v) return;
    if (list.some((x) => x.toLowerCase() === v.toLowerCase())) return toast(`"${v}" already exists.`, true);
    run(() => saveSetting(settingKey, [...list, v]), `Added ${v}`).then((ok) => ok && setVal(''));
  };
  const del = async (v) => {
    if (list.length <= 1) return toast('At least one entry is required.', true);
    if (await confirm(`Remove "${v}" from the list? Existing records that use it are not changed.`, 'Remove')) run(() => saveSetting(settingKey, list.filter((x) => x !== v)), `Removed ${v}`);
  };
  return (
    <Panel title={title} body>
      <div className="chips">{list.map((v) => <span className="chip" key={v}>{v}<button title="Remove" onClick={() => del(v)}>×</button></span>)}</div>
      <div className="dyn-row">
        <input type="text" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Add new…" />
        <button className="btn small" onClick={add}>Add</button>
      </div>
      {hint && <div className="hint" style={{ marginTop: 6, marginBottom: 0 }}>{hint}</div>}
    </Panel>
  );
}

function DivisionsEditor() {
  const { data, run, toast, confirm } = useApp();
  const [divs, setDivs] = useState(() => Object.entries(data.settings.divisions).map(([k, v]) => ({ key: k, label: v.label, units: v.units.join(', '), twoStage: !!v.twoStage })));
  const setD = (i, k, v) => setDivs(divs.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  const save = () => {
    const out = {};
    for (const d of divs) {
      const key = d.key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
      const units = d.units.split(',').map((u) => u.trim()).filter(Boolean);
      if (!key || !d.label.trim() || !units.length) return toast('Every division needs a code, a name and at least one unit.', true);
      if (out[key]) return toast(`Duplicate division code ${key}.`, true);
      out[key] = { label: d.label.trim(), units, twoStage: d.twoStage };
    }
    run(() => saveSetting('divisions', out), 'Divisions saved');
  };
  const del = async (i) => {
    const used = data.production_batches.some((b) => b.division === divs[i].key);
    if (await confirm(used ? `Division ${divs[i].key} has batches logged. Remove it from the list anyway? (past batches keep their data)` : `Remove division ${divs[i].label}?`, 'Remove')) setDivs(divs.filter((_, j) => j !== i));
  };
  return (
    <Panel title="Production Divisions & Units" body>
      {divs.map((d, i) => (
        <div className="dyn-row" key={i}>
          <input type="text" value={d.key} onChange={(e) => setD(i, 'key', e.target.value)} placeholder="Code (e.g. EF700)" style={{ maxWidth: 120 }} />
          <input type="text" value={d.label} onChange={(e) => setD(i, 'label', e.target.value)} placeholder="Name" />
          <input type="text" value={d.units} onChange={(e) => setD(i, 'units', e.target.value)} placeholder="Units, comma separated" style={{ flex: 2 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flex: '0 0 auto' }}>
            <input type="checkbox" checked={d.twoStage} onChange={(e) => setD(i, 'twoStage', e.target.checked)} /> Skelner stage
          </label>
          <button className="btn danger small" onClick={() => del(i)}>Remove</button>
        </div>
      ))}
      <div className="form-actions" style={{ marginTop: 10 }}>
        <button className="btn secondary small" onClick={() => setDivs([...divs, { key: '', label: '', units: '', twoStage: false }])}>+ Add division</button>
        <button className="btn small" onClick={save}>Save divisions</button>
      </div>
      <div className="hint" style={{ marginTop: 8, marginBottom: 0 }}>Tick “Skelner stage” for two-stage processes (like TRF) where alloys are added after melting.</div>
    </Panel>
  );
}

export default function Settings() {
  const { data, run, toast, confirm } = useApp();
  const [company, setCompany] = useState(data.settings.company || { name: '', tagline: '' });

  const doExport = async () => {
    const b = await exportBackup();
    downloadFile(`baheti-erp-backup-${todayStr()}.json`, JSON.stringify(b, null, 2), 'application/json');
    toast('Backup downloaded');
  };
  const doImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const b = JSON.parse(reader.result);
        if (!(await confirm('Replace ALL data in this browser with the backup file?', 'Replace data'))) return;
        run(async () => importBackupLocal(b), 'Backup restored');
      } catch (err) { toast('Could not read file: ' + err.message, true); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  const doClear = async () => {
    if (await confirm('Delete ALL data stored in this browser? Download a backup first if you need it.', 'Delete everything')) run(async () => clearLocal(), 'Local data cleared');
  };

  const counts = TABLES.map((t) => [t, data[t].length]);

  return (
    <Page id="settings">
      <Panel title="Company" body>
        <div className="form-grid">
          <Field label="Company name"><input type="text" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} /></Field>
          <Field label="Tagline"><input type="text" value={company.tagline} onChange={(e) => setCompany({ ...company, tagline: e.target.value })} /></Field>
        </div>
        <button className="btn small" onClick={() => run(() => saveSetting('company', company), 'Company details saved')}>Save</button>
      </Panel>

      <div className="row-two">
        <ListEditor title="Scrap Types" settingKey="scrap_types" hint="Used in Purchase Orders, GRN and Production." />
        <ListEditor title="Ingot Grades" settingKey="ingot_grades" hint="Used in Production and Sales." />
      </div>
      <div className="row-two">
        <ListEditor title="Payment Modes" settingKey="payment_modes" />
        <Panel title="Where your data is stored" body>
          {MODE === 'supabase' ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>
              <b style={{ color: 'var(--green-dark)' }}>Cloud database (Supabase Postgres).</b> Every entry is saved instantly to your Supabase project and is visible from any device that opens this app. Supabase keeps daily backups on paid plans; on the free plan, download a JSON backup here regularly.
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>
              <b style={{ color: 'var(--warn)' }}>This browser only (local demo mode).</b> Data is lost if browser data is cleared, and other computers can't see it. Add the Supabase keys in Vercel to switch to the cloud database.
            </p>
          )}
          <table style={{ marginTop: 12 }}><tbody>
            {counts.map(([t, n]) => <tr key={t}><td className="mono" style={{ padding: '4px 0' }}>{t}</td><td className="num" style={{ padding: '4px 0' }}>{n} rows</td></tr>)}
          </tbody></table>
        </Panel>
      </div>

      <DivisionsEditor />

      <Panel title="Backup & Restore" body>
        <div className="form-actions">
          <button className="btn blue" onClick={doExport}>Download full backup (JSON)</button>
          {MODE === 'local' && <>
            <label className="btn secondary" style={{ cursor: 'pointer' }}>Restore from backup<input type="file" accept="application/json,.json" onChange={doImport} style={{ display: 'none' }} /></label>
            <button className="btn danger" onClick={doClear}>Clear all local data</button>
          </>}
        </div>
        <div className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          {MODE === 'supabase' ? 'Each table can also be exported to Excel-ready CSV from its own page, or from Supabase → Table Editor.' : 'Restore is available in local mode. In cloud mode, data is restored from Supabase.'}
        </div>
      </Panel>
    </Page>
  );
}
