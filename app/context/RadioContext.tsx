import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  fetchSchedule,
  getCurrentShow,
  shouldBeWaiting,
  type ShowRow,
} from "~/lib/schedule";

const STREAM_URL = "https://radiomantis.com/listen/radiomantis/radio.mp3";
const NOW_PLAYING_URL = "https://radiomantis.com/api/nowplaying/2";
const POLL_MS = 15000;

export type RadioStatus = "online" | "standby" | "offline";

type RadioState = {
  status: RadioStatus;
  nowPlaying: string;
  isPlaying: boolean;
  toggle: () => void;
  schedule: ShowRow[] | null | "error";
};

const RadioContext = createContext<RadioState | null>(null);

export function useRadio(): RadioState {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error("useRadio must be used inside <RadioProvider>");
  return ctx;
}

type NowPlayingResponse = {
  live?: { is_live: boolean; streamer_name?: string };
};

export function RadioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [schedule, setSchedule] = useState<ShowRow[] | null | "error">(null);
  const [live, setLive] = useState<{ isLive: boolean; streamer: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    fetchSchedule()
      .then(setSchedule)
      .catch((error) => {
        console.error("Schedule fetch error:", error);
        setSchedule("error");
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const response = await fetch(NOW_PLAYING_URL, { cache: "no-store" });
        const data: NowPlayingResponse = await response.json();
        if (cancelled) return;
        setLive({
          isLive: Boolean(data.live?.is_live),
          streamer: data.live?.streamer_name || "unknown",
        });
      } catch (error) {
        console.error("Couldn't fetch radio data. Defaulting to offline.", error);
        if (!cancelled) setLive(null);
      }
      if (!cancelled) setTick((t) => t + 1);
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const rows = Array.isArray(schedule) ? schedule : [];
  const status: RadioStatus = live?.isLive
    ? "online"
    : live && shouldBeWaiting(rows)
      ? "standby"
      : "offline";

  const activeShow = status === "online" ? getCurrentShow(rows) : null;
  const host = activeShow?.DJ || live?.streamer || "";
  const nowPlaying = (activeShow?.Show ? `${activeShow.Show} w/ ${host}` : host).toLowerCase();

  useEffect(() => {
    const audio = audioRef.current;
    if (status === "offline" && audio && !audio.paused) audio.pause();
  }, [status, tick]);

  useEffect(() => {
    if (status !== "online" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: activeShow?.Show || host,
      artist: activeShow ? host : "Radiomantis",
      artwork: [{ src: "/pictures/maskable-icon.png", sizes: "512x512", type: "image/png" }],
    });
  }, [status, activeShow?.Show, host]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.src = STREAM_URL;
      audio.load();
      audio.play().catch((error) => console.error("Playback failed:", error));
    } else {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
  }, []);

  return (
    <RadioContext.Provider value={{ status, nowPlaying, isPlaying, toggle, schedule }}>
      {children}
      <audio
        ref={audioRef}
        id="radio-stream"
        preload="none"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEmptied={() => setIsPlaying(false)}
      />
    </RadioContext.Provider>
  );
}
