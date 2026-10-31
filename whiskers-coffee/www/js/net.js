// Online co-op over WebRTC data channels (PeerJS). The host's phone runs the café; a friend
// joins with a five-letter code. The signalling server only introduces the two phones;
// after that they talk to each other directly.
const PREFIX = 'whiskers-coffee-v1-';
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const makeCode = () => Array.from({ length: 5 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
export const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

function peerOptions() {
  // ?peer=host:port points at a self-hosted PeerJS server (used by the automated tests)
  const q = new URLSearchParams(location.search).get('peer');
  const config = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
    ],
  };
  if (q) {
    const [host, port] = q.split(':');
    return { host, port: +port || 9000, path: '/', secure: false, config, debug: 1 };
  }
  return { config, debug: 1 };
}

const Peer = () => window.peerjs.Peer;

// The host keeps the café and accepts one or more friends.
export class HostSession {
  constructor(code, { onOpen, onJoin, onMessage, onLeave, onError }) {
    this.code = code;
    this.conns = new Map();
    this.closed = false;
    const P = Peer();
    this.peer = new P(PREFIX + code, peerOptions());
    this.peer.on('open', () => onOpen?.(code));
    this.peer.on('connection', (conn) => {
      conn.on('open', () => {
        this.conns.set(conn.peer, conn);
        onJoin?.(conn.peer);
      });
      conn.on('data', (msg) => onMessage?.(conn.peer, msg));
      conn.on('close', () => { this.conns.delete(conn.peer); onLeave?.(conn.peer); });
      conn.on('error', () => { this.conns.delete(conn.peer); onLeave?.(conn.peer); });
    });
    this.peer.on('disconnected', () => { if (!this.closed) setTimeout(() => !this.closed && this.peer.reconnect(), 1500); });
    this.peer.on('error', (e) => onError?.(e.type === 'unavailable-id' ? 'That code is busy, try again' : e.type === 'network' || e.type === 'server-error' ? 'Could not reach the connection service' : e.message || String(e.type)));
  }
  send(id, msg) { const c = this.conns.get(id); if (c && c.open) c.send(msg); }
  broadcast(msg) { for (const c of this.conns.values()) if (c.open) c.send(msg); }
  get count() { return this.conns.size; }
  close() { this.closed = true; for (const c of this.conns.values()) c.close(); this.peer.destroy(); }
}

// A guest connects to a host by code and reconnects on its own if the line drops.
export class GuestSession {
  constructor(code, { onOpen, onMessage, onClose, onError }) {
    this.code = code;
    this.handlers = { onOpen, onMessage, onClose, onError };
    this.closed = false;
    this.tries = 0;
    const P = Peer();
    this.peer = new P(peerOptions());
    this.peer.on('open', () => this.connect());
    this.peer.on('error', (e) => {
      if (e.type === 'peer-unavailable') {
        if (this.everOpen) return this.retry();
        return onError?.("Couldn't find that café. Check the code and that your friend has it open.");
      }
      if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') return this.retry();
      onError?.(e.message || String(e.type));
    });
    this.peer.on('disconnected', () => { if (!this.closed) setTimeout(() => !this.closed && this.peer.reconnect(), 1500); });
  }
  connect() {
    if (this.closed) return;
    this.conn = this.peer.connect(PREFIX + this.code, { reliable: true });
    this.conn.on('open', () => { this.tries = 0; this.everOpen = true; this.handlers.onOpen?.(); });
    this.conn.on('data', (m) => this.handlers.onMessage?.(m));
    this.conn.on('close', () => { if (!this.closed) { this.handlers.onClose?.(); this.retry(); } });
  }
  retry() {
    if (this.closed || this.tries > 20) return;
    this.tries++;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.connect(), Math.min(8000, 1000 * this.tries));
  }
  send(msg) { if (this.conn && this.conn.open) this.conn.send(msg); }
  get open() { return !!(this.conn && this.conn.open); }
  close() { this.closed = true; clearTimeout(this.timer); this.conn?.close(); this.peer.destroy(); }
}
