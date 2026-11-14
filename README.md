# TierLink

**Connect a manufacturer's BOMs to every supplier receipt, normalize volume price breaks, and show (with evidence a human has approved) how much the company saves by consolidating orders and standardizing parts.**

Kearney PERLab Hackathon · Team Double Trouble · Corporate Track 3 (BOM Cost Linkage) + Track 1 (Rapid Platforming)

## Status

- [x] Synthetic data generator (`scripts/generate_data.py`)
- [x] Answer key for scoring (`scripts/answer_key.py`)
- [ ] Database schema + Ingestion Agent (matching, confidence, review queue)
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

## Planned stack

Next.js + TypeScript + Tailwind · FastAPI · PostgreSQL (Supabase) + pgvector · Claude API agents · rapidfuzz + embeddings · scikit-learn · React Three Fiber (3D) · Vercel / Render
