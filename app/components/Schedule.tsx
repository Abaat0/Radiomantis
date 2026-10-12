import { useEffect, useMemo, useState } from "react";
import { useRadio } from "~/context/RadioContext";
import { buildWeek, getMonday } from "~/lib/schedule";

const DAY_FORMAT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

const formatTime = (t: Date) =>
  t.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    numberingSystem: "latn",
  });

export function Schedule() {
  const { schedule } = useRadio();
  const [monday, setMonday] = useState<Date | null>(null);
  const [tzNote, setTzNote] = useState("all times are in cet!");

  useEffect(() => {
    setMonday(getMonday(new Date()));
    const abbr = new Date()
      .toLocaleTimeString("en-US", { timeZoneName: "short" })
      .split(" ")
      .pop();
    setTzNote(`all times are ${abbr} (+1 means next day)`);
  }, []);

  const shiftWeek = (days: number) =>
    setMonday((m) => {
      if (!m) return m;
      const next = new Date(m);
      next.setDate(m.getDate() + days);
      return next;
    });

  const days = useMemo(
    () => (monday && Array.isArray(schedule) ? buildWeek(schedule, monday) : null),
    [monday, schedule],
  );

  let weekLabel = "Loading...";
  if (monday && days) {
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    weekLabel = `${monday.toLocaleDateString("en-US", DAY_FORMAT)} - ${sunday.toLocaleDateString("en-US", DAY_FORMAT)}`;
  }

  const showDays = days?.filter((day) => day.slots.length > 0);

  return (
    <>
      <div className="schedule-controls">
        <button type="button" className="nav-btn" onClick={() => shiftWeek(-7)}>
          &larr; Previous
        </button>
        <span id="week-label">{weekLabel}</span>
        <button type="button" className="nav-btn" onClick={() => shiftWeek(7)}>
          Next &rarr;
        </button>
      </div>
      <p id="tz-note" className="schedule-info">
        {tzNote}
      </p>

      <div id="schedule-container">
        {schedule === "error" && <p>Couldn't load the schedule. Please try again later.</p>}

        {showDays?.map((day) => (
          <div key={day.date.toDateString()} className="schedule-day-group">
            <div className="schedule-day-title">
              {day.dayName}, {day.date.toLocaleDateString("en-US", DAY_FORMAT)}
            </div>
            {day.slots.map((slot) => (
              <div key={`${slot.show.Start}-${slot.show.DJ}`} className="schedule-row">
                <div className="schedule-time">
                  {formatTime(slot.start)} - {formatTime(slot.end)}
                  {slot.dayDelta > 0 && ` (+${slot.dayDelta})`}
                  {slot.dayDelta < 0 && ` (${slot.dayDelta})`}
                </div>
                <div className="schedule-info">
                  {slot.show.Show ? `${slot.show.Show} w/ ` : ""}
                  {slot.show.DJ}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {showDays?.length === 0 && (
        <p className="mt-10 text-center text-2xl">No shows scheduled for this week.</p>
      )}
    </>
  );
}
