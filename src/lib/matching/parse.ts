// "Supplier Dialect Decoder": turns a free-text invoice description into structured part attributes.
//
// Each supplier writes the same part differently, for example:
//   "SCR MACH PAN M3X12 ZINC PLTD 1000PC"
//   "Machine Screw, Pan Head, M3 x 12mm, Zinc Plated (Box of 1000)"
//   "07-482913 / screw m3x12 zn pk1000"
// All three parse to { category: "screw", attrs: { thread: "M3", length_mm: 12, finish: "ZN" }, packSize: 1000 }.

export type AttrValue = string | number;
export type Attrs = Record<string, AttrValue>;

export interface ParsedDescription {
  category: string | null;
  attrs: Attrs;
  packSize: number;
  /** Which rules fired, kept as evidence for reviewers. */
  rules: string[];
}

// Order matters: "guard" must be checked before "blade" ("lower blade guard").
const CATEGORY_PATTERNS: [string, RegExp][] = [
  ["screw", /\b(scr|screw)\b/],
  ["bolt", /\bbolt\b/],
  ["nut", /\bnut\b/],
  ["washer", /\b(wshr|washer)\b/],
  ["bearing", /\b(brg|bearing)\b/],
  ["spring", /\b(sprg|spring)\b/],
  ["bracket", /\b(brkt|bracket)\b/],
  ["gear", /\bgear\b/],
  ["motor", /\b(mtr|motor)\b/],
  ["battery", /\b(batt|battery)\b/],
  ["switch", /\b(sw|switch)\b/],
  ["pcb", /\b(pcba|pcb)\b/],
  ["cord", /\bcord\b/],
  ["housing", /\b(hsg|housing)\b/],
  ["grip", /\bgrip\b/],
  ["chuck", /\bchuck\b/],
  ["guard", /\bguard\b/],
  ["blade", /\bblade\b/],
];

const n = (s: string) => Number(s.replace(/,/g, ""));

function parseFinish(t: string, out: Attrs) {
  if (/\bzinc\b|\bzn\b/.test(t)) out.finish = "ZN";
  else if (/blk ox|black oxide|\bbo\b/.test(t)) out.finish = "BO";
  else if (/\bsst\b|stainless|\bss\b/.test(t)) out.finish = "SS";
}

function parseThreadLength(t: string, out: Attrs, withLength: boolean) {
  const tl = withLength ? t.match(/\bm(\d+(?:\.\d+)?)\s*x\s*(\d+)/) : null;
  if (tl) {
    out.thread = `M${tl[1]}`;
    out.length_mm = n(tl[2]);
    return;
  }
  const th = t.match(/\bm(\d+(?:\.\d+)?)\b/);
  if (th) out.thread = `M${th[1]}`;
}

function parsePack(t: string): number {
  const m = t.match(/(\d+)\s*pc\b/) || t.match(/box of (\d+)/) || t.match(/\bpk(\d+)\b/);
  return m ? n(m[1]) : 1;
}

export function parseDescription(description: string): ParsedDescription {
  const t = description.toLowerCase();
  const rules: string[] = [];
  const attrs: Attrs = {};

  const hit = CATEGORY_PATTERNS.find(([, re]) => re.test(t));
  const category = hit ? hit[0] : null;
  if (category) rules.push(`category=${category}`);

  const packSize = parsePack(t);
  if (packSize > 1) rules.push(`pack=${packSize}`);

  let m: RegExpMatchArray | null;
  switch (category) {
    case "screw":
    case "bolt":
      parseThreadLength(t, attrs, true);
      parseFinish(t, attrs);
      break;
    case "nut":
    case "washer":
      parseThreadLength(t, attrs, false);
      parseFinish(t, attrs);
      break;
    case "bearing":
      if ((m = t.match(/\b(\d{3,4}(?:zz|-2rs))\b/))) attrs.designation = m[1].toUpperCase();
      break;
    case "spring":
      if ((m = t.match(/wire ([\d.]+)mm, od ([\d.]+)mm, length ([\d.]+)mm/) ||
                t.match(/([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)/))) {
        attrs.wire_mm = n(m[1]);
        attrs.od_mm = n(m[2]);
        attrs.length_mm = n(m[3]);
      }
      break;
    case "bracket":
      if ((m = t.match(/([\d.]+)mm thick, ([\d.]+)mm wide, ([\d.]+)mm hole/) ||
                t.match(/([\d.]+)\s*t\s+([\d.]+)\s*w\s+([\d.]+)\s*h\b/))) {
        attrs.thickness_mm = n(m[1]);
        attrs.width_mm = n(m[2]);
        attrs.hole_mm = n(m[3]);
      }
      break;
    case "gear":
      if ((m = t.match(/\bm([\d.]+)\s+(\d+)t\b/))) {
        attrs.module = n(m[1]);
        attrs.teeth = n(m[2]);
      }
      break;
    case "motor":
      if ((m = t.match(/\b(bldc|brushed|universal)\b/))) attrs.type = m[1] === "bldc" ? "BLDC" : m[1];
      if ((m = t.match(/\b(\d+)v\b/))) attrs.volts = n(m[1]);
      if ((m = t.match(/([\d,]+)\s*rpm/))) attrs.rpm = n(m[1]);
      break;
    case "battery":
      if ((m = t.match(/\b(\d+)v\b/))) attrs.volts = n(m[1]);
      if ((m = t.match(/([\d.]+)\s*ah\b/))) attrs.ah = n(m[1]);
      break;
    case "switch":
      if ((m = t.match(/\b(trigger|paddle)\b/))) attrs.type = m[1];
      if ((m = t.match(/\b(\d+)v\b/))) attrs.volts = n(m[1]);
      break;
    case "pcb":
      if ((m = t.match(/\b(\d+)v\b/))) attrs.volts = n(m[1]);
      break;
    case "cord":
      if ((m = t.match(/(\d+)\s*awg/))) attrs.awg = n(m[1]);
      if ((m = t.match(/(\d+)\s*ft\b/))) attrs.length_ft = n(m[1]);
      break;
    case "housing":
    case "grip":
      if ((m = t.match(/p\/n\s+([a-z]{2}-\d+x?)\b/))) attrs.product = m[1].toUpperCase();
      break;
    case "chuck":
      if ((m = t.match(/\b(3\/8|1\/2)\s*in\b/))) attrs.size_in = m[1] === "3/8" ? 0.375 : 0.5;
      break;
    case "blade":
      if ((m = t.match(/([\d.]+)\s*in\s+(\d+)t\b/))) {
        attrs.dia_in = n(m[1]);
        attrs.teeth = n(m[2]);
      }
      break;
    case "guard":
      if (/\blower\b/.test(t)) attrs.position = "lower";
      else if ((m = t.match(/([\d.]+)\s*in\b/))) {
        attrs.position = "wheel";
        attrs.dia_in = n(m[1]);
      }
      break;
  }

  for (const [k, v] of Object.entries(attrs)) rules.push(`${k}=${v}`);
  return { category, attrs, packSize, rules };
}
