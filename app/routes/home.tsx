import type { Route } from "./+types/home";
import { Player } from "~/components/Player";
import { Schedule } from "~/components/Schedule";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Radiomantis" }];
}

export default function Home() {
  return (
    <main id="home-view">
      <div id="brand-logo">
        <img
          src="/pictures/logofinal.avif"
          alt="Radiomantis Logo"
          className="responsive-img"
          fetchPriority="high"
        />
      </div>

      <section id="info-box">
        <div id="social-links">
          <a href="https://www.instagram.com/radiomantis808" target="_blank" rel="noreferrer">
            <img src="/pictures/SoMe/instagram.svg" alt="Instagram" />
          </a>
          <a href="https://www.mixcloud.com/radiomantis/" target="_blank" rel="noreferrer">
            <img src="/pictures/SoMe/mixcloud.svg" alt="Mixcloud" />
          </a>
        </div>
        <Player />
      </section>

      <section id="schedule-box" className="past-shows-box">
        <h2>Schedule</h2>
        <Schedule />
      </section>
    </main>
  );
}
