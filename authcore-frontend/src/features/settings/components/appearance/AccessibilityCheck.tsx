import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui';

import { SettingCard } from './AppearanceParts';

const PAIRS = [
  { label: 'Body text on surface', fg: '--foreground', bg: '--surface' },
  { label: 'Muted text on surface', fg: '--muted-foreground', bg: '--surface' },
  { label: 'Accent text on surface', fg: '--primary', bg: '--surface' },
  { label: 'Button label on accent', fg: '--primary-foreground', bg: '--primary' },
] as const;

/** WCAG relative luminance of an sRGB color. */
function luminance(rgb: number[]): number {
  const [r = 0, g = 0, b = 0] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast of the colors actually rendered now (any preset, mode, custom color). */
function measure(): number[] {
  const probe = document.createElement('span');
  document.body.appendChild(probe);
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const toRgb = (token: string): number[] => {
    probe.style.color = `var(${token})`;
    const css = getComputedStyle(probe).color;
    if (!ctx) return [0, 0, 0];
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  const ratios = PAIRS.map(({ fg, bg }) => {
    const [hi, lo] = [luminance(toRgb(fg)), luminance(toRgb(bg))].toSorted((x, y) => y - x) as [
      number,
      number,
    ];
    return (hi + 0.05) / (lo + 0.05);
  });
  probe.remove();
  return ratios;
}

const grade = (ratio: number) =>
  ratio >= 7
    ? { label: 'AAA', tone: 'success' as const }
    : ratio >= 4.5
      ? { label: 'AA', tone: 'success' as const }
      : { label: 'Fail', tone: 'danger' as const };

export function AccessibilityCheck() {
  const [ratios, setRatios] = useState<number[] | null>(null);

  // Re-measure whenever the theme changes <html> (preset, mode, contrast, custom color …).
  useEffect(() => {
    let frame = requestAnimationFrame(() => setRatios(measure()));
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRatios(measure()));
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const passing = ratios?.filter((r) => r >= 4.5).length ?? 0;
  return (
    <SettingCard
      title="Accessibility check"
      description="Live contrast ratios for your current colors."
      badge={ratios ? `${passing}/${PAIRS.length} pass AA` : '…'}
    >
      <ul className="divide-y divide-border">
        {PAIRS.map((pair, i) => {
          const ratio = ratios?.[i];
          const g = ratio === undefined ? null : grade(ratio);
          return (
            <li key={pair.label} className="flex items-center gap-3 py-2.5">
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-sm font-semibold"
                style={{ color: `var(${pair.fg})`, background: `var(${pair.bg})` }}
              >
                Aa
              </span>
              <span className="min-w-0 flex-1 text-sm text-foreground">{pair.label}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {ratio === undefined ? '…' : `${ratio.toFixed(1)}:1`}
              </span>
              {g && (
                <Badge size="sm" tone={g.tone}>
                  {g.label}
                </Badge>
              )}
            </li>
          );
        })}
      </ul>
    </SettingCard>
  );
}
