import type { Route } from "./+types/residents";
import { residents } from "~/data/residents";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Residents - Radiomantis" }];
}

export default function Residents() {
  return (
    <main id="home-view">
      <section id="info-box" className="past-shows-box">
        <h2>Residents</h2>
        <div className="shows-grid residents-grid">
          {residents.map((r) => (
            <a
              key={r.name}
              href={r.url}
              target={r.url ? "_blank" : undefined}
              rel={r.url ? "noreferrer" : undefined}
              className="show-item"
            >
              <img src={r.image} alt={r.name} />
              <p>
                {r.name} ({r.country})
              </p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
