import { useNav, type Tab } from '../app/nav';
import { useStore } from '../app/store';
import { isComplete } from '../daily/daily';
import { haptic } from '../services/haptics';
import { Icon, type IconName } from './Icon';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'daily', label: 'Daily', icon: 'calendar' },
  { id: 'ranks', label: 'Leaderboard', icon: 'trophy' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

export function BottomNav() {
  const nav = useNav();
  const { data, derived } = useStore();
  const dailyOpen = !isComplete(data.daily[derived.today]);
  return (
    <nav className="nav" aria-label="Main">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={nav.tab === t.id ? 'on' : ''}
          aria-current={nav.tab === t.id ? 'page' : undefined}
          onClick={() => {
            if (nav.tab !== t.id) haptic.tap();
            nav.go(t.id);
          }}
        >
          <Icon name={t.icon} size={23} filled={false} />
          {t.label}
          {t.id === 'daily' && dailyOpen && nav.tab !== 'daily' && <span className="nav-dot" aria-label="Daily challenge available" />}
        </button>
      ))}
    </nav>
  );
}
