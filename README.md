# Creator Card Microservice

A REST API for managing shareable **Creator Cards** (profile cards with links and service rates),
built on the [`the17thstudio/node-template`](https://github.com/the17thstudio/node-template)
following its service → repository → endpoint conventions.

- **Stack:** Node.js · Express · MongoDB (Mongoose, paranoid soft-delete) · vanilla JavaScript
- **No authentication. No URL versioning** — endpoints live at the root.

> The template ships an example `assessment.md` describing a *different, older* task
> (a payment-instruction parser). It has been removed from this repo to avoid confusion —
> the implemented task is the **Creator Card Microservice**.

## Endpoints

| Method & path | Purpose | Success |
|---|---|---|
| `POST /creator-cards` | Create a card (validated) | `200` · "Creator Card Created Successfully." · `access_code` **included** |
| `GET /creator-cards/:slug` | Public retrieval with access control | `200` · "Creator Card Retrieved Successfully." · `access_code` **omitted** |
| `DELETE /creator-cards/:slug` | Soft-delete by slug (owner-verified) | `200` · "Creator Card Deleted Successfully." · `access_code` **included**, `deleted` set |

### Response envelopes
```jsonc
// success
{ "status": "success", "message": "...", "data": { /* card */ } }
// error
{ "status": "error", "message": "...", "code": "SL02" }
```

### Error codes
| Code | HTTP | Trigger |
|---|---|---|
| `SL02` | 400 | Slug already taken |
| `AC01` | 400 | `access_type` private but `access_code` missing |
| `AC05` | 400 | `access_code` set on a public card |
| `NF01` | 404 | Card not found (or soft-deleted) |
| `NF02` | 404 | Card exists but is a `draft` |
| `AC03` | 403 | Private card accessed without an `access_code` |
| `AC04` | 403 | Private card accessed with the wrong `access_code` |

Field-level validation failures (type / length / enum / required, plus charset, integer and
URL-scheme checks) return **HTTP 400** via the template's VSL validator / manual rules, with no custom code.

`GET` applies the access ladder in order (first match wins): `NF01 → NF02 → AC03 → AC04 → 200`.

## Project layout (additions to the template)

```
endpoints/creator-card/         POST / GET / DELETE handlers
services/creator-card/          create / get / delete services + utils:
  ├─ create-creator-card.js       validate → assert rules → resolve slug → create → serialize
  ├─ get-creator-card.js          access ladder NF01→NF02→AC03→AC04→200
  ├─ delete-creator-card.js       owner-verified soft-delete, reads back real deleted timestamp
  ├─ assert-card-rules.js         business rules VSL cannot express (AC01/AC05/charset/scheme/integer)
  ├─ serialize-card.js            _id→id, deleted 0→null, access_code in/out
  └─ generate-slug.js             slug auto-generation + uniqueness suffix
models/creator-card.js          Mongoose model (paranoid, ULID _id)
repository/creator-card/         repositoryFactory('CreatorCard')
messages/creator-card.js         message strings + the seven business codes
specs/creator-card/              VSL documentation specs (data + endpoints)
test/creator-card/              endpoint tests (mock-server + model stubs)
```

## The one deliberate deviation — surfacing a flat error `code`

The assessment requires a flat top-level `code` on error responses
(`{ "status":"error", "message":"...", "code":"SL02" }`). The template's error path
(`core/express/server.js`) emits `{ status, message, errors?, data? }` and exposes **no** hook to
inject a top-level `code` (`onResponseEnd` runs *after* the response is sent; middlewares run before
the handler). Surfacing it requires a **minimal, additive, backward-compatible** patch to two core files:

1. **`core/errors/app-error.js`** — carry an optional `options.code` onto the error object.
2. **`core/express/server.js`** — emit `body.code = error.isApplicationError ? error.code : undefined`
   in the existing error `catch` block.

When no `code` is supplied, behaviour is byte-identical to the stock template. The internal `errorCode`
still drives the HTTP status (`VALIDATION_ERROR`→400 by fallthrough, `INVALID_REQUEST`→403,
`RESOURCE_NOT_FOUND`→404); the new `code` carries the business string independently. Both patches are
short, commented, and guarded against leaking native error codes.

## Data model (summary)

`id` (ULID, stored as `_id`, exposed as `id`) · `title` (3–100) · `description?` (≤500) ·
`slug` (5–50, `[a-zA-Z0-9_-]`, unique, auto-generated) · `creator_reference` (exactly 20) ·
`links?` (`[{ title 1–100, url http(s):// ≤200 }]`) ·
`service_rates?` (`{ currency NGN|USD|GBP|GHS, rates[] non-empty { name 3–100, description? ≤250, amount ≥1 integer (minor units) } }`) ·
`status` (`draft|published`) · `access_type` (`public|private`, default `public`) ·
`access_code?` (exactly 6 alphanumeric; required iff private) ·
`created` / `updated` (Unix ms) · `deleted` (Unix ms or `null`; soft-delete).

## Setup

```bash
npm install
cp .env.example .env       # set MONGODB_URI (Atlas free tier is fine) and PORT
npm start                  # node bootstrap.js
```

**Environment variables:** only `MONGODB_URI` and `PORT` are required. Redis/JWT/email vars are unused.
Do **not** set `USE_MOCK_MODEL` in a real deployment.

## Tests

```bash
npm test
```

Runs the Mocha suite with `USE_MOCK_MODEL=1` (no real MongoDB needed — the template's in-memory model
stubs are used). Tests drive the **real** Express request lifecycle through `@app-core/mock-server`, so
the full response envelope, HTTP-status mapping and the error-`code` patch are all exercised end to end.
Coverage: happy paths for all three endpoints, every one of the seven error codes, field-level
validation (400), and round-trips of `description` / `links` / `service_rates`.

## Deployment (Heroku / Render)

- `Procfile`: `web: node bootstrap.js` (unchanged).
- Set `MONGODB_URI` and `PORT` (platform-injected). Leave Redis/queue vars unset.
- Endpoints are served at the **root** — submit the **bare base URL** (no `/v1`, no path prefix).
  Graders test e.g. `POST https://<your-app>/creator-cards`.

## Docker

A production `Dockerfile` is included (Node 20, production deps only, non-root user).

```bash
# build
docker build -t creator-card-service .

# run (pass your MongoDB connection string; the platform/host provides PORT)
docker run --rm -p 8811:8811 \
  -e MONGODB_URI="mongodb+srv://user:pass@cluster/db" \
  -e PORT=8811 \
  creator-card-service
```

The container starts `node bootstrap.js`, which reads env, connects to `MONGODB_URI`,
and serves the three endpoints at the root. `.env` is excluded from the image
(`.dockerignore`) — provide secrets via `-e`/platform env, never bake them in.
Render and Heroku can both build straight from this `Dockerfile`.
