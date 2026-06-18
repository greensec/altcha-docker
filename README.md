<img src="./logo-black.altcha.svg" alt="ALTCHA" width="240" />

# ALTCHA Docker

A lightweight Dockerized ALTCHA challenge/verify service built with Bun + Express. It exposes simple endpoints to generate ALTCHA challenges and verify solutions, and includes a separate demo UI container.

- Runtime: Bun
- Ports: 3000 (API), 8080 (demo)
- Upstream libs: altcha, altcha-lib

## Quick start

Use Docker Compose (recommended):

```bash
# Optionally create a .env file (see below) or set variables in your shell
[ -f .env ] || cp .env.example .env
# Start the API only (production default)
docker compose up --build
```

- API: http://localhost:3000

To also start the demo service, add the `demo` profile:

```bash
docker compose --profile demo up --build
```

- Demo: http://localhost:8080

To start the API with a Valkey-backed replay store, add the `redis` profile and set `REDIS_URL`:

```bash
REDIS_URL=redis://valkey:6379 docker compose --profile redis up --build
```

To override the secret temporarily:

```bash
ALTCHA_HMAC_SECRET="your-very-long-random-key" docker compose up --build
```

## Configuration

The API service reads the following environment variables:

- SECRET (required): HMAC key used to sign/verify challenges. The API app requires this container/runtime value. Docker Compose maps `ALTCHA_HMAC_SECRET` to container `SECRET` and supplies `$ecret.key` only as a local testing fallback when `ALTCHA_HMAC_SECRET` is unset; don’t use it in production.
- PORT: API port, default 3000.
- EXPIREMINUTES: Challenge expiry in minutes, default 10.
- MAXRECORDS: Size of in‑memory single‑use token cache, default 1000.
- CORS_ORIGIN: Allowed CORS origin(s), default *. Use comma-separated values for multiple origins.
- ALGORITHM: ALTCHA v2 algorithm, default PBKDF2/SHA-256.
- MAXNUMBER: ALTCHA v2 proof-of-work cost (difficulty), default 5000.
- REDIS_URL (optional): Redis or Valkey URL for a shared replay-store backend. When set, the API uses Redis instead of the in-memory cache. Example: `redis://valkey:6379`.

Docker Compose also reads the following image overrides:

- `API_IMAGE` (optional): Image used for the server service. Default: `ghcr.io/greensec/altcha-docker:main`. Set this to use a custom build or a different tag.
- `DEMO_IMAGE` (optional): Image used for the demo service. Default: `ghcr.io/greensec/altcha-docker-demo:main`.

### Generating a secret

Generate a strong HMAC secret with at least 32 characters:

```bash
# Linux / macOS (OpenSSL)
openssl rand -base64 48

# Or with /dev/urandom
tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 48; echo
```

Copy the output into `.env` as `ALTCHA_HMAC_SECRET` (or `SECRET` for direct Bun runs).

The demo service reads the following environment variables:

- API_BASE_URL: Base API URL used by the demo to proxy `GET /challenge` and verify demo form submissions from `POST /test`, default http://server:3000 in Docker Compose.
- DEMO_PORT: Demo HTTP port, default 8080.

You can provide variables via:

- .env file in the project root (Docker Compose reads it automatically)
- compose.yaml environment section
- Directly in your shell

Example .env:

```env
ALTCHA_HMAC_SECRET=change-me-to-a-long-random-string
# Direct Bun/API runtime only:
SECRET=change-me-to-a-long-random-string
PORT=3000
EXPIREMINUTES=10
MAXRECORDS=1000
CORS_ORIGIN=*
ALGORITHM=PBKDF2/SHA-256
MAXNUMBER=5000
API_BASE_URL=http://server:3000
DEMO_PORT=8080
```

## Migration note (demo container)

- `DEMO=true` no longer starts the demo UI inside the API container.
- Use the separate `demo` service in Docker Compose, or build/run the Dockerfile `demo` target.

## Migration note (COST -> MAXNUMBER)

- `MAXNUMBER` is now the preferred environment variable for ALTCHA v2 proof-of-work difficulty.
- Existing setups using `COST` still work for backward compatibility.
- If both are set, `MAXNUMBER` takes precedence.

Recommended update for existing deployments:

```env
# old
# COST=5000

# new
MAXNUMBER=5000
```

## Endpoints

- GET /

  - Returns 204 No Content. Liveness probe endpoint.

- GET /challenge

  - Returns a signed ALTCHA challenge JSON produced by altcha-lib.
  - 200 OK with challenge payload.

- GET /verify?altcha=<payload>
  - Verifies the provided ALTCHA solution via query string.
  - 202 Accepted on success.
  - 417 Expectation Failed on failure or when a token is reused (single-use enforced with an in-memory cache).

- POST /verify
  - Verifies the provided ALTCHA solution via JSON body (`{ "altcha": string }`).
  - 202 Accepted on success.
  - 417 Expectation Failed on failure or reuse.

Notes:

- CORS is open (origin: \*).
- Record reuse protection is best-effort and stored in-memory; scale-out or restarts will reset the cache. For production, pair with a shared store or upstream protections as needed.
- **Security note:** `GET /verify?altcha=<payload>` sends the ALTCHA payload in the query string. Query parameters may be logged by reverse proxies, load balancers, and browser history. For privacy-sensitive integrations, consider implementing a `POST /verify` wrapper that accepts the payload in the request body instead.

## Demo UI

Docker Compose starts a dedicated demo service at http://localhost:8080. The demo serves `/`, exposes `GET /challenge` for the widget and proxies it to API `/challenge`, and accepts the demo form at `POST /test`, which calls API `/verify` through the same `API_BASE_URL` target. The demo does not expose a public `/verify` route.

## Client integration example

Add the widget to your form and point challengeurl at this service:

```html
<script async defer src="https://cdn.jsdelivr.net/gh/altcha-org/altcha@v3.1.0/dist/altcha.min.js" type="module"></script>
<form action="/your-submit" method="POST">
  <input name="email" placeholder="Email" />
  <altcha-widget challengeurl="http://localhost:3000/challenge"></altcha-widget>
  <button>Submit</button>
  <!-- On submit, include the `altcha` field value in your request body -->
  <!-- Example server should call GET /verify?altcha=... and accept 202 as success -->
  <!-- 417 means invalid or reused token -->
</form>
```

Test verification manually:

```bash
# Assuming $payload contains the exact `altcha` value from the client
curl -G \
  --data-urlencode "altcha=$payload" \
  http://localhost:3000/verify -i
```

Expect 202 on success or 417 on failure/reuse.

## Building and running without Docker

You can run locally with Bun (requires Bun installed):

```bash
bun install
bun run build
bun start
```

Or for live reload during development:

```bash
bun run dev
```

## Production notes

- Change `ALTCHA_HMAC_SECRET` for Docker Compose, or `SECRET` for direct API/container runtime, to a strong unique value. Never use the default.
- Do not bake `.env` files or secrets into images; provide runtime environment variables from Compose, your orchestrator, or a secret manager.
- Consider terminating TLS in front of the container and restricting access to /verify if needed.
- **Warning:** In-memory replay protection is single-instance only and is cleared on every container restart. Any routine deploy or crash recovery silently opens a replay window for recently-issued challenges. For production, set `REDIS_URL` to use a shared Redis or Valkey backend, or pair with upstream protections.
- Pin image versions and consider multi-arch builds if deploying across architectures.
- Both the `api` and `demo` Dockerfile stages include a `HEALTHCHECK` for orchestrator-level health detection.
- The API container handles `SIGTERM`/`SIGINT` gracefully, draining active connections before exit.

## License

Licensed under the [MIT License](LICENSE).

❤️ made with passion in Erlangen by Umami Creative GmbH
