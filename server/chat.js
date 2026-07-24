/*
 * Radiomantis live chat — a tiny self-hosted WebSocket relay.
 *
 * One process, one dependency (`ws`). Keeps the last N messages in memory,
 * mirrored to a small JSON file so a restart doesn't lose recent history.
 * Binds to localhost only — the site's web server terminates TLS and proxies
 * wss://<origin>/chat to here.
 *
 * Env vars:
 *   CHAT_PORT          local port to listen on            (default 8081)
 *   CHAT_HOST          interface to bind                  (default 127.0.0.1)
 *   CHAT_ADMIN_TOKEN   secret; connect ?token=... to mod  (default: admin disabled)
 *   CHAT_DATA_FILE     history/bans persistence path      (default ./data/chat.json)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

// ---- Config -----------------------------------------------------------------
const PORT = Number(process.env.CHAT_PORT) || 8081;
const HOST = process.env.CHAT_HOST || '127.0.0.1';
const ADMIN_TOKEN = process.env.CHAT_ADMIN_TOKEN || '';
const DATA_FILE = process.env.CHAT_DATA_FILE || path.join(__dirname, 'data', 'chat.json');

const HISTORY_LIMIT = 50;      // messages replayed to new joiners
const MAX_MSG_LEN = 500;       // characters
const MAX_NICK_LEN = 24;
const RATE_MAX = 5;            // messages...
const RATE_WINDOW_MS = 5000;   // ...per this window

// ---- Persistence ------------------------------------------------------------
/** @type {{messages: Array, bans: string[]}} */
let store = { messages: [], bans: [] };

function loadStore() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    store.messages = Array.isArray(parsed.messages) ? parsed.messages.slice(-HISTORY_LIMIT) : [];
    store.bans = Array.isArray(parsed.bans) ? parsed.bans : [];
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Could not read data file:', err.message);
  }
}

let saveTimer = null;
function saveStore() {
  // Debounce writes so a burst of messages doesn't hammer the disk.
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    fs.mkdir(path.dirname(DATA_FILE), { recursive: true }, () => {
      fs.writeFile(DATA_FILE, JSON.stringify(store), (err) => {
        if (err) console.error('Could not write data file:', err.message);
      });
    });
  }, 1000);
}

const bans = new Set();
loadStore();
store.bans.forEach((ip) => bans.add(ip));

// ---- Helpers ----------------------------------------------------------------
// Strip control characters (defense in depth; the client also renders as text).
const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;

function clean(str, maxLen) {
  return String(str == null ? '' : str)
    .replace(CONTROL_CHARS, '')
    .trim()
    .slice(0, maxLen);
}

function sanitizeNick(raw) {
  const nick = clean(raw, MAX_NICK_LEN).replace(/\s+/g, ' ');
  return nick || 'anon';
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function broadcast(obj) {
  const data = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(data);
  }
}

function pushHistory(msg) {
  store.messages.push(msg);
  if (store.messages.length > HISTORY_LIMIT) {
    store.messages = store.messages.slice(-HISTORY_LIMIT);
  }
  saveStore();
}

// ---- Server -----------------------------------------------------------------
const wss = new WebSocketServer({ host: HOST, port: PORT, path: '/chat' });

wss.on('connection', (ws, req) => {
  const ip = clientIp(req);
  if (bans.has(ip)) {
    send(ws, { type: 'system', text: 'you are banned from this chat.' });
    ws.close();
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  ws.isAdmin = Boolean(ADMIN_TOKEN) && url.searchParams.get('token') === ADMIN_TOKEN;
  ws.ip = ip;
  ws.nick = 'anon';
  ws.stamps = []; // message timestamps for rate limiting

  send(ws, { type: 'history', messages: store.messages });
  if (ws.isAdmin) send(ws, { type: 'system', text: 'admin mode: /clear, /kick <nick>, /ban <nick>' });

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!data || typeof data.type !== 'string') return;

    if (data.type === 'join') {
      ws.nick = sanitizeNick(data.nick);
      return;
    }

    if (data.type === 'msg') {
      const text = clean(data.text, MAX_MSG_LEN);
      if (!text) return;

      if (ws.isAdmin && text[0] === '/') {
        handleAdminCommand(ws, text);
        return;
      }

      // Rate limit: drop anything past RATE_MAX within the sliding window.
      const now = Date.now();
      ws.stamps = ws.stamps.filter((t) => now - t < RATE_WINDOW_MS);
      if (ws.stamps.length >= RATE_MAX) {
        send(ws, { type: 'system', text: 'slow down a little.' });
        return;
      }
      ws.stamps.push(now);

      const msg = { type: 'msg', nick: ws.nick, text, ts: now };
      pushHistory({ nick: msg.nick, text: msg.text, ts: msg.ts });
      broadcast(msg);
    }
  });
});

function handleAdminCommand(ws, text) {
  const [cmd, ...rest] = text.slice(1).split(/\s+/);
  const arg = rest.join(' ').trim();

  if (cmd === 'clear') {
    store.messages = [];
    saveStore();
    broadcast({ type: 'clear' });
    broadcast({ type: 'system', text: 'chat was cleared by a moderator.' });
    return;
  }

  if (cmd === 'kick' || cmd === 'ban') {
    if (!arg) return send(ws, { type: 'system', text: `usage: /${cmd} <nick>` });
    let hit = 0;
    for (const client of wss.clients) {
      if (client.nick === arg) {
        hit++;
        if (cmd === 'ban') {
          bans.add(client.ip);
          store.bans = [...bans];
          saveStore();
        }
        send(client, { type: 'system', text: `you were ${cmd === 'ban' ? 'banned' : 'kicked'}.` });
        client.close();
      }
    }
    send(ws, { type: 'system', text: hit ? `${cmd}ed ${arg} (${hit}).` : `no one named "${arg}" is here.` });
    return;
  }

  send(ws, { type: 'system', text: `unknown command: /${cmd}` });
}

console.log(`Radiomantis chat listening on ws://${HOST}:${PORT}/chat`);
console.log(`  admin: ${ADMIN_TOKEN ? 'enabled (token set)' : 'disabled (no CHAT_ADMIN_TOKEN)'}`);
console.log(`  data:  ${DATA_FILE}`);
