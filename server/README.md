# Radiomantis chat server

A tiny self-hosted WebSocket chat relay for the Radiomantis site. One process, one
dependency (`ws`). Keeps the last 50 messages in memory, mirrored to a JSON file so a
restart keeps recent history. Binds to localhost only — the site's web server terminates
TLS and reverse-proxies `wss://<origin>/chat` to it.

## Run locally

```bash
cd server
npm install
node chat.js            # ws://127.0.0.1:8081/chat
```

With admin/moderation enabled:

```bash
CHAT_ADMIN_TOKEN=some-long-secret node chat.js
```

Then connect a moderator client with `?token=some-long-secret` appended to the WS URL.

### Environment variables

| Var                | Default             | Meaning                                  |
| ------------------ | ------------------- | ---------------------------------------- |
| `CHAT_PORT`        | `8081`              | Local port to listen on                  |
| `CHAT_HOST`        | `127.0.0.1`         | Interface to bind (keep on localhost)    |
| `CHAT_ADMIN_TOKEN` | *(empty)*           | Secret; enables `?token=` admin mode     |
| `CHAT_DATA_FILE`   | `./data/chat.json`  | History + ban-list persistence path      |

## Admin commands

Available only to a socket that connected with the correct `?token=`:

- `/clear` — wipe history for everyone
- `/kick <nick>` — disconnect everyone using that nick
- `/ban <nick>` — disconnect + ban their IP (persisted)

## Built-in guards

- Messages rendered as text on the client (`textContent`); server also strips control chars.
- 500-char message cap, 24-char nick cap.
- Rate limit: ~5 messages / 5 seconds per connection.
- IP taken from the proxy's `X-Forwarded-For` header.

## Deploy (VPS — Docker, alongside Nginx Proxy Manager)

Nginx Proxy Manager runs in a container, so it cannot reach a chat server bound to the
host's `127.0.0.1`. The chat therefore runs as its own container on the same external
`proxy_network` that NPM and AzuraCast share, and NPM proxies to it by container name.

1. Ensure `server/` is on the VPS (ships with the repo at `~/website/server`).
2. Build + start the container:
   ```bash
   cd ~/website/server
   docker compose up -d --build
   ```
   It joins `proxy_network` as `radiomantis-chat`, listening on `8081` (no host port
   published — reachable only from the Docker network).
3. In Nginx Proxy Manager, edit the website proxy host → **Custom locations** → add:
   - location: `/chat`
   - scheme: `http`, Forward Hostname: `radiomantis-chat`, Forward Port: `8081`
   - advanced (gear icon) for that location:
     ```
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection "upgrade";
     proxy_set_header X-Forwarded-For $remote_addr;
     ```

The client auto-selects `ws://<host>:8081/chat` on `localhost` for development and
`wss://<host>/chat` in production, so no domain is hard-coded. History + bans persist in
the `chat_data` Docker volume across rebuilds.
