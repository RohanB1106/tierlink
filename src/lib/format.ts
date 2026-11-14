export const money = (v: number, digits = 0) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });

/** $1.2M / $340K / $950 */
export const moneyShort = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e6) return `$${(v / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(a >= 1e5 ? 0 : 1)}K`;
  return money(v);
};

export const unitPrice = (v: number) => money(v, v < 1 ? 4 : 2);
export const num = (v: number) => Math.round(v).toLocaleString("en-US");
export const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
export const partHref = (pn: string) => `/parts/${pn}`;
