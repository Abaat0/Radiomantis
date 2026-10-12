import type { Route } from "./+types/past-shows";
import { fetchPastShows } from "~/lib/mixcloud";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Past Shows - Radiomantis" }];
}

export async function clientLoader() {
  return { shows: await fetchPastShows() };
}

function PastShowsBox({ children }: { children: React.ReactNode }) {
  return (
    <main id="home-view">
      <section id="info-box" className="past-shows-box">
        <h2>Past Transmissions</h2>
        <div id="past-shows-container" className="shows-grid">
          {children}
        </div>
      </section>
    </main>
  );
}

// Pre-rendered into the HTML and shown until the Mixcloud fetch resolves
export function HydrateFallback() {
  return (
    <PastShowsBox>
      <p className="font-castoro text-xl">Loading transmissions...</p>
    </PastShowsBox>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  console.error("Couldn't fetch past shows from Mixcloud:", error);
  return (
    <PastShowsBox>
      <p>Couldn't load past shows. Please check our Mixcloud page directly.</p>
    </PastShowsBox>
  );
}

export default function PastShows({ loaderData }: Route.ComponentProps) {
  return (
    <PastShowsBox>
      {loaderData.shows.map((show) => (
        <a key={show.key} href={show.url} target="_blank" rel="noreferrer" className="show-item">
          <img src={show.image} alt={show.name} loading="lazy" />
          <p>{show.name}</p>
          {show.date && <span className="show-date">{show.date}</span>}
        </a>
      ))}
    </PastShowsBox>
  );
}
