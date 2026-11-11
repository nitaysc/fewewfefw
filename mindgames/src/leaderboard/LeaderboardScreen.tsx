import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useStore } from '../app/store';
import { Icon } from '../components/Icon';
import { Avatar, Pill, Segmented } from '../components/ui';
import { haptic } from '../services/haptics';
import { leaderboard, type LeaderboardEntry, type Period } from './service';

const nf = new Intl.NumberFormat('en-US');
type Scope = 'all' | 'friends';

const PERIOD_NOTE: Record<Period, string> = { daily: "Today's daily score", weekly: 'Daily scores since Monday', all: 'Daily scores since you joined' };

export function LeaderboardScreen() {
  const { data, derived, update } = useStore();
  const [period, setPeriod] = useState<Period>('daily');
  const [scope, setScope] = useState<Scope>('all');

  const rows = useMemo(() => {
    const all = leaderboard.standings(period, derived.today, { name: data.profile.name, avatar: data.profile.avatar, joined: data.profile.joined, log: data.daily, friends: data.friends });
    const list = scope === 'friends' ? all.filter((r) => r.isFriend) : all;
    return list.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [period, scope, derived.today, data.profile, data.daily, data.friends]);

  const you = rows.find((r) => r.isYou)!;

  // the pinned "your position" bar only shows while your own row is scrolled out of view
  const ownRow = useRef<HTMLDivElement>(null);
  const [ownVisible, setOwnVisible] = useState(true);
  useEffect(() => {
    const el = ownRow.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setOwnVisible(e.isIntersecting), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [period, scope, you.rank]);
  const podium = rows.slice(0, 3);
  const friendsEmpty = scope === 'friends' && rows.length <= 1;

  const toggleFriend = (id: string) => {
    haptic.tap();
    update((d) => ({ ...d, friends: d.friends.includes(id) ? d.friends.filter((f) => f !== id) : [...d.friends, id] }));
  };

  const row = (r: LeaderboardEntry, i: number) => (
    <div key={r.id} ref={r.isYou ? ownRow : undefined} className={`lb-row rise ${r.isYou ? 'you' : ''}`} style={{ '--i': Math.min(i, 10) } as CSSProperties}>
      <span className="lb-rank display tnum">{r.rank}</span>
      <Avatar index={r.avatar} size={38} />
      <div className="stack grow">
        <b className="lb-name">
          {r.name}
          {r.isYou && <span className="lb-you">You</span>}
        </b>
        <span className="small muted tnum">{period === 'daily' ? (r.today ? 'Played today' : 'Not played yet') : `Today ${nf.format(r.today)}`}</span>
      </div>
      <span className="display d-sm tnum">{nf.format(r.score)}</span>
      {!r.isYou && (
        <button type="button" className={`lb-friend ${r.isFriend ? 'on' : ''}`} onClick={() => toggleFriend(r.id)} aria-label={r.isFriend ? `Remove ${r.name} from friends` : `Add ${r.name} as a friend`}>
          <Icon name={r.isFriend ? 'check' : 'plus'} size={16} />
        </button>
      )}
    </div>
  );

  return (
    <div className="screen">
      <header className="row between page-head">
        <div className="stack">
          <span className="eyebrow">{PERIOD_NOTE[period]}</span>
          <h1 className="display d-lg">Leaderboard</h1>
        </div>
        <Pill tone="accent">Sample league</Pill>
      </header>

      <div className="stack gap-3">
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[
            { id: 'daily', label: 'Daily' },
            { id: 'weekly', label: 'Weekly' },
            { id: 'all', label: 'All time' },
          ]}
        />
        <div className="row gap-2">
          {(['all', 'friends'] as Scope[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`chip ${scope === s ? 'on' : ''}`}
              onClick={() => {
                haptic.tap();
                setScope(s);
              }}
            >
              <Icon name={s === 'all' ? 'trophy' : 'users'} size={15} />
              {s === 'all' ? 'Everyone' : `Friends${data.friends.length ? ` · ${data.friends.length}` : ''}`}
            </button>
          ))}
        </div>
      </div>

      {!friendsEmpty && podium.length === 3 && (
        <div key={`${period}${scope}`} className="podium">
          {[podium[1], podium[0], podium[2]].map((p) => (
            <div key={p.id} className={`podium-col p${p.rank} ${p.isYou ? 'you' : ''}`}>
              <Avatar index={p.avatar} size={p.rank === 1 ? 60 : 48} ring={p.isYou} />
              <b className="small lb-name">{p.isYou ? 'You' : p.name}</b>
              <span className="display d-sm tnum">{nf.format(p.score)}</span>
              <div className="podium-block">
                <span className="display">{p.rank}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {friendsEmpty ? (
        <div className="card empty">
          <Icon name="users" size={30} />
          <b>No friends added yet</b>
          <p className="small muted">Switch to Everyone and tap + next to a sample player to follow them here. Real friends arrive with online play.</p>
        </div>
      ) : (
        <div key={`l${period}${scope}`} className="card card-tight lb-list">
          {rows.map(row)}
        </div>
      )}

      {!friendsEmpty && !ownVisible && (
        <div className="lb-sticky">
          <div className="lb-row you">
            <span className="lb-rank display tnum">{you.rank}</span>
            <Avatar index={you.avatar} size={38} />
            <div className="stack grow">
              <b>{you.name}</b>
              <span className="small muted">Your position</span>
            </div>
            <span className="display d-sm tnum">{nf.format(you.score)}</span>
          </div>
        </div>
      )}

      <div className="note">
        <Icon name="info" size={18} />
        <p className="small">Other players here are simulated sample players, generated on this device so you have someone to chase. They are not real people. Online leaderboards and real friends are planned for a future update.</p>
      </div>
    </div>
  );
}
