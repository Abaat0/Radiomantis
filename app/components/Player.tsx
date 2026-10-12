import { useRadio } from "~/context/RadioContext";

const STATUS_LABEL = { online: "now playing", standby: "standby", offline: "offline" };

const MAIN_TEXT = {
  standby: "new set starting soon...",
  offline: "check the schedule for upcoming shows",
};

export function Player() {
  const { status, nowPlaying, isPlaying, toggle } = useRadio();

  return (
    <div id="player-container">
      <div className="player-top-row">
        <button
          id="play-pause-btn"
          type="button"
          className={`icon-button${isPlaying ? " is-playing" : ""}`}
          aria-label={isPlaying ? "Pause" : "Play"}
          style={{ visibility: status === "offline" ? "hidden" : "visible" }}
          onClick={toggle}
        />
        <div className="now-playing-label">
          <p id="status-label">{STATUS_LABEL[status]}</p>
        </div>
      </div>
      <div className="player-text">
        <p id="main-player-text">{status === "online" ? nowPlaying : MAIN_TEXT[status]}</p>
      </div>
    </div>
  );
}
