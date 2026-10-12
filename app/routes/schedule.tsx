import type { Route } from "./+types/schedule";
import { Schedule } from "~/components/Schedule";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Schedule - Radiomantis" }];
}

export default function SchedulePage() {
  return (
    <main id="home-view">
      <section id="info-box" className="past-shows-box">
        <h2>Schedule</h2>
        <Schedule />
      </section>
    </main>
  );
}
