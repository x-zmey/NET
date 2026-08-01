# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev        # Next.js dev server on :3000
npm run build      # prisma generate && next build
npm run lint       # eslint (flat config, eslint.config.mjs)
npx prisma migrate dev --name <name>   # create + apply a migration
npx prisma generate                    # regenerate client into src/generated/prisma
```

There is no test suite in this repo.

Desktop client (Go, in [desktop/](desktop/)):

```bash
cd desktop
go build -ldflags="-s -w -H windowsgui" -o dist/net-windows-amd64.exe .   # Windows
CGO_ENABLED=1 go build -ldflags="-s -w" -o dist/net-linux-amd64 .        # Linux (needs gcc, libgtk-3-dev, libayatana-appindicator3-dev)
```

CI ([.github/workflows/build-desktop.yml](.github/workflows/build-desktop.yml)) builds both binaries on any push touching `desktop/**`. The Windows job runs `go-winres make` to regenerate the `.syso` resource files before building.

## Architecture

One Next.js backend serves three independent clients. The Next.js app is both the API server and the admin console; the extension and desktop app are thin clients that hold an API key and call one endpoint.

**Server** — Next.js 16 App Router, React 19, Tailwind v4, shadcn/base-ui components.

- `POST /api/translate` ([src/app/api/translate/route.ts](src/app/api/translate/route.ts)) is the only public endpoint. Auth is an `x-api-key` header checked against the `ApiKey` table (must exist and be `isActive`). Body: `{ text, history?, variants? }`. `text` is capped at 5000 chars; `variants > 1` (max 5) returns a `translations` array alongside `translated`. Every call — success or failure — writes an `ApiLog` row with input, output, status, and response time.
- `/admin/*` and `/api/admin/*` are gated by [src/middleware.ts](src/middleware.ts), which only checks for the presence of an `admin_token` cookie; the actual JWT verification happens per-route via `getAuthAdmin()` in [src/lib/auth.ts](src/lib/auth.ts). `/api/translate` is explicitly allowlisted in the middleware. When adding an admin route, call `getAuthAdmin()` inside it — do not rely on the middleware alone.
- First login bootstraps the admin: [src/app/api/admin/login/route.ts](src/app/api/admin/login/route.ts) auto-creates an `Admin` from the submitted credentials when the table is empty. There is no separate seed step.
- API keys are minted as `net_<uuid-without-dashes>` in [src/app/api/admin/keys/route.ts](src/app/api/admin/keys/route.ts).

**Prisma** — client output is redirected to [src/generated/prisma/](src/generated/prisma/) (checked in), so import `PrismaClient` from `@/generated/prisma/client`, never from `@prisma/client`. The runtime uses the Neon serverless driver adapter ([src/lib/prisma.ts](src/lib/prisma.ts)) over Postgres. `prisma.config.ts` loads `DATABASE_URL` via dotenv. `dev.db` in the repo root is a leftover from an earlier SQLite setup and is unused.

**Translation** — [src/lib/translate.ts](src/lib/translate.ts) calls an external Claude CLI proxy (`POST /v1/chat`, `Authorization: Bearer <key>`, body `{ prompt, model? }`, returns `{ response }`) via `fetch` — not the Anthropic SDK. The proxy has no `system` parameter, so `askClaude()` prepends the persona prompt to every request and the two translate helpers only build the task portion. Requests are aborted at 180s to match the proxy's own timeout. The system prompt makes the model impersonate a specific persona (senior US dev on Slack) rather than "translate"; changing it changes product behavior. Output must be plain ASCII: the prompt forbids fancy Unicode punctuation *and* `sanitize()` rewrites em/en dashes, curly quotes, ellipsis, bullets, and NBSP as a second line of defense. Keep both in sync — clients paste this text into third-party composers where Unicode punctuation gives away non-human authorship.

**Extension** ([extension/](extension/)) — Firefox-style MV2 using the promise-based `browser.*` API (not `chrome.*` callbacks), scoped to `*://*.upwork.com/*`. A content script watches selections inside ProseMirror composers, shows a floating "EN" button, and replaces the selection via `document.execCommand("insertText")` so the editor's own undo/input handling stays intact. `collectOwnContext()` deliberately reads only the composer's own text as `history` — never other participants' messages. Preserve that boundary. API URL and key live in `browser.storage.local`, set from [extension/popup.js](extension/popup.js).

**Desktop** ([desktop/main.go](desktop/main.go)) — a systray app that polls the clipboard every 300ms. Copying text ending in the trigger `!@#` sends it to the API and writes the result back to the clipboard, flashing the tray icon and firing an OS toast (PowerShell WinRT on Windows, `notify-send` on Linux). Config lives at `~/.native-english-translator.json`; on first run with no `api_key` it writes a stub, opens it in an editor, and exits. Tray icons are generated at runtime as raw ICO bytes by `makeICO()` (with hand-rolled `sin`/`cos` approximations) so the binary ships without asset files.

## Notes

- `.env` holds `DATABASE_URL`, `CLAUDE_PROXY_API_KEY`, and `ADMIN_JWT_SECRET`. Optional: `CLAUDE_PROXY_URL` (defaults to `https://x-zmey.duckdns.org/v1/chat`) and `CLAUDE_PROXY_MODEL` (omitted from the request when unset, letting the proxy pick). `ADMIN_JWT_SECRET` falls back to `"default-secret"` if unset — it must be set in any deployed environment. `ANTHROPIC_API_KEY` is no longer read by the app.
- The deployed API the desktop client defaults to is `https://net-six-ashen.vercel.app/api/translate`.
