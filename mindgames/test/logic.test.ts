import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../src/games/close-enough/questions';
import { CE_ROUNDS, dailyQuestions, practiceQuestions, scoreGuess } from '../src/games/close-enough/logic';
import { buildPerceptionSet, makeChallenge, PE_ROUNDS, TEMPLATE_IDS, validateChallenge } from '../src/games/perception/generators';
import { buildOddSet, LEVELS, makePuzzle, OO_ROUNDS, RECIPE_IDS, validatePuzzle, visualKey } from '../src/games/odd-one-out/generator';
import { addDays, dailyNumber, daysBetween, weekStart } from '../src/services/date';
import { computeStreak, longestStreak, type DailyLog } from '../src/daily/daily';
import { applyResult, defaultSave, hydrate } from '../src/app/store';
import { levelInfo } from '../src/app/progression';
import { timedPoints, type GameResult } from '../src/games/types';
import { leaderboard, sampleDailyScore, SAMPLE_PLAYERS } from '../src/leaderboard/service';
import { buildShareText } from '../src/services/share-text';

const days = (n: number, from = '2026-11-01') => Array.from({ length: n }, (_, i) => addDays(from, i));

describe('close enough', () => {
  it('has a clean question bank', () => {
    const ids = new Set(QUESTIONS.map((q) => q.id));
    expect(ids.size).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) {
      expect(Number.isInteger(q.answer) && q.answer > 0, q.id).toBe(true);
      expect(q.text.endsWith('?'), q.id).toBe(true);
      expect((q.tol ?? 0) <= 0.05, q.id).toBe(true);
    }
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(100);
  });

  it('scores by closeness, symmetric in ratio', () => {
    const q = { answer: 206 };
    expect(scoreGuess(206, q).points).toBe(200);
    expect(scoreGuess(206, q).exact).toBe(true);
    const near = scoreGuess(198, q);
    expect(near.points).toBeGreaterThan(160);
    expect(near.points).toBeLessThan(200);
    expect(Math.round(near.accuracy * 1000)).toBe(961);
    expect(scoreGuess(103, q).points).toBe(0);
    expect(scoreGuess(412, q).points).toBe(0);
    expect(scoreGuess(150, q).points).toBe(scoreGuess(Math.round((206 * 206) / 150), q).points);
    let prev = 201;
    for (let g = 206; g <= 420; g += 7) {
      const p = scoreGuess(g, q).points;
      expect(p).toBeLessThanOrEqual(prev);
      prev = p;
    }
  });

  it('handles zero, negative and absurd guesses', () => {
    const q = { answer: 384400 };
    for (const g of [0, -5, NaN, Infinity, 1e15]) {
      const s = scoreGuess(g, q);
      expect(s.points).toBe(0);
      expect(s.accuracy).toBe(0);
    }
  });

  it('honours tolerance', () => {
    expect(scoreGuess(324, { answer: 330, tol: 0.02 }).points).toBe(200);
    expect(scoreGuess(300, { answer: 330, tol: 0.02 }).points).toBeLessThan(200);
  });

  it('gives everyone the same daily five without repeats inside a cycle', () => {
    const seen = new Set<string>();
    const cycle = Math.floor(QUESTIONS.length / CE_ROUNDS);
    for (const day of days(cycle)) {
      const a = dailyQuestions(day);
      expect(a.map((q) => q.id)).toEqual(dailyQuestions(day).map((q) => q.id));
      expect(a.length).toBe(CE_ROUNDS);
      expect(new Set(a.map((q) => q.category)).size).toBeGreaterThanOrEqual(4);
      for (const q of a) {
        expect(seen.has(q.id), `${q.id} repeated on ${day}`).toBe(false);
        seen.add(q.id);
      }
    }
    for (const day of days(400)) expect(dailyQuestions(day).length).toBe(CE_ROUNDS);
  });

  it('builds practice sets that avoid recent questions', () => {
    const first = practiceQuestions('AAAAA');
    expect(new Set(first.map((q) => q.id)).size).toBe(CE_ROUNDS);
    const second = practiceQuestions('AAAAA', first.map((q) => q.id));
    expect(second.some((q) => first.includes(q))).toBe(false);
  });
});

describe('perception', () => {
  it('every template yields a valid, unambiguous challenge across many seeds', () => {
    for (const template of TEMPLATE_IDS)
      for (let i = 0; i < 300; i++) {
        const c = makeChallenge(template, `t${i}`, (i % 6) / 5);
        expect(validateChallenge(c), `${template} #${i}`).toBe(true);
        const n = c.targets?.length ?? c.choices!.length;
        const best = Math.max(...c.measure);
        expect(c.measure.filter((m) => m === best).length, `${template} #${i} unique`).toBe(1);
        expect(c.measure[c.answer]).toBe(best);
        expect(n).toBeGreaterThanOrEqual(2);
        for (const s of c.shapes) if (s.t === 'circle') expect(s.cx - s.r > -1 && s.cx + s.r < 321 && s.cy - s.r > -1 && s.cy + s.r < 321, `${template} #${i} in view`).toBe(true);
      }
  });

  it('tap targets never overlap', () => {
    for (const template of TEMPLATE_IDS)
      for (let i = 0; i < 100; i++) {
        const c = makeChallenge(template, `o${i}`, 0.5);
        const t = c.targets ?? [];
        for (let a = 0; a < t.length; a++)
          for (let b = a + 1; b < t.length; b++) {
            const overlap = t[a].x < t[b].x + t[b].w && t[b].x < t[a].x + t[a].w && t[a].y < t[b].y + t[b].h && t[b].y < t[a].y + t[a].h;
            expect(overlap, `${template} #${i} ${a}/${b}`).toBe(false);
          }
      }
  });

  it('daily sets are deterministic with distinct templates', () => {
    for (const day of days(120)) {
      const a = buildPerceptionSet(day);
      expect(a.length).toBe(PE_ROUNDS);
      expect(new Set(a.map((c) => c.template)).size).toBe(PE_ROUNDS);
      expect(JSON.stringify(a)).toBe(JSON.stringify(buildPerceptionSet(day)));
    }
  });
});

describe('odd one out', () => {
  it('every recipe at every level has exactly one odd cell', () => {
    for (const recipe of RECIPE_IDS)
      for (const level of LEVELS)
        for (let i = 0; i < 60; i++) {
          const p = makePuzzle(recipe, level, `s${i}`);
          expect(validatePuzzle(p), `${recipe} d${level.difficulty} #${i}`).toBe(true);
          const oddKey = visualKey(p.cells[p.answer]);
          expect(p.cells.filter((c) => visualKey(c) === oddKey).length).toBe(1);
        }
  });

  it('daily sets are deterministic, distinct and ramp up', () => {
    for (const day of days(120)) {
      const a = buildOddSet(day);
      expect(a.length).toBe(OO_ROUNDS);
      expect(new Set(a.map((p) => p.recipe)).size).toBe(OO_ROUNDS);
      expect(JSON.stringify(a)).toBe(JSON.stringify(buildOddSet(day)));
      expect(a[0].cells.length).toBeLessThan(a[7].cells.length);
    }
    expect(JSON.stringify(buildOddSet('2026-11-10'))).not.toBe(JSON.stringify(buildOddSet('2026-11-11')));
  });
});

describe('scoring, streaks and progression', () => {
  it('timed points fall from max to 40%', () => {
    expect(timedPoints(125, 0, 10000)).toBe(125);
    expect(timedPoints(125, 1000, 10000)).toBe(125);
    expect(timedPoints(125, 10000, 10000)).toBe(50);
    expect(timedPoints(125, 5600, 10000)).toBeGreaterThan(50);
  });

  it('date helpers', () => {
    expect(dailyNumber('2026-11-01')).toBe(1);
    expect(dailyNumber('2026-11-10')).toBe(10);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(weekStart('2026-11-10')).toBe('2026-11-09');
  });

  const result = (game: GameResult['game'], seed: string, score = 800, mode: GameResult['mode'] = 'daily'): GameResult => ({ game, mode, seed, score, accuracy: 0.8, rounds: [{ points: score, max: 1000, correct: true, accuracy: 0.8 }], playedAt: 1 });

  it('streaks count consecutive days and survive until midnight', () => {
    const log: DailyLog = {};
    for (const d of ['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-09']) log[d] = { results: { perception: result('perception', d) } };
    expect(computeStreak(log, '2026-11-07').current).toBe(3);
    expect(computeStreak(log, '2026-11-08')).toEqual({ current: 3, playedToday: false });
    expect(computeStreak(log, '2026-11-09').current).toBe(1);
    expect(computeStreak(log, '2026-11-11').current).toBe(0);
    expect(longestStreak(log)).toBe(3);
  });

  it('awards XP, daily bonus once, and never overwrites a daily score', () => {
    let data = defaultSave();
    const day = '2026-11-10';
    let r = applyResult(data, result('close-enough', day, 850), day);
    expect(r.rewards.xp).toBe(85);
    expect(r.rewards.streakAfter).toBe(1);
    expect(r.rewards.isBest).toBe(true);
    data = r.next;
    r = applyResult(data, result('perception', day, 920), day);
    data = r.next;
    expect(r.rewards.dailyJustCompleted).toBe(false);
    r = applyResult(data, result('odd-one-out', day, 780), day);
    data = r.next;
    expect(r.rewards.dailyJustCompleted).toBe(true);
    expect(r.rewards.bonusXp).toBe(150);
    expect(r.rewards.dailyTotal).toBe(2550);
    expect(data.xp).toBe(85 + 92 + 78 + 150);
    r = applyResult(data, result('odd-one-out', day, 1000), day);
    expect(r.rewards.bonusXp).toBe(0);
    expect(r.next.daily[day].results['odd-one-out']!.score).toBe(780);
    r = applyResult(data, result('perception', 'ABCDE', 600, 'practice'), day);
    expect(r.rewards.xp).toBe(30);
    expect(Object.keys(r.next.daily)).toEqual([day]);
  });

  it('levels and save hydration', () => {
    expect(levelInfo(0)).toEqual({ level: 1, into: 0, need: 200 });
    expect(levelInfo(200).level).toBe(2);
    expect(levelInfo(200 + 275).level).toBe(3);
    expect(hydrate(null).v).toBe(1);
    expect(hydrate({ v: 1, xp: 40 } as never).settings.haptics).toBe(true);
  });

  it('sample league is deterministic and ranks the player', () => {
    const p = SAMPLE_PLAYERS[0];
    expect(sampleDailyScore(p, '2026-11-10')).toBe(sampleDailyScore(p, '2026-11-10'));
    for (const s of SAMPLE_PLAYERS) expect(sampleDailyScore(s, '2026-11-10')).toBeLessThanOrEqual(3000);
    const you = { name: 'Me', avatar: 0, joined: '2026-11-08', log: { '2026-11-10': { results: { perception: result('perception', '2026-11-10', 3000) } } } as DailyLog, friends: ['s1'] };
    const rows = leaderboard.standings('daily', '2026-11-10', you);
    expect(rows[0].isYou).toBe(true);
    expect(rows.map((x) => x.rank)).toEqual(rows.map((_, i) => i + 1));
    expect(rows.filter((x) => x.isFriend).length).toBe(2);
    expect(leaderboard.standings('all', '2026-11-10', you).length).toBe(SAMPLE_PLAYERS.length + 1);
  });

  it('share text is compact and complete', () => {
    const text = buildShareText('2026-11-10', { 'close-enough': 850, perception: 920, 'odd-one-out': 780 });
    expect(text).toContain('MINDGAMES #10');
    expect(text).toContain('TOTAL');
    expect(text).toContain('2,550');
  });
});
