# TierLink

**Connect a manufacturer's BOMs to every supplier receipt, normalize volume price breaks, and show (with evidence a human has approved) how much the company saves by consolidating orders and standardizing parts.**

Kearney PERLab Hackathon · Team Double Trouble · Corporate Track 3 (BOM Cost Linkage) + Track 1 (Rapid Platforming)

## Status

- [x] Synthetic data generator (`scripts/generate_data.py`)
- [x] Answer key for scoring (`scripts/answer_key.py`)
- [x] Database schema + loader (Neon Postgres + pgvector, `db/schema.sql`, `scripts/load_db.mjs`)
- [x] Ingestion Agent: supplier-dialect parser + attribute matcher + SKU-history suggestions (`src/lib/matching`)
- [x] Review Queue with evidence passports and logged approve/reject decisions (`/review`)
- [x] Consolidation Simulator (`/consolidation`), Price-Break Matrix and Receipt Ledger (`/parts/[part]`)
- [x] Price lists decoded too (`catalog_matches`), so quoted-but-never-bought SKUs can be compared
- [x] True Cost per Product (`/products`, `/products/[id]`)
- [x] Platforming: near-duplicate groups, shared-parts matrix and 3D product-family viewer (`/platform`)
- [x] Ask the Ledger chatbot (`/ask`), Claude with read-only data tools
- [x] Market Price Check (`/market`): our price vs. market range, alternative vendors and savings
- [x] Dashboard home page with live figures
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

## Consolidation Simulator

Each plant orders on its own, so each lands in a low volume tier. The simulator pools monthly demand across selected plants and prices it at the best tier reachable, either with a current supplier or any supplier that quotes the part (`src/lib/pricing/consolidation.ts`).

To keep the claim defensible:
- Demand = the last 12 months of **confidently matched** production purchases (pending review lines are excluded).
- Today's orders and the pooled orders are priced from the **same supplier price lists**, and that % difference is applied to actual spend.

| Demo data, all 3 plants | Savings / yr |
|---|---|
| Pool orders, keep a current supplier | ~$743K (8.0%) |
| Pool orders + best-priced supplier | ~$837K (9.0%) |
| Peoria alone (no one to pool with) | $0 from pooling |

## True Cost per Product

Per unit of each product, last 12 months (`src/lib/pricing/true-cost.ts`):

- **Quoted BOM**: BOM qty × each part's price-list price at the plant's usual order size.
- **Actual material**: BOM qty × the average price per piece that plant actually paid (confident matches only).
- **Spare & warranty**: service-center spend on each part, split across every product that uses it by consumption (annual volume × qty per unit).
- **After pooling**: true cost minus the part's consolidation saving, split the same way.

On the demo data every product really costs **5–8% more than quoted** (~$562K/yr in total), spare/warranty adds ~$154K/yr, and the modeled material cost reproduces actual production spend within 0.4%.

## Platforming (Track 1)

`src/lib/pricing/platforming.ts` groups near-duplicate parts with complete linkage: brackets/springs when every dimension is within 10%, fasteners when only the finish differs. The most-used part is proposed as the standard; every group is flagged for engineering sign-off. Its price saving is the *extra* gain from merging volume onto one part, beyond consolidating each variant separately, so nothing is double counted.

On the demo data: **82 → 66 part numbers** (the 14 planted brackets fall into exactly their 3 groups; M3 screws group by finish only), ~$72.6K/yr extra price savings.

The 3D viewer (`src/app/platform/viewer.tsx`, React Three Fiber) draws each product from simple solids, one per BOM assembly, colored by whether the assembly is mostly shared parts (core) or product-specific (module). It has an exploded view and click-through to parts.

## Market Price Check

`/market` compares what we pay (last 3 months, weighted) for raw materials (aluminum per oz, steel, copper and resins per lb) and the 18 highest-spend parts with a market price range (`src/lib/pricing/market.ts`):

- **Above market** when we pay more than 5% over the market median; below when more than 5% under.
- **Best alternative**: the cheapest vendor quote below our price whose minimum order fits our usual monthly volume; savings = price gap × annual quantity.

Demo result: 13 of 23 items above market, ~$601K/yr available from alternative vendors (e.g. aluminum 6061 at $0.31/oz vs. a $0.26 median; Ridgeline Supply quotes $0.229). Market ranges and quotes come from `scripts/generate_market.py` and are **illustrative**; in production they would come from commodity indexes and distributor feeds.

## Ask the Ledger (AI assistant)

`/ask` is a chat over the live data, powered by Claude (`claude-opus-5-5`, Anthropic TypeScript SDK) with a streaming tool-use loop (`src/app/api/chat/route.ts`). Claude answers by calling read-only tools (`src/lib/chat/tools.ts`):

| Tool | What it does |
|---|---|
| `get_consolidation_savings` | Runs the same simulator as `/consolidation` (plants, supplier switch) |
| `get_product_costs` | True cost per product, optionally part-by-part |
| `get_part_details` | Price tiers, spend and receipts for one part |
| `get_platform_candidates` | Standardization groups and commonality |
| `run_sql` | One `SELECT` for anything else, run in a **read-only transaction** with a 5 s timeout and 100-row cap |

The UI shows each lookup the assistant ran (including its SQL), so answers are auditable. Refusals fall back to another model automatically (server-side `fallbacks: "default"`).

Needs `ANTHROPIC_API_KEY` (Vercel → Settings → Environment Variables, or `.env.local`). Without it, `/ask` shows setup instructions and `/api/chat` returns 503.

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
