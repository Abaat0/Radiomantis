# Radiomantis chat server

A tiny self-hosted WebSocket chat relay for the site, the backend for the
slide-in chat drawer. One process, one dependency (`ws`). It keeps the last 50 messages in
memory, mirrored to a JSON file so a restart keeps recent history. There is no database and
no accounts; visitors just pick a nickname.

In production it runs as a Docker container on the same `proxy_network` as Nginx Proxy
Manager, which terminates TLS and reverse-proxies `wss://<site>/chat` to it. The container
itself publishes no host port.

## Run locally

```bash
cd server
npm install
node chat.js            # ws://127.0.0.1:8081/chat
```

The frontend auto-detects localhost and connects to `ws://<host>:8081/chat`, so just serve
the site (see the root README) and the drawer will talk to this.

To test moderation locally, start it with a token and open the site with `?admin=<token>`:

```bash
CHAT_ADMIN_TOKEN=some-secret node chat.js
# then browse to  http://localhost:8000/?admin=some-secret
```

### Environment variables

| Var                | Default             | Meaning                                              |
| ------------------ | ------------------- | ---------------------------------------------------- |
| `CHAT_PORT`        | `8081`              | Port to listen on                                    |
| `CHAT_HOST`        | `127.0.0.1`         | Interface to bind (the Docker image sets `0.0.0.0`)  |
| `CHAT_ADMIN_TOKEN` | *(empty)*           | Secret; enables moderator mode. Empty = no admin.    |
| `CHAT_DATA_FILE`   | `./data/chat.json`  | History + ban-list persistence path                  |

## Moderation

A visitor becomes a moderator by loading the site once with `?admin=<CHAT_ADMIN_TOKEN>`
(the frontend stores it for the session and passes it to the socket as `?token=`). A
moderator can type:

- `/clear` — wipe history for everyone
- `/kick <nick>` — disconnect everyone using that nick
- `/ban <nick>` — disconnect + ban their IP (persisted in the data file)

There is no channel-op system; you are the moderator. Keep the `?admin=` URL private — the
token rides in it.

## Built-in guards

- The client renders every message with `textContent` (never `innerHTML`), so messages
  cannot inject markup or scripts. The server also strips control characters.
- 500-char message cap, 24-char nick cap.
- Rate limit: ~5 messages / 5 seconds per connection.
- Client IP is read from the proxy's `X-Forwarded-For` header (used for bans).
- The container binds `0.0.0.0` but publishes no host port, so it's reachable only from the
  internal Docker network, not the public internet.

## Deploy (Docker, alongside Nginx Proxy Manager)

NPM runs in a container, so it **cannot** reach a chat server on the host's `127.0.0.1`.
The chat therefore runs as its own container on the shared external `proxy_network`, and
NPM proxies to it by its address on that network — exactly like AzuraCast.

1. Make sure the deploy user can run Docker without sudo (one-time):
   ```bash
   sudo usermod -aG docker <user>   # then log out and back in
   ```
2. Build + start the container (the GitHub Action does this automatically on every push;
   to do it by hand):
   ```bash
   cd ~/website/server
   docker compose up -d --build
   ```
   Set your real token in `docker-compose.yml` (`CHAT_ADMIN_TOKEN`). The container joins
   `proxy_network` as `radiomantis-chat` and listens on `8081`.
3. Find its address on `proxy_network`:
   ```bash
   docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' radiomantis-chat
   ```
4. In Nginx Proxy Manager, edit the website proxy host → **Advanced** tab, and add a
   location **block** next to the existing `location / { ... }` (do *not* use the Custom
   Locations tab — with a custom `location /` block it generates a config nginx rejects):
   ```nginx
   location /chat {
       proxy_pass http://172.19.0.X:8081;   # the IP from step 3
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $remote_addr;
   }
   ```
   No trailing slash on `proxy_pass` — the server listens on exactly `/chat`.

History + bans persist in the `chat_data` Docker volume across rebuilds. If you recreate the
container and its `proxy_network` IP changes, update the IP in step 4.
