/**
 * Curated, WCAG-AA-safe color palettes (HSL triplets matching the theme
 * variable format) so a tenant admin can restyle the whole system with one
 * click and can't accidentally produce unreadable contrast.
 */
export type Palette = {
  id: string;
  name: string;
  primaryColor: string;
  backgroundColor: string;
  accentColor: string;
};

export const PRESET_PALETTES: Palette[] = [
  { id: 'indigo',   name: 'Indigo (default)', primaryColor: '231 48% 48%', backgroundColor: '220 17% 95%', accentColor: '187 100% 15%' },
  { id: 'emerald',  name: 'Emerald',          primaryColor: '152 60% 30%', backgroundColor: '150 20% 96%', accentColor: '160 84% 15%' },
  { id: 'crimson',  name: 'Crimson',          primaryColor: '347 77% 40%', backgroundColor: '350 20% 97%', accentColor: '347 60% 20%' },
  { id: 'ocean',    name: 'Ocean',            primaryColor: '201 96% 32%', backgroundColor: '204 30% 96%', accentColor: '199 89% 18%' },
  { id: 'amber',    name: 'Amber',            primaryColor: '32 95% 34%',  backgroundColor: '40 30% 96%',  accentColor: '26 90% 20%' },
  { id: 'violet',   name: 'Violet',           primaryColor: '262 52% 47%', backgroundColor: '260 20% 96%', accentColor: '262 45% 22%' },
  { id: 'slate',    name: 'Slate (neutral)',  primaryColor: '215 25% 27%', backgroundColor: '210 20% 96%', accentColor: '215 30% 16%' },
  { id: 'rose',     name: 'Rose',             primaryColor: '336 74% 41%', backgroundColor: '330 20% 97%', accentColor: '336 55% 20%' },
  { id: 'teal',     name: 'Teal',             primaryColor: '174 72% 30%', backgroundColor: '180 25% 96%', accentColor: '174 60% 16%' },
  { id: 'sunset',   name: 'Sunset',           primaryColor: '14 85% 43%',  backgroundColor: '20 35% 97%',  accentColor: '340 70% 32%' },
  { id: 'grape',    name: 'Grape',            primaryColor: '291 64% 42%', backgroundColor: '290 25% 97%', accentColor: '291 55% 22%' },
  { id: 'forest',   name: 'Forest',          primaryColor: '142 71% 29%', backgroundColor: '140 25% 96%', accentColor: '142 60% 15%' },
];

/** Parse an "H S% L%" triplet; returns null if malformed. */
function parseHsl(v: string): { h: number; s: number; l: number } | null {
  const m = v.trim().match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!m) return null;
  return { h: +m[1], s: +m[2], l: +m[3] };
}

function hslToLuminance(h: number, s: number, l: number): number {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(0) + 0.7152 * f(8) + 0.0722 * f(4);
}

/** WCAG contrast ratio between two theme HSL triplets (1–21). */
export function contrastRatio(hslA: string, hslB: string): number | null {
  const a = parseHsl(hslA);
  const b = parseHsl(hslB);
  if (!a || !b) return null;
  const la = hslToLuminance(a.h, a.s, a.l);
  const lb = hslToLuminance(b.h, b.s, b.l);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** True when white text on this color meets WCAG AA for normal text (≥4.5). */
export function primaryReadable(primary: string): boolean {
  const ratio = contrastRatio(primary, '0 0% 100%');
  return ratio === null ? true : ratio >= 4.5;
}
