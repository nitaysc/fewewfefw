import { GAME_IDS, GAMES, type GameId } from '../games/types';
import { dailyNumber } from './date';

const nf = new Intl.NumberFormat('en-US');

/** Five-block meter for a 0–1000 score: ▰▰▰▰▱ */
export function meter(score: number, max = 1000): string {
  const filled = Math.max(0, Math.min(5, Math.round((score / max) * 5)));
  return '▰'.repeat(filled) + '▱'.repeat(5 - filled);
}

/** Compact, spoiler-free daily result that reads fine in any chat app. */
export function buildShareText(dateKey: string, scores: Partial<Record<GameId, number>>, streak = 0): string {
  const lines = [`MINDGAMES #${dailyNumber(dateKey)}`, ''];
  let total = 0;
  for (const id of GAME_IDS) {
    const score = scores[id];
    if (score === undefined) continue;
    total += score;
    lines.push(`${meter(score)} ${GAMES[id].title.toUpperCase().padEnd(13)} ${nf.format(score)}`);
  }
  lines.push('', `TOTAL ${nf.format(total)} / ${nf.format(Object.keys(scores).length * 1000)}`);
  if (streak > 1) lines.push(`${streak}-day streak`);
  return lines.join('\n');
}

export function buildGameShareText(game: GameId, score: number, code?: string): string {
  const lines = [`MINDGAMES · ${GAMES[game].title.toUpperCase()}`, `${meter(score)} ${nf.format(score)} / 1,000`];
  if (code) lines.push('', `Think you can beat me? Open MINDGAMES and enter challenge code ${GAMES[game].code}-${code}`);
  return lines.join('\n');
}
