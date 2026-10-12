const SHEET_URL =
  "https://opensheet.elk.sh/1OhiyukdiE9ZdmLHTI0nnnKosPXwnOXUJ4t5uh5c4HYE/Sheet1";

export type ShowRow = {
  Day?: string;
  Date?: string;
  Start: string;
  End: string;
  Show?: string;
  DJ?: string;
};

export type ScheduleSlot = {
  start: Date;
  end: Date;
  dayDelta: number;
  show: ShowRow;
};

export type ScheduleDay = {
  date: Date;
  dayName: string;
  slots: ScheduleSlot[];
};

export async function fetchSchedule(): Promise<ShowRow[]> {
  const response = await fetch(SHEET_URL);
  if (!response.ok) throw new Error(`Schedule fetch failed: ${response.status}`);
  return response.json();
}

export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function isoDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseHM(hm: string): [number, number] {
  const [h, m] = hm.split(":").map(Number);
  return [h, m];
}

function rowMatchesDay(show: ShowRow, dateString: string, dayName: string): boolean {
  if (show.Date && show.Date === dateString) return true;
  return (!show.Date || show.Date.trim() === "") && show.Day === dayName;
}

function tzOffsetMinutes(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const hour = p.hour === "24" ? 0 : Number(p.hour);
  const asUTC = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    hour,
    Number(p.minute),
    Number(p.second),
  );
  return (asUTC - date.getTime()) / 60000;
}

export function cphWallToDate(
  year: number,
  monthIndex: number,
  day: number,
  hh: number,
  mm: number,
): Date {
  const guessUTC = Date.UTC(year, monthIndex, day, hh, mm);
  const offset = tzOffsetMinutes(new Date(guessUTC), "Europe/Copenhagen");
  return new Date(guessUTC - offset * 60000);
}

export function buildWeek(rows: ShowRow[], monday: Date): ScheduleDay[] {
  const days: ScheduleDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);

    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
    const year = date.getFullYear();
    const monthIndex = date.getMonth();
    const dayNum = date.getDate();
    const dateString = isoDate(year, monthIndex, dayNum);

    const slots = rows
      .filter((show) => show.Start && show.End && rowMatchesDay(show, dateString, dayName))
      .sort((a, b) => a.Start.localeCompare(b.Start))
      .map((show) => {
        const [sh, sm] = parseHM(show.Start);
        const [eh, em] = parseHM(show.End);
        const start = cphWallToDate(year, monthIndex, dayNum, sh, sm);
        const end =
          eh === 0 && em === 0
            ? cphWallToDate(year, monthIndex, dayNum + 1, 0, 0)
            : cphWallToDate(year, monthIndex, dayNum, eh, em);

        const cetMidnight = new Date(year, monthIndex, dayNum).getTime();
        const localMidnight = new Date(
          start.getFullYear(),
          start.getMonth(),
          start.getDate(),
        ).getTime();
        const dayDelta = Math.round((localMidnight - cetMidnight) / 86400000);

        return { start, end, dayDelta, show };
      });

    days.push({ date, dayName, slots });
  }
  return days;
}

function getNowInCopenhagen(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Copenhagen" }));
}

function getShowWindow(show: ShowRow, now: Date): { startTime: Date; endTime: Date } | null {
  if (!show.Start || !show.End) return null;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const dayKey = (d: Date) => ({
    dateString: isoDate(d.getFullYear(), d.getMonth(), d.getDate()),
    dayName: d.toLocaleDateString("en-US", { weekday: "long" }),
  });
  const today = dayKey(now);
  const prev = dayKey(yesterday);

  let base: Date | null = null;
  if (rowMatchesDay(show, today.dateString, today.dayName)) {
    base = new Date(now);
  } else if (rowMatchesDay(show, prev.dateString, prev.dayName)) {
    base = new Date(yesterday);
  }
  if (!base) return null;

  const [startH, startM] = parseHM(show.Start);
  const [endH, endM] = parseHM(show.End);

  const startTime = new Date(base);
  startTime.setHours(startH, startM, 0, 0);

  const endTime = new Date(base);
  if (endH === 0 && endM === 0) {
    endTime.setDate(endTime.getDate() + 1);
    endTime.setHours(0, 0, 0, 0);
  } else {
    endTime.setHours(endH, endM, 0, 0);
  }

  return { startTime, endTime };
}

export function getCurrentShow(rows: ShowRow[]): ShowRow | null {
  const now = getNowInCopenhagen();
  for (const show of rows) {
    const window = getShowWindow(show, now);
    if (window && now >= window.startTime && now <= window.endTime) return show;
  }
  return null;
}

export function shouldBeWaiting(rows: ShowRow[]): boolean {
  const now = getNowInCopenhagen();
  for (const show of rows) {
    const window = getShowWindow(show, now);
    if (!window) continue;

    const minsUntilStart = (window.startTime.getTime() - now.getTime()) / 60000;
    const minsSinceEnd = (now.getTime() - window.endTime.getTime()) / 60000;

    const isDuringShow = now >= window.startTime && now <= window.endTime;
    const isStartingSoon = minsUntilStart <= 15 && minsUntilStart > 0;
    const justEnded = minsSinceEnd <= 15 && minsSinceEnd >= 0;

    if (isDuringShow || isStartingSoon || justEnded) return true;
  }
  return false;
}
