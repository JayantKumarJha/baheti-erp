# Baheti ERP — Aluminium Recovery

A web ERP for an aluminium scrap-to-ingot plant: **Purchase Order → Container → Gate Entry → GRN → Production (TRF / Skelner, Electrical Furnaces) → Inventory → Sales → Payments & Party Ledger → Reports**.

Built with React + Vite, hosted on **Vercel**, code on **GitHub**, data in **Supabase** (a free hosted PostgreSQL database).

---

## Where is the data stored?

```
  Browser (any PC / phone)  ──►  Vercel (hosts the app files)
            │
            └──────────────►  Supabase PostgreSQL database  ◄── all your data lives here
```

* **Vercel** only serves the app screens. It stores no business data.
* **GitHub** only stores the source code.
* **Supabase** stores every PO, container, gate entry, GRN, batch, store entry, sale and payment in proper database tables. You can view/edit/export them anytime in Supabase → **Table Editor**.

| Table | What it holds |
|---|---|
| `purchase_orders` | PO No, vendor, scrap type, qty, rate, open/closed |
| `containers` | Containers assigned to each PO + status (pending / in yard / received) |
| `gate_entries` | Gate No, date/time, vehicle, weighbridge gross/tare |
| `grns` | GRN No, weight received, rate, amount, paid amount |
| `production_batches` | Batch No, division/unit, scrap charged, skelner additions, times, output, recovery % |
| `store_transactions` | Store In / Out with slip numbers |
| `sales` | Invoice No, customer, grade, weight, rate, amount, received amount |
| `payments` | Every payment made to vendors / received from customers |
| `settings` | Scrap types, ingot grades, divisions & units, payment modes, company name |

Document numbers (PO-0001, GN-0001, GRN-0001, INV-0001, batch #) are generated **by the database**, so two people saving at the same time never get the same number.

> **No Supabase keys yet?** The app still runs in *Local demo mode* and saves into the browser only. A yellow banner tells you when you're in this mode.

---

## Setup (about 15 minutes, all free)

### Step 1 — Create the database (Supabase)

1. Go to **https://supabase.com** → *Start your project* → sign in with GitHub.
2. **New project** → name it `baheti-erp`, set a database password (save it), choose region **Mumbai (ap-south-1)** → *Create*.
3. When the project is ready, open **SQL Editor** → **New query**.
4. Open the file `supabase/schema.sql` from this folder, copy everything, paste it in, click **Run**. You should see *Success*.
5. Go to **Project Settings → API** (or *Data API*) and copy:
   * **Project URL** — e.g. `https://abcd1234.supabase.co`
   * **anon / public key** — a long text starting with `eyJ…` (or `sb_publishable_…`)

### Step 2 — Put the code on GitHub

**Option A — website only (no commands):**
1. Go to **https://github.com/new** → repository name `baheti-erp` → *Private* → *Create repository*.
2. Click **uploading an existing file**, drag in **all files and folders from this project** (not the `node_modules` or `dist` folders, if present) → *Commit changes*.

**Option B — with Git:**
```bash
cd baheti-erp
git init
git add .
git commit -m "Baheti ERP"
git branch -M main
git remote add origin https://github.com/<your-username>/baheti-erp.git
git push -u origin main
```

### Step 3 — Deploy on Vercel

1. Go to **https://vercel.com** → sign in with GitHub → **Add New… → Project**.
2. **Import** the `baheti-erp` repository. Vercel detects *Vite* automatically.
3. Open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Project URL from Step 1 |
   | `VITE_SUPABASE_ANON_KEY` | your anon/public key from Step 1 |

4. Click **Deploy**. In ~1 minute you get a link like `https://baheti-erp.vercel.app`.
5. Open it — the sidebar footer should show a green dot **“Cloud database (Supabase)”**.

From now on, every time you push a change to GitHub, Vercel redeploys automatically.

> If you add or change environment variables later, go to Vercel → *Deployments* → **Redeploy** so they take effect.

---

## Run on your own computer (optional)

Requires Node.js 20+.
```bash
npm install
cp .env.example .env.local     # then paste your Supabase URL + key into .env.local
npm run dev                    # opens http://localhost:5173
```
Leave `.env.local` empty to try the app in Local demo mode.

---

## Modules

| Module | What it does |
|---|---|
| **Dashboard** | Raw scrap & ingot stock, recovery yield, payables, receivables, open POs, containers in yard, today's output, recent activity |
| **Purchase Orders** | Book PO vendor-wise; add one or many containers; track ordered / received / pending; close or re-open a PO |
| **Gate Entry** | Log container arrival against PO (date, time, vehicle, weighbridge gross/tare) |
| **GRN** | Receive goods against a gate entry; rate auto-filled from PO; weight auto-filled from weighbridge; pay vendor |
| **Production** | Log heats division-wise. TRF has a second **Skelner** stage with alloy additions; multiple scrap types per heat; auto charge total, recovery %, process duration; stock warning; division/unit performance |
| **Store In / Out** | Consumables (flux, diesel, crucibles…) against slip numbers, with live balances |
| **Sales** | Ingot sales with stock check; receive payments |
| **Inventory** | Scrap and ingot stock with in/out breakdown |
| **Party Ledger** | Vendor & customer balances; click a party for a running statement and to pay/receive |
| **Payments** | Register of every payment in and out |
| **Reports** | Monthly volume & value, recovery by grade/division, top vendors/customers, avg buy/sell rate; date filter |
| **Settings & Backup** | Edit scrap types, grades, divisions & units, payment modes, company name; download a full JSON backup |

Every table has **search**, **date filter**, **totals** and **Export CSV** (opens in Excel). Records can be deleted safely — e.g. deleting a GRN puts the container back “In Yard” and removes its payments.

---

## Backups

* **Settings & Backup → Download full backup** saves everything as one JSON file. Do this weekly.
* Each page's **Export CSV** gives Excel-ready sheets.
* Supabase's paid plan adds automatic daily backups and point-in-time restore.
* Note: Supabase **pauses free projects after 7 days with no activity**. Daily use keeps it awake; if paused, click *Restore* in the Supabase dashboard (no data is lost).

## Security note

As requested, the app has **no login**: anyone who has the Vercel link can view and edit data. Keep the link private. If you later want logins, enable *Supabase Auth* and change the policies at the bottom of `supabase/schema.sql` from `using (true)` to `using (auth.role() = 'authenticated')`. Vercel also offers password protection for deployments on its Pro plan.

## Project structure

```
baheti-erp/
├─ supabase/schema.sql      ← run once in Supabase SQL editor
├─ src/
│  ├─ lib/db.js             ← all database reads/writes (Supabase or local)
│  ├─ lib/derived.js        ← stock, recovery, payable/receivable calculations
│  ├─ lib/constants.js      ← default masters, menu
│  ├─ pages/*.jsx           ← one file per module
│  ├─ components/           ← tables, forms, payment dialog
│  └─ styles.css            ← Gemba Concepts green / blue / white theme
├─ .env.example             ← the two Supabase variables
├─ vercel.json
└─ package.json
```

### Theme colours (from gembaconcepts.com)
Green `#3D9958` · Dark green `#2F7A45` · Sky blue `#59BAE9` · Teal `#089BB9` · Deep gradient `#10685A → #305A6D` · White backgrounds.
