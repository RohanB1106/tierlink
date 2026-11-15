import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAll, checkItem, type MarketItem } from "./market.ts";

// The example from the brief: we pay $0.80/oz for aluminum; the market is cheaper.
const aluminum: MarketItem = {
  item_key: "AL", item_type: "material", name: "Aluminum", unit: "oz",
  ourPrice: 0.8, annualQty: 120000, suppliers: ["Supplier A"],
  low: 0.6, median: 0.68, high: 0.78, source: "test",
  quotes: [
    { vendor: "Vendor X", unit_price: 0.66, min_qty: 5000, lead_time_days: 14, terms: "Net 30" },
    { vendor: "Vendor Y", unit_price: 0.62, min_qty: 50000, lead_time_days: 7, terms: "Net 30" }, // min order too big
    { vendor: "Vendor Z", unit_price: 0.85, min_qty: 100, lead_time_days: 5, terms: "Net 30" }, // dearer than us
  ],
};

test("flags a price more than 5% above the market median", () => {
  const r = checkItem(aluminum);
  assert.equal(r.status, "above");
  assert.ok(Math.abs(r.vsMedian - (0.8 / 0.68 - 1)) < 1e-12);
  assert.equal(r.position, 1); // above the top of the range, clamped
  assert.ok(Math.abs(r.annualOverpay - 0.12 * 120000) < 1e-6);
});

test("best alternative is the cheapest quote whose minimum order fits our monthly volume", () => {
  const r = checkItem(aluminum);
  assert.equal(r.best?.vendor, "Vendor X"); // Y is cheaper but needs 50,000/order vs our 10,000/month
  assert.ok(Math.abs(r.best!.annualSavings - (0.8 - 0.66) * 120000) < 1e-6);
  assert.equal(r.alternatives.find((a) => a.vendor === "Vendor Z")!.annualSavings, 0);
});

test("within 5% of the median is at market; well below is below market", () => {
  assert.equal(checkItem({ ...aluminum, ourPrice: 0.7 }).status, "at");
  assert.equal(checkItem({ ...aluminum, ourPrice: 0.6 }).status, "below");
  assert.equal(checkItem({ ...aluminum, ourPrice: 0.6 }).annualOverpay, 0);
});

test("totals only count items above market", () => {
  const s = checkAll([aluminum, { ...aluminum, item_key: "B", ourPrice: 0.6 }]);
  assert.equal(s.above, 1);
  assert.equal(s.results[0].item_key, "AL");
  assert.ok(Math.abs(s.altSavings - (0.8 - 0.66) * 120000) < 1e-6);
});
