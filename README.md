# TierLink

**Connect a manufacturer's BOMs to every supplier receipt, normalize volume price breaks, and show (with evidence a human has approved) how much the company saves by consolidating orders and standardizing parts.**

Kearney PERLab Hackathon · Team Double Trouble · Corporate Track 3 (BOM Cost Linkage) + Track 1 (Rapid Platforming)

## Status

- [x] Synthetic data generator (`scripts/generate_data.py`)
- [x] Answer key for scoring (`scripts/answer_key.py`)
- [x] Database schema + loader (Neon Postgres + pgvector, `db/schema.sql`, `scripts/load_db.mjs`)
- [x] Ingestion Agent: supplier-dialect parser + attribute matcher + SKU-history suggestions (`src/lib/matching`)
- [x] Review Queue with evidence passports and logged approve/reject decisions (`/review`)
- [ ] Receipt Ledger, Price-Break Matrix, Consolidation Simulator
- [ ] True cost per product (incl. spare/warranty)
- [ ] "Ask the Ledger" chatbot
- [ ] Platforming clusters + 3D product-family viewer
- [ ] Pitch deck

## Demo company: Prairie Power Tools (fictional)

| | |
|---|---|
| Products | 6 (PD-12, PD-20, PD-20X drills · AG-45 grinder · CS-65, CS-725 saws) |
| Plants | Peoria, Champaign, Fort Wayne + a Service & Warranty Center |
| Suppliers | 8, each with its own invoice-description "dialect" |
| Parts in BOMs | 82 |
| Purchase lines | 2,635 over 24 months (Nov 2024 – Oct 2026), 211 spare/warranty |
| Total spend | ~$19.9M |

### Generate the data

```bash
python3 scripts/generate_data.py   # writes data/*.csv (deterministic, seed 42)
python3 scripts/answer_key.py      # prints the savings planted in the data
```

No dependencies needed (Python 3.10+ standard library only).

### Files in `data/`

| File | What it is | Who owns it in real life |
|---|---|---|
| `parts.csv` | Engineering part master: part number, category, description, attributes, products used in | Engineering (PLM) |
| `bom.csv` | Product → assembly → part, quantity per unit | Engineering (PLM) |
| `products.csv` | Products, assembling plant, annual volume | Operations |
| `plants.csv`, `suppliers.csv` | Reference data | ERP |
| `price_breaks.csv` | Each supplier's volume tiers per item (min/max units, unit price, pack size) | Procurement contracts |
| `purchases.csv` | **The spend cube.** Every PO line: supplier, *supplier's* description and SKU, UOM, qty, price, order type. **No engineering part number**, which is the real-world problem | Procurement / AP |
| `_ground_truth.csv` | Hidden answer: which part each purchase line really is. **The app must never read this**; it's only for scoring | — |

### Problems planted on purpose

1. **Different identifiers:** invoices say `SCR MACH PAN M3X12 ZINC PLTD 1000PC` or `07-482913 / screw m3x12 zn pk1000`; engineering says `SCR-M3-12-ZN`. Pack sizes (boxes of 1,000) must be normalized to pieces.
2. **Price variance:** 60 parts bought from 2+ suppliers, with spreads up to ~36%.
3. **Split volume:** each plant orders alone and lands in a lower price tier; pooled demand reaches the better tiers. **About $2.0M (10.1%) savings over 24 months.**
4. **Unlinked after-sale spend:** about $330K of spare/warranty orders from the service center with no product link.
5. **Near-duplicates:** 14 L-brackets (3 natural groups) and 10 M3 screw variants, the platforming opportunity.
6. **Vague lines:** 75 invoice lines missing key attributes (e.g. `SCR MACH PAN M3 ZINC PLTD`). These must go to human review, never auto-matched.

## Matching engine

1. **Supplier Dialect Decoder** (`parse.ts`): turns `SCR MACH PAN M3X12 ZINC PLTD 1000PC`, `Machine Screw, Pan Head, M3 x 12mm, Zinc Plated (Box of 1000)` and `07-482913 / screw m3x12 zn pk1000` into the same attributes, and normalizes pack sizes to pieces.
2. **Attribute matcher** (`match.ts`): compares each line with every engineering part in the category. It auto-matches **only** when exactly one part fits every identity attribute. Anything else goes to review.
3. **SKU history**: a vague line whose supplier SKU has repeatedly matched one part gets that part as a *suggestion*, still pending human approval.

Results on the demo data (`npm run match:eval`):

| | |
|---|---|
| Auto-matched | 2,560 / 2,635 lines (97.2%), 95.4% of spend |
| Auto-match precision | 100% (2,560 / 2,560) |
| Review suggestions correct | 100% (67 / 67) |
| Vague lines wrongly auto-matched | 0 |

Caveat: the parser was written for this synthetic data's 8 supplier formats. Real invoices are messier; an LLM fallback for unrecognized formats is planned.

## Database

PostgreSQL on **Neon** (free tier, via the Vercel integration) with the `pgvector` extension.

| Table | Purpose |
|---|---|
| `plants`, `suppliers`, `products` | Reference data |
| `parts`, `bom` | Engineering part master and BOMs (attributes stored as JSON, `embedding` column for vector search) |
| `price_breaks` | Supplier volume tiers |
| `purchases` | The spend cube, with no engineering part number |
| `matches` | One "evidence passport" per purchase line: matched part, confidence, match type (identical / alternative / similar), status (auto / pending / approved / rejected), evidence |
| `match_decisions` | Audit log of every human approve/reject; nothing is overwritten silently |

### Local setup

```bash
npm install
npx vercel link            # link this folder to the Vercel project
npx vercel env pull .env.local   # downloads DATABASE_URL (git-ignored)
npm run db:load            # creates tables and loads data/*.csv (re-runnable)
npm run match              # runs the Ingestion Agent, fills the matches table
npm run dev
```

Other scripts: `npm test` (matcher unit tests), `npm run match:eval` (accuracy vs. answer key), `npm run data:generate` (rebuild CSVs), `npm run data:answer-key` (print planted savings).

## Stack

Next.js 16 + TypeScript + Tailwind · Neon Postgres + pgvector · Vercel · Claude API agents (planned) · fuzzy matching + embeddings (planned) · scikit-learn clustering (planned) · React Three Fiber 3D (planned)
