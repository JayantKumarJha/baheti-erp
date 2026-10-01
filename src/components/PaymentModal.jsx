import { useState } from 'react';
import { Modal, Field, useApp } from './ui.jsx';
import { insert, update } from '../lib/db.js';
import { fmtRs, num, todayStr } from '../lib/format.js';

// Record a payment against a GRN (paid to vendor) or a Sale (received from customer).
export default function PaymentModal({ refType, record, onClose }) {
  const { data, run, toast } = useApp();
  const balance = Math.max(0, num(record.amount) - num(record.paid_amount));
  const [date, setDate] = useState(todayStr());
  const [amount, setAmount] = useState(balance ? String(Math.round(balance)) : '');
  const [mode, setMode] = useState(data.settings.payment_modes?.[0] || 'Bank Transfer');
  const [note, setNote] = useState('');
  const isGrn = refType === 'grn';
  const party = isGrn ? record.vendor : record.customer;
  const refNo = isGrn ? record.grn_no : record.invoice_no;
  const table = isGrn ? 'grns' : 'sales';

  const save = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast('Enter a payment amount.', true);
    if (amt > balance + 0.5) return toast(`Amount is more than the balance of ${fmtRs(balance)}.`, true);
    const ok = await run(async () => {
      await insert('payments', { date, ref_type: refType, ref_id: record.id, ref_no: refNo, party, amount: amt, mode, note: note.trim() || null });
      await update(table, record.id, { paid_amount: Math.min(num(record.amount), num(record.paid_amount) + amt) });
    }, `Payment of ${fmtRs(amt)} recorded`);
    if (ok) onClose();
  };

  return (
    <Modal title={`${isGrn ? 'Pay vendor' : 'Receive from customer'} — ${refNo}`} onClose={onClose}>
      <p>{party} · Bill {fmtRs(record.amount)} · Paid {fmtRs(record.paid_amount)} · <b>Balance {fmtRs(balance)}</b></p>
      <div className="form-grid">
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Amount (₹)"><input type="number" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
        <Field label="Mode">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            {(data.settings.payment_modes || []).map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Reference / note"><input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="UTR / cheque no" /></Field>
      </div>
      <div className="form-actions">
        <button className="btn" onClick={save}>Save Payment</button>
        <button className="btn secondary" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}
