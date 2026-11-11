import { useEffect, useMemo, useState } from 'react';
import { useNav } from '../app/nav';
import { useStore } from '../app/store';
import { GAME_IDS, type GameId } from '../games/types';
import { copyText, renderShareCard, shareCard, shareContent, type SharePayload } from '../services/share';
import { Button, Sheet } from './ui';

export function ShareSheet({ payload, open }: { payload: SharePayload; open: boolean }) {
  const nav = useNav();
  const { data, derived } = useStore();
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [preview, setPreview] = useState('');
  const [status, setStatus] = useState('');

  const content = useMemo(() => {
    const scores: Partial<Record<GameId, number>> = {};
    if (payload.kind === 'daily') for (const g of GAME_IDS) {
      const r = data.daily[payload.date]?.results[g];
      if (r) scores[g] = r.score;
    }
    return shareContent(payload, scores, derived.streak, data.profile.name);
  }, [payload, data, derived.streak]);

  useEffect(() => {
    let alive = true;
    void renderShareCard(content)
      .then((c) => {
        if (!alive) return;
        setCanvas(c);
        setPreview(c.toDataURL('image/png'));
      })
      .catch(() => alive && setStatus('Could not draw the card — you can still share the text.'));
    return () => {
      alive = false;
    };
  }, [content]);

  const share = async () => {
    const outcome = await shareCard(content, canvas);
    setStatus(outcome === 'copied' ? 'Copied to clipboard' : outcome === 'failed' ? 'Sharing is not available on this device' : '');
  };

  return (
    <Sheet open={open} onClose={nav.closeSheet} title="Share">
      <div className="stack gap-4">
        <div className="share-preview">{preview ? <img src={preview} alt="Your result card" /> : <div className="share-skeleton" />}</div>
        <pre className="share-text">{content.text}</pre>
        <div className="row gap-3">
          <Button block icon="share" onClick={share}>
            Share
          </Button>
          <Button
            block
            variant="secondary"
            icon="copy"
            onClick={async () => setStatus((await copyText(content.text)) ? 'Copied to clipboard' : 'Could not copy')}
          >
            Copy text
          </Button>
        </div>
        <p className="small center" style={{ color: 'var(--lime)', minHeight: 19 }} role="status">
          {status}
        </p>
      </div>
    </Sheet>
  );
}
