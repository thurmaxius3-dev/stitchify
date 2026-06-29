/**
 * wrappedRenderer.ts — renders a "Stitching Wrapped" card to a canvas.
 *
 * Output: 1080×1920 px (portrait, Instagram Story friendly)
 * Returns a data URL.
 */

import type { WrappedStats } from './wrappedStats';

const W = 1080;
const H = 1920;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function statCard(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  value: string,
  label: string,
  accent: string
) {
  // Card bg
  ctx.save();
  roundRect(ctx, x, y, w, h, 32);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();

  // Accent top strip
  roundRect(ctx, x, y, w, 8, 4);
  ctx.fillStyle = accent;
  ctx.fill();

  // Value
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.min(96, Math.floor(w * 0.22))}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x + w / 2, y + h * 0.42, w - 40);

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = `${Math.floor(w * 0.065)}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(label, x + w / 2, y + h * 0.72, w - 40);
  ctx.restore();
}

export function renderWrappedCard(stats: WrappedStats): string {
  const cvs = document.createElement('canvas');
  cvs.width  = W;
  cvs.height = H;
  const ctx = cvs.getContext('2d')!;

  // ── Background gradient ──────────────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, W * 0.6, H);
  grad.addColorStop(0,   '#1a0533');
  grad.addColorStop(0.4, '#2d1057');
  grad.addColorStop(1,   '#0f2a4a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle dot pattern
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let row = 0; row < H; row += 60) {
    for (let col = 0; col < W; col += 60) {
      ctx.beginPath();
      ctx.arc(col, row, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Branding ─────────────────────────────────────────────────────────────
  const PAD = 80;
  let y = 120;

  // × × × × logo dots
  const dotColors = ['#fbbf24', '#60a5fa', '#34d399', '#f97316'];
  dotColors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.font = `bold 64px system-ui`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('×', PAD + i * 56, y);
  });

  y += 90;
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 72px Georgia, serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Stitchify', PAD, y);

  y += 90;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `36px system-ui`;
  ctx.fillText(`${stats.year} Wrapped`, PAD, y);

  // Divider
  y += 70;
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();

  // ── Hero stat ────────────────────────────────────────────────────────────
  y += 80;
  const heroNum = stats.totalStitchesDone.toLocaleString();
  ctx.fillStyle = '#ffffff';
  const heroSize = heroNum.length > 7 ? 140 : heroNum.length > 4 ? 180 : 220;
  ctx.font = `bold ${heroSize}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(heroNum, W / 2, y);

  y += heroSize + 20;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `42px system-ui`;
  ctx.fillText('total stitches marked', W / 2, y);

  // ── Stat grid (2×2) ──────────────────────────────────────────────────────
  y += 110;
  const CARD_W = (W - PAD * 2 - 24) / 2;
  const CARD_H = 260;
  const accents = ['#f97316', '#8b5cf6', '#06b6d4', '#22c55e'];

  const cards = [
    { value: `${stats.currentStreak}d`, label: 'Current streak' },
    { value: `${stats.bestStreak}d`,    label: 'Best streak ever' },
    { value: String(stats.projectCount),  label: 'Projects saved' },
    { value: String(stats.completedProjects || '—'), label: 'Finished' },
  ];

  cards.forEach((card, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = PAD + col * (CARD_W + 24);
    const cy = y + row * (CARD_H + 20);
    statCard(ctx, cx, cy, CARD_W, CARD_H, card.value, card.label, accents[i]);
  });

  y += (CARD_H + 20) * 2 + 40;

  // ── Top colors ───────────────────────────────────────────────────────────
  if (stats.topColors.length > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `36px system-ui`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Most used colors', PAD, y);
    y += 56;

    const swatchSize = 80;
    const swatchGap  = 20;
    stats.topColors.slice(0, 5).forEach((color, i) => {
      const cx = PAD + i * (swatchSize + swatchGap);
      roundRect(ctx, cx, y, swatchSize, swatchSize, 16);
      ctx.fillStyle = color.hex;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // DMC code below
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = `24px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(color.code, cx + swatchSize / 2, y + swatchSize + 10);
    });

    y += swatchSize + 60;
  }

  // ── Project name ─────────────────────────────────────────────────────────
  if (stats.projectName && stats.patternSize) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = `32px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const label = `"${stats.projectName}"  ·  ${stats.patternSize} stitches`;
    ctx.fillText(label, W / 2, y, W - PAD * 2);
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = `30px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('stitchify.app', W / 2, H - 60);

  return cvs.toDataURL('image/png');
}
