import type { Route } from "./+types/about";

export function meta({}: Route.MetaArgs) {
  return [{ title: "About Us - Radiomantis" }];
}

export default function About() {
  return (
    <main id="home-view">
      <section id="info-box" className="subpage-box">
        <h2>The mayor won't listen</h2>
        <h3>
          <i>
            "Mantises are a family of over 2400 species, distributed worldwide. We may not have
            wings, but all mantodeans have forelegs that are greatly enlarged and adapted for
            playing music."
          </i>
        </h3>
        <div>
          Radio Mantis was founded in 2025 in a cozy student dorm in Aarhus, Denmark and have
          since then expanded to a global reach hosting regular shows from residents based
          everywhere from Los Angeles, Brooklyn, São Paulo, Hamburg, Bangalore and more. Radio
          Mantis is now based in Turin, Italy, but stands faithful to creating a global community
          of enthusiastic djs and selectors wanting to share their unique musical vision.
          <br />
          <br />
          We are always looking for fresh talent, so if you are a producer, dj, selector or if you
          just want to have a chat with us, please send us a message at play@radiomantis.com!
        </div>
      </section>
    </main>
  );
}
