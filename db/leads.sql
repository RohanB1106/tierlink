-- Savings-review requests from the public site.
-- Lives in its own database (tierlink_leads), NOT the demo database, so the
-- chatbot's read-only SQL tool can never see a customer's contact details.
-- Safe to re-run: never drops data.
create table if not exists leads (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  name         text not null,
  email        text not null,
  company      text not null,
  role         text,
  segment      text,
  plants       text,
  annual_spend text,
  erp          text,
  goals        text[],
  message      text
);
