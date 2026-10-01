import { useCallback, useEffect, useRef, useState } from 'react';
import { NAV_GROUPS, PAGES } from './lib/constants.js';
import { loadAll, MODE } from './lib/db.js';
import { AppCtx, Modal } from './components/ui.jsx';
import Dashboard from './pages/Dashboard.jsx';
import PurchaseOrders from './pages/PurchaseOrders.jsx';
import GateEntry from './pages/GateEntry.jsx';
import GRN from './pages/GRN.jsx';
import Production from './pages/Production.jsx';
import Store from './pages/Store.jsx';
import Sales from './pages/Sales.jsx';
import Inventory from './pages/Inventory.jsx';
import Ledger from './pages/Ledger.jsx';
import Payments from './pages/Payments.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';

const PAGE_COMPONENTS = {
  dashboard: Dashboard, po: PurchaseOrders, gate: GateEntry, grn: GRN, production: Production,
  store: Store, sales: Sales, inventory: Inventory, ledger: Ledger, payments: Payments,
  reports: Reports, settings: Settings,
};

const sectionFromHash = () => {
  const h = window.location.hash.replace('#/', '').replace('#', '');
  return PAGES[h] ? h : 'dashboard';
};

export default function App() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [section, setSection] = useState(sectionFromHash);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, err = false) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, err });
    toastTimer.current = setTimeout(() => setToast(null), err ? 6000 : 2800);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const d = await loadAll();
      setData(d);
      setLoadError(null);
    } catch (e) {
      setLoadError(e.message);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Re-sync when the tab regains focus (picks up entries made by other users/devices)
  useEffect(() => {
    if (MODE !== 'supabase') return;
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  useEffect(() => {
    const onHash = () => setSection(sectionFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (id) => { window.location.hash = '/' + id; setSection(id); setMenuOpen(false); window.scrollTo(0, 0); };

  // Run a data-changing action: shows errors, refreshes data, returns true on success.
  const run = useCallback(async (fn, successMsg) => {
    if (busy) return false;
    setBusy(true);
    try {
      await fn();
      await refresh();
      if (successMsg) showToast(successMsg);
      return true;
    } catch (e) {
      console.error(e);
      showToast(e.message || String(e), true);
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, refresh, showToast]);

  const confirm = useCallback((message, okLabel = 'Yes, continue') =>
    new Promise((resolve) => setConfirmState({ message, okLabel, resolve })), []);

  if (!data) {
    return (
      <div className="loading">
        {loadError ? (
          <div className="panel" style={{ maxWidth: 520, margin: 20 }}>
            <div className="panel-head"><h3>Could not connect to the database</h3></div>
            <div className="panel-body">
              <div className="banner err">{loadError}</div>
              <p className="dim" style={{ fontSize: 13 }}>Check that the Supabase URL / key in your Vercel environment variables are correct and that you ran <span className="mono">supabase/schema.sql</span> in the Supabase SQL editor.</p>
              <button className="btn" onClick={refresh}>Try again</button>
            </div>
          </div>
        ) : <>Loading your data…</>}
      </div>
    );
  }

  const Current = PAGE_COMPONENTS[section];
  const ctx = { data, refresh, run, busy, confirm, toast: showToast, go };

  return (
    <AppCtx.Provider value={ctx}>
      <div className="app">
        <div className="mobile-bar">
          <button onClick={() => setMenuOpen(true)} aria-label="Open menu">☰</button>
          <strong>{data.settings.company?.name || 'Baheti'} ERP</strong>
        </div>
        <aside className={'sidebar' + (menuOpen ? ' open' : '')}>
          <div className="brand">
            <div className="brand-mark">{(data.settings.company?.name || 'B').charAt(0).toUpperCase()}</div>
            <div className="brand-name">{data.settings.company?.name || 'Baheti'}</div>
            <div className="brand-sub">{data.settings.company?.tagline || 'Aluminium Recovery'}</div>
          </div>
          <nav className="nav">
            {NAV_GROUPS.map((g) => (
              <div key={g.label}>
                <div className="nav-group-label">{g.label}</div>
                {g.items.map((n) => (
                  <button key={n.id} className={'nav-btn' + (n.id === section ? ' active' : '')} onClick={() => go(n.id)}>
                    <span className="nav-icon">{n.icon}</span>{n.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-foot">
            {MODE === 'supabase'
              ? <span className="conn"><span className="dot on" /> Cloud database (Supabase)</span>
              : <span className="conn"><span className="dot off" /> Local demo mode</span>}
            <div style={{ marginTop: 6 }}>
              <button className="btn link" style={{ color: 'rgba(255,255,255,.8)', padding: 0 }} onClick={() => run(async () => {}, 'Data refreshed')}>↻ Refresh data</button>
            </div>
          </div>
        </aside>
        {menuOpen && <div className="modal-back" style={{ zIndex: 75, background: 'rgba(0,0,0,.25)' }} onClick={() => setMenuOpen(false)} />}
        <main className="main">
          {MODE === 'local' && (
            <div className="banner">
              <b>Local demo mode:</b> data is saved only in this browser. Connect Supabase (see README) to store data in the cloud and share it across devices.
            </div>
          )}
          <Current key={section} />
        </main>
      </div>

      {toast && <div className={'toast' + (toast.err ? ' err' : '')}>{toast.msg}</div>}

      {confirmState && (
        <Modal title="Please confirm" onClose={() => { confirmState.resolve(false); setConfirmState(null); }}>
          <p>{confirmState.message}</p>
          <div className="form-actions">
            <button className="btn" onClick={() => { confirmState.resolve(true); setConfirmState(null); }}>{confirmState.okLabel}</button>
            <button className="btn secondary" onClick={() => { confirmState.resolve(false); setConfirmState(null); }}>Cancel</button>
          </div>
        </Modal>
      )}
    </AppCtx.Provider>
  );
}
