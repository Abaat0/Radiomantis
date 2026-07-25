# Radiomantis

The website for [Radiomantis](https://radiomantis.com),  an online community radio.
## How it works

A small static site (plain HTML/CSS/vanilla JS) plus a tiny Node chat
backend. The pages are served straight from disk, the streaming/broadcast side lives in
[AzuraCast](https://www.azuracast.com/), and a few things are pulled live in the browser:

- **Now playing** — polled from the AzuraCast API (`/api/nowplaying`).
- **Schedule** — read from a shared Google Sheet (via [opensheet](https://github.com/benborgers/opensheet)),
  which is also the source of truth for live show/DJ names.
- **Past shows** — fetched from the [Mixcloud](https://www.mixcloud.com/radiomantis/) API.
- **Chat** — a self-hosted WebSocket server in [`server/`](server/).

Navigation is a lightweight SPA: clicking a nav link swaps the `#app-frame` element via
`history.pushState` instead of a full reload, so the audio player (and the chat drawer) keep
playing across pages. Anything that must survive navigation — the `<audio>` element, the
background plant, and the chat drawer — lives *outside* `#app-frame`.

## Repo structure

```
index.html, schedule.html, residents.html,     the five pages (each has its own <head>;
past-shows.html, about.html                     the shared boilerplate is duplicated)
css/style.css                                   all styles (fluid type tokens up top)
css/pictures/                                   logos, backgrounds, resident/show art
javascript/script.js                            everything: player, schedule, past shows,
                                                SPA nav, and the chat client
manifest.json                                   PWA manifest
server/                                          the live-chat WebSocket backend (see its README)
.github/workflows/deploy.yaml                   deploy on push to main
```

## Running locally

Serve the repo root with any static server, e.g.:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/index.html`. Note that the clean URLs (`/schedule`) are
resolved in production by nginx; locally, open the `.html` files directly (e.g.
`schedule.html`), the SPA nav to sub-pages works, but refreshing on a clean URL won't. 
Kinda annoying but it looks nice in production!

For the chat, run the backend too (see [`server/README.md`](server/README.md)):

```bash
cd server && npm install && node chat.js
```

The frontend auto-connects to `ws://localhost:8081/chat` when it detects localhost.

## Deployment

Pushing to `main` triggers [`.github/workflows/deploy.yaml`](.github/workflows/deploy.yaml),
which SSHes into the VPS, `git pull`s into `~/website`, and runs `docker compose up -d --build`
for the chat container. The site is served by **Nginx Proxy Manager** (which also fronts
AzuraCast and terminates TLS). Chat-specific deploy/proxy details are in
[`server/README.md`](server/README.md).

## License

[GPL-3.0](LICENSE).
