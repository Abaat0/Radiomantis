import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useChat, type ChatMessage } from "~/hooks/useChat";

function MessageRow({ message, me }: { message: ChatMessage; me: string }) {
  if (message.kind === "system") {
    return <div className="chat-msg chat-msg--system">{message.text}</div>;
  }
  const date = message.ts ? new Date(message.ts) : null;
  return (
    <div className="chat-msg">
      <span className="chat-msg-time" title={date?.toLocaleString()}>
        {/* Viewer's local timezone, 24h, Latin digits — ts is absolute */}
        {date?.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          numberingSystem: "latn",
        })}
      </span>
      <span className={`chat-msg-nick${message.nick === me ? " chat-msg-nick--me" : ""}`}>
        {message.nick}:
      </span>
      <span className="chat-msg-text">{message.text}</span>
    </div>
  );
}

/**
 * Slide-in live chat. Lives in the root layout, outside the route <Outlet>, so the
 * socket and scrollback survive navigation. Messages render as React text nodes,
 * so they can't inject markup.
 */
export function ChatDrawer() {
  const { messages, connected, reconnecting, nick, setNick, submit } = useChat();
  const [open, setOpen] = useState(false);
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const msgInputRef = useRef<HTMLInputElement>(null);
  const nickInputRef = useRef<HTMLInputElement>(null);
  // Whether the log was scrolled to (near) the bottom before the latest update
  const stickRef = useRef(true);

  const onLogScroll = () => {
    const log = logRef.current;
    if (log) stickRef.current = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  };

  useLayoutEffect(() => {
    const log = logRef.current;
    if (log && stickRef.current) log.scrollTop = log.scrollHeight;
  }, [messages, viewport]);

  // Mobile keyboard: keep the drawer sized to the visible viewport so the input sits
  // just above the on-screen keyboard instead of being overlapped by it.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!open || !vv) {
      setViewport(null);
      return;
    }
    const fit = () => setViewport({ height: vv.height, top: vv.offsetTop });
    fit();
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    return () => {
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
    };
  }, [open]);

  useEffect(() => {
    if (open) (nick ? msgInputRef : nickInputRef).current?.focus();
  }, [open, nick]);

  const status = connected ? "" : reconnecting ? "reconnecting…" : "connecting…";

  return (
    <>
      <button
        id="chat-toggle"
        type="button"
        aria-label="Open chat"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        chat
      </button>
      <aside
        id="chat-drawer"
        className={[open && "open", !nick && "needs-nick"].filter(Boolean).join(" ")}
        aria-hidden={!open}
        aria-label="Live chat"
        style={viewport ? { height: viewport.height, top: viewport.top } : undefined}
      >
        <div id="chat-header">
          <span id="chat-title">{nick ? `Chat · ${nick}` : "chat"}</span>
          <button id="chat-close" type="button" aria-label="Close chat" onClick={() => setOpen(false)}>
            &times;
          </button>
        </div>
        <div id="chat-status" className={connected ? "is-hidden" : undefined}>
          {status}
        </div>
        <div id="chat-log" role="log" aria-live="polite" ref={logRef} onScroll={onLogScroll}>
          {messages.map((m) => (
            <MessageRow key={m.id} message={m} me={nick} />
          ))}
        </div>
        <form
          id="chat-form"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem("message") as HTMLInputElement;
            submit(input.value);
            input.value = "";
          }}
        >
          <input
            ref={msgInputRef}
            id="chat-input"
            name="message"
            type="text"
            maxLength={500}
            placeholder="say something…"
            aria-label="Message"
          />
        </form>
        <div id="chat-nick-gate">
          <form
            id="chat-nick-form"
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem("nick") as HTMLInputElement;
              setNick(input.value);
            }}
          >
            <label htmlFor="chat-nick-input">pick a name to chat</label>
            <input
              ref={nickInputRef}
              id="chat-nick-input"
              name="nick"
              type="text"
              maxLength={24}
              placeholder="your name"
              aria-label="Nickname"
            />
            <button type="submit">join</button>
          </form>
          <p className="chat-hint">change it later with /nick &lt;name&gt;, or /logout to reset</p>
        </div>
      </aside>
    </>
  );
}
