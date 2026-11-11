import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { GAME_IDS, GAMES, type GameId } from '../games/types';
import logoUrl from '../assets/logo-mark.png';
import { dailyNumber, formatLong } from './date';
import { buildGameShareText, buildShareText } from './share-text';

export type SharePayload = { kind: 'daily'; date: string } | { kind: 'game'; game: GameId; score: number; code?: string };

export interface ShareContent {
  title: string;
  text: string;
  heading: string;
  sub: string;
  rows: { label: string; score: number; color: string }[];
  total: number;
  max: number;
  footer: string;
}

const COLORS: Record<GameId, string> = { 'close-enough': '#F4D98B', perception: '#ABA6FF', 'odd-one-out': '#7FD8F0' };
const nf = new Intl.NumberFormat('en-US');

export function shareContent(payload: SharePayload, scores: Partial<Record<GameId, number>>, streak: number, name: string): ShareContent {
  if (payload.kind === 'daily') {
    const rows = GAME_IDS.filter((g) => scores[g] !== undefined).map((g) => ({ label: GAMES[g].title.toUpperCase(), score: scores[g]!, color: COLORS[g] }));
    return {
      title: `MINDGAMES #${dailyNumber(payload.date)}`,
      text: buildShareText(payload.date, scores, streak),
      heading: `DAILY #${dailyNumber(payload.date)}`,
      sub: formatLong(payload.date),
      rows,
      total: rows.reduce((s, r) => s + r.score, 0),
      max: rows.length * 1000,
      footer: streak > 1 ? `${name} · ${streak}-day streak` : name,
    };
  }
  const meta = GAMES[payload.game];
  return {
    title: `MINDGAMES · ${meta.title}`,
    text: buildGameShareText(payload.game, payload.score, payload.code),
    heading: meta.title.toUpperCase(),
    sub: payload.code ? `Challenge code ${meta.code}-${payload.code}` : meta.tagline,
    rows: [{ label: meta.title.toUpperCase(), score: payload.score, color: COLORS[payload.game] }],
    total: payload.score,
    max: 1000,
    footer: payload.code ? `${name} dares you to beat this` : name,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws the branded 1080×1350 score card. */
export async function renderShareCard(c: ShareContent): Promise<HTMLCanvasElement> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  try {
    await Promise.all([document.fonts.load('400 100px "Bebas Neue"'), document.fonts.load('600 40px "Manrope Variable"')]);
  } catch {
    /* fall back to system fonts */
  }
  const display = '"Bebas Neue", "Arial Narrow", sans-serif';
  const body = '"Manrope Variable", system-ui, sans-serif';

  ctx.fillStyle = '#0D0D0F';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 900);
  glow.addColorStop(0, 'rgba(171,166,255,0.16)');
  glow.addColorStop(1, 'rgba(171,166,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 900);
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 2;
  for (let x = 90; x < W; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  try {
    const logo = await loadImage(logoUrl);
    ctx.drawImage(logo, 80, 80, 84, 84);
  } catch {
    /* logo is decorative */
  }
  ctx.textBaseline = 'alphabetic';
  ctx.font = `400 76px ${display}`;
  ctx.fillStyle = '#F3F3F6';
  ctx.fillText('MIND', 190, 152);
  const mindW = ctx.measureText('MIND').width;
  ctx.fillStyle = '#BDF26D';
  ctx.fillText('GAMES', 190 + mindW + 4, 152);

  ctx.fillStyle = '#F3F3F6';
  ctx.font = `400 150px ${display}`;
  ctx.fillText(c.heading, 80, 380);
  ctx.fillStyle = '#A8A8B3';
  ctx.font = `600 40px ${body}`;
  ctx.fillText(c.sub, 82, 444);

  let y = 500;
  for (const row of c.rows) {
    ctx.fillStyle = '#17171B';
    roundRect(ctx, 80, y, W - 160, 150, 36);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.stroke();
    ctx.fillStyle = row.color;
    ctx.beginPath();
    ctx.arc(140, y + 75, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F3F3F6';
    ctx.font = `400 60px ${display}`;
    ctx.textAlign = 'left';
    ctx.fillText(row.label, 180, y + 68);
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    roundRect(ctx, 180, y + 96, 520, 14, 7);
    ctx.fill();
    ctx.fillStyle = row.color;
    roundRect(ctx, 180, y + 96, Math.max(14, 520 * (row.score / 1000)), 14, 7);
    ctx.fill();
    ctx.fillStyle = '#F3F3F6';
    ctx.font = `400 92px ${display}`;
    ctx.textAlign = 'right';
    ctx.fillText(nf.format(row.score), W - 124, y + 108);
    ctx.textAlign = 'left';
    y += 174;
  }

  if (c.rows.length > 1) {
    y += 16;
    ctx.fillStyle = '#6C6C78';
    ctx.font = `700 34px ${body}`;
    ctx.fillText('TOTAL', 84, y + 30);
    ctx.fillStyle = '#BDF26D';
    ctx.font = `400 150px ${display}`;
    ctx.fillText(nf.format(c.total), 80, y + 162);
    const tw = ctx.measureText(nf.format(c.total)).width;
    ctx.fillStyle = '#6C6C78';
    ctx.font = `400 70px ${display}`;
    ctx.fillText(`/ ${nf.format(c.max)}`, 80 + tw + 24, y + 162);
  }

  ctx.fillStyle = '#BDF26D';
  ctx.fillRect(80, H - 112, W - 160, 5);
  ctx.fillStyle = '#A8A8B3';
  ctx.font = `600 36px ${body}`;
  ctx.fillText(c.footer, 80, H - 52);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#6C6C78';
  ctx.fillText('Three games. Every day.', W - 80, H - 52);
  ctx.textAlign = 'left';
  return canvas;
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Share the card image plus text through the system share sheet; falls back to copying the text. */
export async function shareCard(content: ShareContent, canvas: HTMLCanvasElement | null): Promise<ShareOutcome> {
  try {
    if (Capacitor.isNativePlatform()) {
      let files: string[] | undefined;
      if (canvas) {
        const data = canvas.toDataURL('image/png').split(',')[1];
        const file = await Filesystem.writeFile({ path: 'mindgames-result.png', data, directory: Directory.Cache });
        files = [file.uri];
      }
      await Share.share({ title: content.title, text: content.text, files, dialogTitle: 'Share your result' });
      return 'shared';
    }
    if (navigator.share) {
      const blob = canvas ? await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png')) : null;
      const file = blob ? new File([blob], 'mindgames-result.png', { type: 'image/png' }) : null;
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ title: content.title, text: content.text, files: [file] });
      else await navigator.share({ title: content.title, text: content.text });
      return 'shared';
    }
  } catch (err) {
    const message = String((err as Error)?.message ?? err).toLowerCase();
    if (message.includes('cancel') || message.includes('abort')) return 'cancelled';
  }
  return (await copyText(content.text)) ? 'copied' : 'failed';
}
