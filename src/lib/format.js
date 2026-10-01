export const num = (v) => Number(v) || 0;

export function fmtNum(n, decimals) {
  const d = decimals ?? 2;
  return num(n).toLocaleString('en-IN', { minimumFractionDigits: decimals || 0, maximumFractionDigits: d });
}
export const fmtRs = (n) => '₹' + fmtNum(n, 0);
export const fmtRate = (n) => '₹' + fmtNum(n, 2);
export const fmtKg = (n) => fmtNum(n, 1) + ' kg';
export const fmtPct = (n) => fmtNum(n, 1) + '%';

export function todayStr() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
export function nowTime() { return new Date().toTimeString().slice(0, 5); }

export function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
export function fmtMonth(ym) {
  const dt = new Date(ym + '-01T00:00:00');
  if (isNaN(dt)) return ym;
  return dt.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
export function durationMinutes(start, end) {
  const s = timeToMinutes(start), e = timeToMinutes(end);
  if (s == null || e == null) return null;
  let diff = e - s;
  if (diff < 0) diff += 24 * 60;
  return diff;
}
export function durationLabel(start, end) {
  const diff = durationMinutes(start, end);
  if (diff == null) return '—';
  return `${Math.floor(diff / 60)}h ${diff % 60}m`;
}

// Sort helper: newest first by date, then id
export const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '') || (num(b.id) - num(a.id));

export function matches(row, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  return Object.values(row).some((v) => v != null && typeof v !== 'object' && String(v).toLowerCase().includes(s));
}

export function inRange(date, from, to) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function downloadFile(name, content, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

export function toCSV(columns, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(c.csv ? c.csv(r) : r[c.key])).join(',')).join('\n');
  return head + '\n' + body;
}
