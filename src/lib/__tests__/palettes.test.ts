import { describe, it, expect } from 'vitest';
import { PRESET_PALETTES, contrastRatio, primaryReadable } from '@/lib/palettes';

describe('color palettes & contrast', () => {
  it('every preset primary is readable with white text (WCAG AA)', () => {
    for (const p of PRESET_PALETTES) {
      expect(primaryReadable(p.primaryColor), p.name).toBe(true);
    }
  });
  it('black on white is maximal contrast', () => {
    expect(contrastRatio('0 0% 0%', '0 0% 100%')).toBeCloseTo(21, 0);
  });
  it('rejects malformed values gracefully', () => {
    expect(contrastRatio('not-a-color', '0 0% 100%')).toBeNull();
  });
  it('flags an unreadable pale primary', () => {
    expect(primaryReadable('60 100% 90%')).toBe(false);
  });
});
