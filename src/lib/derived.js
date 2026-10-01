// Business calculations — same logic as the original Baheti ERP template.
import { num } from './format.js';

export function rawStock(data) {
  const map = {};
  data.settings.scrap_types.forEach((t) => (map[t] = 0));
  data.grns.forEach((g) => { map[g.scrap_type] = (map[g.scrap_type] || 0) + num(g.weight_kg); });
  data.production_batches.forEach((b) => (b.scrap_inputs || []).forEach((si) => {
    map[si.type] = (map[si.type] || 0) - num(si.weight_kg);
  }));
  return map;
}

export function ingotStock(data) {
  const map = {};
  data.settings.ingot_grades.forEach((g) => (map[g] = 0));
  data.production_batches.forEach((b) => { map[b.grade] = (map[b.grade] || 0) + num(b.output_kg); });
  data.sales.forEach((s) => { map[s.grade] = (map[s.grade] || 0) - num(s.weight_kg); });
  return map;
}

const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);
export const totalRawStock = (d) => sum(rawStock(d));
export const totalIngotStock = (d) => sum(ingotStock(d));

export function recoveryOf(batches) {
  const tin = batches.reduce((a, b) => a + num(b.total_input_kg), 0);
  const tout = batches.reduce((a, b) => a + num(b.output_kg), 0);
  return tin ? (tout / tin) * 100 : 0;
}
export const avgRecovery = (d) => recoveryOf(d.production_batches);

export const payable = (d) => d.grns.reduce((a, g) => a + (num(g.amount) - num(g.paid_amount)), 0);
export const receivable = (d) => d.sales.reduce((a, s) => a + (num(s.amount) - num(s.paid_amount)), 0);

export const poContainers = (d, po) => d.containers.filter((c) => c.po_id === po.id);
export const poReceivedQty = (d, po) => d.grns.filter((g) => g.po_id === po.id).reduce((a, g) => a + num(g.weight_kg), 0);
export const poPendingQty = (d, po) => Math.max(0, num(po.qty_kg) - poReceivedQty(d, po));
export const poIsOpen = (d, po) => !po.closed && poPendingQty(d, po) > 0.01;

export function partyLedger(d) {
  const vend = {}, cust = {};
  d.grns.forEach((g) => {
    const v = (vend[g.vendor] = vend[g.vendor] || { name: g.vendor, role: 'vendor', total: 0, paid: 0, balance: 0, kg: 0, count: 0 });
    v.total += num(g.amount); v.paid += num(g.paid_amount); v.kg += num(g.weight_kg); v.count++;
    v.balance += num(g.amount) - num(g.paid_amount);
  });
  d.sales.forEach((s) => {
    const c = (cust[s.customer] = cust[s.customer] || { name: s.customer, role: 'customer', total: 0, paid: 0, balance: 0, kg: 0, count: 0 });
    c.total += num(s.amount); c.paid += num(s.paid_amount); c.kg += num(s.weight_kg); c.count++;
    c.balance += num(s.amount) - num(s.paid_amount);
  });
  return [...Object.values(vend), ...Object.values(cust)].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
}

export function storeBalances(d) {
  const map = {};
  d.store_transactions.forEach((t) => {
    const k = t.item;
    map[k] = map[k] || { item: k, qty: 0, inQty: 0, outQty: 0, unit: t.unit };
    if (t.type === 'in') { map[k].qty += num(t.qty); map[k].inQty += num(t.qty); }
    else { map[k].qty -= num(t.qty); map[k].outQty += num(t.qty); }
    map[k].unit = t.unit;
  });
  return map;
}

export function paymentStatus(amount, paid) {
  amount = num(amount); paid = num(paid);
  if (paid <= 0) return 'unpaid';
  if (paid >= amount - 0.5) return 'paid';
  return 'partial';
}

export const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b));
export const vendorNames = (d) => uniq([...d.purchase_orders.map((p) => p.vendor), ...d.grns.map((g) => g.vendor)]);
export const customerNames = (d) => uniq(d.sales.map((s) => s.customer));
