import { useCallback, useEffect, useRef, useState } from "react";

const NICK_KEY = "radiomantis-chat-nick";
const ADMIN_KEY = "radiomantis-chat-admin";
const MAX_MESSAGES = 200;
const MAX_NICK = 24;

export type ChatMessage =
  | { id: number; kind: "msg"; nick: string; text: string; ts?: number }
  | { id: number; kind: "system"; text: string };

type NewMessage =
  | { kind: "msg"; nick: string; text: string; ts?: number }
  | { kind: "system"; text: string };

type ServerEvent =
  | { type: "history"; messages: { nick: string; text: string; ts?: number }[] }
  | { type: "msg"; nick: string; text: string; ts?: number }
  | { type: "system"; text: string }
  | { type: "clear" };

function chatUrl(): string {
  const urlAdmin = new URLSearchParams(location.search).get("admin");
  if (urlAdmin) sessionStorage.setItem(ADMIN_KEY, urlAdmin);
  const adminToken = sessionStorage.getItem(ADMIN_KEY);

  const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
  const base = isLocal ? `ws://${location.hostname}:8081/chat` : `wss://${location.host}/chat`;
  return adminToken ? `${base}?token=${encodeURIComponent(adminToken)}` : base;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [nick, setNickState] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const nickRef = useRef("");
  const nextId = useRef(0);

  const append = useCallback((items: NewMessage[], replace = false) => {
    setMessages((prev) => {
      const added = items.map((m): ChatMessage => ({ ...m, id: nextId.current++ }));
      return (replace ? added : [...prev, ...added]).slice(-MAX_MESSAGES);
    });
  }, []);

  const sendJoin = useCallback((name: string) => {
    const ws = wsRef.current;
    if (name && ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "join", nick: name }));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(NICK_KEY) || "";
    nickRef.current = saved;
    setNickState(saved);

    const url = chatUrl();
    let reconnectDelay = 1000;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    function connect() {
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        reconnectDelay = 1000;
        setConnected(true);
        setReconnecting(false);
        sendJoin(nickRef.current);
      });
      ws.addEventListener("message", (e) => {
        let data: ServerEvent;
        try {
          data = JSON.parse(e.data);
        } catch {
          return;
        }
        if (data.type === "history" && Array.isArray(data.messages)) {
          append(data.messages.map((m) => ({ kind: "msg" as const, ...m })), true);
        } else if (data.type === "msg") {
          append([{ kind: "msg", nick: data.nick, text: data.text, ts: data.ts }]);
        } else if (data.type === "system") {
          append([{ kind: "system", text: data.text }]);
        } else if (data.type === "clear") {
          setMessages([]);
        }
      });
      ws.addEventListener("close", scheduleReconnect);
      ws.addEventListener("error", () => ws.close());
    }

    function scheduleReconnect() {
      if (disposed) return;
      setConnected(false);
      setReconnecting(true);
      reconnectTimer = setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 15000);
    }

    connect();
    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [append, sendJoin]);

  const setNick = useCallback(
    (value: string): boolean => {
      const v = value.trim().slice(0, MAX_NICK);
      if (!v) return false;
      nickRef.current = v;
      setNickState(v);
      localStorage.setItem(NICK_KEY, v);
      sendJoin(v);
      return true;
    },
    [sendJoin],
  );

  const submit = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;

      if (text === "/logout") {
        nickRef.current = "";
        setNickState("");
        localStorage.removeItem(NICK_KEY);
        return;
      }
      const rename = text.match(/^\/nick\s+(.+)$/i);
      if (rename) {
        if (setNick(rename[1])) append([{ kind: "system", text: `you're now ${nickRef.current}` }]);
        return;
      }

      const ws = wsRef.current;
      if (nickRef.current && ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "msg", text }));
      }
    },
    [append, setNick],
  );

  return { messages, connected, reconnecting, nick, setNick, submit };
}
