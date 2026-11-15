// Market Price Check: is what we pay above, at or below the market, and who could sell it cheaper?
//
//   status      above if we pay > 5% over the market median, below if > 5% under, else at market
//   overpay     (our price - median) x annual quantity, when we are above the median
//   best alt    the cheapest alternative-vendor quote below our price whose minimum order
//               fits our usual monthly order; savings = (ours - theirs) x annual quantity

export const MARKET_BAND = 0.05;

export interface Quote {
  vendor: string;
  unit_price: number;
  min_qty: number;
  lead_time_days: number;
  terms: string;
}

export interface MarketItem {
  item_key: string;
  item_type: "material" | "part";
  name: string;
  unit: string;
  ourPrice: number;
  annualQty: number;
  suppliers: string[];
  low: number;
  median: number;
  high: number;
  source: string;
  quotes: Quote[];
}

export type MarketStatus = "above" | "at" | "below";

export interface AltOffer extends Quote {
  annualSavings: number;
  pctBelowOurs: number;
  fitsMonthlyOrder: boolean;
}

export interface MarketResult extends MarketItem {
  status: MarketStatus;
  vsMedian: number;
  /** 0..1 position of our price within [low, high], clamped. */
  position: number;
  annualOverpay: number;
  alternatives: AltOffer[];
  best: AltOffer | null;
}

export function checkItem(item: MarketItem): MarketResult {
  const vsMedian = item.median ? item.ourPrice / item.median - 1 : 0;
  const status: MarketStatus = vsMedian > MARKET_BAND ? "above" : vsMedian < -MARKET_BAND ? "below" : "at";
  const span = item.high - item.low;
  const position = span > 0 ? Math.min(1, Math.max(0, (item.ourPrice - item.low) / span)) : 0.5;
  const monthly = item.annualQty / 12;
  const alternatives = item.quotes
    .map((q) => ({
      ...q,
      annualSavings: Math.max(0, (item.ourPrice - q.unit_price) * item.annualQty),
      pctBelowOurs: item.ourPrice ? 1 - q.unit_price / item.ourPrice : 0,
      fitsMonthlyOrder: q.min_qty <= monthly,
    }))
    .sort((a, b) => a.unit_price - b.unit_price);
  const best = alternatives.find((a) => a.unit_price < item.ourPrice && a.fitsMonthlyOrder) ?? null;
  return {
    ...item,
    status,
    vsMedian,
    position,
    annualOverpay: status === "above" ? (item.ourPrice - item.median) * item.annualQty : 0,
    alternatives,
    best,
  };
}

export function checkAll(items: MarketItem[]) {
  const results = items.map(checkItem).sort((a, b) => b.vsMedian - a.vsMedian);
  return {
    results,
    above: results.filter((r) => r.status === "above").length,
    overpay: results.reduce((s, r) => s + r.annualOverpay, 0),
    altSavings: results.reduce((s, r) => s + (r.status === "above" && r.best ? r.best.annualSavings : 0), 0),
  };
}
