// Default master data. Editable at runtime from the Settings page (stored in the `settings` table).
export const DEFAULT_SETTINGS = {
  company: { name: 'Baheti', tagline: 'Aluminium Recovery' },
  scrap_types: ['UBC (Cans)', 'Extrusion Scrap', 'Wheel Scrap', 'Radiator Scrap', 'Utensil Scrap', 'Sheet Scrap', 'Mixed Scrap', 'Other'],
  ingot_grades: ['ADC12', 'LM6', 'LM24', 'A356', 'Standard Ingot', 'Deox Ingot', 'Other'],
  divisions: {
    TRF: { label: 'TRF', units: ['TRF 1', 'TRF 2'], twoStage: true },
    EF700: { label: 'Electrical Furnace (700 kg)', units: ['EF-1', 'EF-2', 'EF-3', 'EF-4', 'EF-5', 'EF-6', 'EF-7'], twoStage: false },
    EF1000: { label: 'Electrical Furnace (1 MT)', units: ['EF-1', 'EF-2', 'EF-3', 'EF-4', 'EF-5'], twoStage: false },
  },
  payment_modes: ['Bank Transfer', 'RTGS/NEFT', 'Cheque', 'Cash', 'UPI'],
};

export const TABLES = [
  'purchase_orders', 'containers', 'gate_entries', 'grns',
  'production_batches', 'store_transactions', 'sales', 'payments',
];

export const NAV_GROUPS = [
  { label: 'Overview', items: [{ id: 'dashboard', label: 'Dashboard', icon: '◉' }] },
  { label: 'Purchase cycle', items: [
    { id: 'po', label: 'Purchase Orders', icon: '✎' },
    { id: 'gate', label: 'Gate Entry', icon: '▣' },
    { id: 'grn', label: 'GRN', icon: '▼' },
  ] },
  { label: 'Production', items: [{ id: 'production', label: 'Production Process', icon: '●' }] },
  { label: 'Store', items: [{ id: 'store', label: 'Store In / Out', icon: '☰' }] },
  { label: 'Sales & stock', items: [
    { id: 'sales', label: 'Sales', icon: '▲' },
    { id: 'inventory', label: 'Inventory', icon: '□' },
  ] },
  { label: 'Records', items: [
    { id: 'ledger', label: 'Party Ledger', icon: '₹' },
    { id: 'payments', label: 'Payments', icon: '⇄' },
    { id: 'reports', label: 'Reports', icon: '▤' },
  ] },
  { label: 'Admin', items: [{ id: 'settings', label: 'Settings & Backup', icon: '⚙' }] },
];

export const PAGES = {
  dashboard: { title: 'Dashboard', sub: 'Overview of scrap, production and sales' },
  po: { title: 'Purchase Orders', sub: 'Book raw material vendor-wise and assign containers' },
  gate: { title: 'Gate Entry', sub: 'Log container arrivals at the plant gate' },
  grn: { title: 'GRN', sub: 'Goods receipt against a PO and gate entry' },
  production: { title: 'Production Process', sub: 'TRF / Skelner and electrical furnace melting, division-wise' },
  store: { title: 'Store In / Out', sub: 'Material movement against issue slips' },
  sales: { title: 'Sales', sub: 'Record ingot sales to customers' },
  inventory: { title: 'Inventory', sub: 'Live raw scrap and finished ingot stock' },
  ledger: { title: 'Party Ledger', sub: 'Outstanding balances by vendor and customer' },
  payments: { title: 'Payments', sub: 'Money paid to vendors and received from customers' },
  reports: { title: 'Reports', sub: 'Volumes, recovery efficiency and top parties' },
  settings: { title: 'Settings & Backup', sub: 'Masters, company details and data backup' },
};
