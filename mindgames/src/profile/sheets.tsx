import { useState } from 'react';
import { useNav } from '../app/nav';
import { useStore } from '../app/store';
import { Avatar, AVATAR_COUNT, Button, LogoMark, Sheet, Toggle, Wordmark } from '../components/ui';
import { gameFromCode, GAMES } from '../games/types';
import { haptic } from '../services/haptics';
import { isValidCode } from '../services/rng';

export function AvatarPicker({ value, onChange }: { value: number; onChange: (i: number) => void }) {
  return (
    <div className="avatar-picker" role="radiogroup" aria-label="Avatar">
      {Array.from({ length: AVATAR_COUNT }, (_, i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          className={value === i ? 'on' : ''}
          onClick={() => {
            haptic.tap();
            onChange(i);
          }}
        >
          <Avatar index={i} size={44} />
        </button>
      ))}
    </div>
  );
}

const cleanName = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 16);

export function SettingsSheet({ open }: { open: boolean }) {
  const nav = useNav();
  const { data, update, reset } = useStore();
  const [name, setName] = useState(data.profile.name);
  const [confirmReset, setConfirmReset] = useState(false);
  const set = (key: 'haptics' | 'sound' | 'reduceMotion') => (on: boolean) => update((d) => ({ ...d, settings: { ...d.settings, [key]: on } }));
  const saveName = () => {
    const clean = cleanName(name) || 'Player';
    setName(clean);
    update((d) => ({ ...d, profile: { ...d.profile, name: clean } }));
  };

  return (
    <Sheet open={open} onClose={nav.closeSheet} title="Settings">
      <div className="stack gap-5">
        <div className="stack gap-3">
          <span className="eyebrow">Profile</span>
          <input className="input" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} aria-label="Display name" placeholder="Your name" enterKeyHint="done" autoComplete="off" autoCorrect="off" spellCheck={false} />
          <AvatarPicker value={data.profile.avatar} onChange={(i) => update((d) => ({ ...d, profile: { ...d.profile, avatar: i } }))} />
        </div>

        <div className="stack gap-3">
          <span className="eyebrow">Feel</span>
          <div className="card card-tight settings-list">
            <div className="row between">
              <span className="stack">
                <b>Haptics</b>
                <span className="small muted">Vibrate on taps and answers</span>
              </span>
              <Toggle on={data.settings.haptics} onChange={set('haptics')} label="Haptics" />
            </div>
            <div className="row between">
              <span className="stack">
                <b>Sound</b>
                <span className="small muted">Soft tones for answers and results</span>
              </span>
              <Toggle on={data.settings.sound} onChange={set('sound')} label="Sound" />
            </div>
            <div className="row between">
              <span className="stack">
                <b>Reduce motion</b>
                <span className="small muted">Calmer transitions. Puzzle animations stay on.</span>
              </span>
              <Toggle on={data.settings.reduceMotion} onChange={set('reduceMotion')} label="Reduce motion" />
            </div>
          </div>
        </div>

        <div className="stack gap-3">
          <span className="eyebrow">Data</span>
          {confirmReset ? (
            <div className="card card-tight stack gap-3">
              <p className="small">This erases your scores, streak, XP and history on this device. It cannot be undone.</p>
              <div className="row gap-3">
                <Button block variant="secondary" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Button>
                <Button
                  block
                  variant="danger"
                  onClick={() => {
                    void reset().then(() => {
                      setConfirmReset(false);
                      nav.closeSheet();
                      nav.go('home');
                    });
                  }}
                >
                  Erase everything
                </Button>
              </div>
            </div>
          ) : (
            <Button block variant="secondary" onClick={() => setConfirmReset(true)}>
              Reset progress
            </Button>
          )}
          <p className="small dim center">Your progress is stored on this device only. MINDGAMES v1.0</p>
        </div>
      </div>
    </Sheet>
  );
}

export function ChallengeSheet({ open }: { open: boolean }) {
  const nav = useNav();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    const [prefix, code] = value.trim().toUpperCase().split('-');
    const game = gameFromCode(prefix ?? '');
    if (!game || !code || !isValidCode(code)) {
      haptic.error();
      setError('That code does not look right. Codes look like PE-7K3MQ.');
      return;
    }
    nav.play(game, 'practice', code);
  };
  return (
    <Sheet open={open} onClose={nav.closeSheet} title="Challenge code">
      <div className="stack gap-4">
        <p className="muted">Enter a code from a friend to play the exact same puzzles they played, then compare scores.</p>
        <input
          className="input input-code display"
          value={value}
          onChange={(e) => {
            setValue(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11));
            setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="PE-7K3MQ"
          aria-label="Challenge code"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
        />
        <p className="small" style={{ color: 'var(--red)', minHeight: 19 }} role="alert">
          {error}
        </p>
        <Button block size="lg" disabled={value.length < 6} onClick={submit}>
          Play this challenge
        </Button>
        <p className="small dim center">
          {Object.values(GAMES)
            .map((g) => `${g.code} = ${g.title}`)
            .join(' · ')}
        </p>
      </div>
    </Sheet>
  );
}

export function Onboarding() {
  const { data, update } = useStore();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(data.profile.avatar);
  return (
    <div className="onboard">
      <div className="onboard-hero">
        <div className="onboard-logo">
          <LogoMark size={104} />
        </div>
        <Wordmark size={54} />
        <p className="muted">Three small games. Every day.<br />The same puzzles for everyone.</p>
      </div>
      <div className="stack gap-4 onboard-form">
        <span className="eyebrow">What should we call you?</span>
        <input className="input" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="done" onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
        <AvatarPicker value={avatar} onChange={setAvatar} />
        <Button block size="lg" iconRight="chevron" onClick={() => update((d) => ({ ...d, onboarded: true, profile: { ...d.profile, name: cleanName(name) || 'Player', avatar } }))}>
          Start playing
        </Button>
      </div>
    </div>
  );
}
