-- TierLink database schema (PostgreSQL / Neon)
-- Safe to re-run: drops and recreates everything.

create extension if not exists vector;

drop table if exists match_decisions, matches, purchases, price_breaks, bom, parts, products, suppliers, plants cascade;

-- ---------------------------------------------------------------- reference data
create table plants (
  plant_id   text primary key,
  name       text not null,
  state      text
);

create table suppliers (
  supplier_id text primary key,
  name        text not null,
  style       text            -- how this supplier writes invoice descriptions
);

create table products (
  product_id    text primary key,
  name          text not null,
  plant_id      text not null references plants,
  annual_volume integer not null
);

-- ---------------------------------------------------------------- engineering (PLM)
create table parts (
  part_number text primary key,
  category    text not null,
  description text not null,
  attributes  jsonb not null default '{}',
  used_in     text[] not null default '{}',
  embedding   vector(1536)     -- filled later for semantic matching
);

create table bom (
  id          serial primary key,
  product_id  text not null references products,
  assembly    text not null,
  part_number text not null references parts,
  qty_per     numeric not null
);
create index on bom (part_number);

-- ---------------------------------------------------------------- procurement
create table price_breaks (
  id                   serial primary key,
  supplier_id          text not null references suppliers,
  supplier_sku         text not null,
  supplier_description text not null,
  tier                 integer not null,
  min_qty_units        integer not null,
  max_qty_units        integer,          -- null = no upper limit
  unit_price           numeric(12,4) not null,
  pack_size            integer not null,
  valid_from           date not null,
  unique (supplier_id, supplier_sku, tier, valid_from)
);

-- The spend cube. Note: no engineering part number. Linking is the product's job.
create table purchases (
  line_id          text primary key,
  po_number        text not null,
  po_date          date not null,
  plant_id         text not null references plants,
  supplier_id      text not null references suppliers,
  supplier_sku     text not null,
  item_description text not null,
  uom              text not null,     -- EA or PK
  qty              integer not null,  -- in UOM
  price_per_uom    numeric(12,4) not null,
  extended_amount  numeric(14,2) not null,
  order_type       text not null check (order_type in ('PRODUCTION','SPARE','WARRANTY')),
  currency         text not null default 'USD'
);
create index on purchases (supplier_id, supplier_sku);
create index on purchases (po_date);

-- ---------------------------------------------------------------- linking (the "evidence passport")
create table matches (
  line_id     text primary key references purchases on delete cascade,
  part_number text references parts,
  confidence  numeric(4,3) not null default 0,              -- 0..1
  match_type  text not null default 'unmatched'
              check (match_type in ('identical','alternative','similar','unmatched')),
  status      text not null default 'pending'
              check (status in ('auto','pending','approved','rejected')),
  method      text,                                         -- e.g. sku-history, attributes, fuzzy, llm
  evidence    jsonb not null default '{}',                  -- parsed attributes, candidates, reasons
  updated_at  timestamptz not null default now()
);
create index on matches (status);
create index on matches (part_number);

-- Every human decision is logged; nothing is overwritten silently.
create table match_decisions (
  id          serial primary key,
  line_id     text not null references purchases on delete cascade,
  part_number text references parts,
  action      text not null check (action in ('approve','reject','reassign')),
  reason      text,
  actor       text not null default 'reviewer',
  decided_at  timestamptz not null default now()
);
