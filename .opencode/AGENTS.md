# AGENTS.md

Local single-user guitar scale finder: React 18 + Vite frontend (entire UI in `src/App.jsx`, one component, no router/state library) + minimal Express backend (`server/index.js`) that reads/writes `data/scales.json`. No database, no auth.

## Commands

- `npm install` once — `install.ps1`/`install.sh` are just wrappers around it; `run.ps1`/`run.sh` are wrappers around `npm run dev` + browser open.
- `npm run dev` — starts both processes via concurrently: Express on :4001, Vite on :5173 (Vite proxies `/api` → :4001). The app needs both running.
- `npm run build` + `npm run preview` — preview serves the static build but does **not** start the backend; persistence is dead unless you also run `npm run server`.
- No tests, no linter, no typechecker, no CI. `npm run build` is the only automated verification available.

## Gotchas

- Root `"type": "module"` — server code uses ESM `import` syntax.
- `data/scales.json` is runtime user data, seeded from `server/defaultScales.js` on first `GET /api/scales` only if the file is missing. DEVELOPER.md says "non versionare", but the file **is currently tracked in git** and has no `.gitignore`: it will show as modified whenever the dev server runs. Don't commit those changes unless intentional.
- Editing `server/defaultScales.js` only affects fresh installs (missing data file); existing installs keep their own file.
- API is only `GET`/`POST /api/scales` — POST replaces the whole file (deliberate: no merge logic). Any UI mutation must build the complete array and call `persistScales(next)` in `App.jsx` (optimistic update + full-array POST).
- Server validation is only `Array.isArray`; real validation (contains 0, range 0–11, no dups) lives client-side in `validateIntervals()` in `App.jsx` — new import paths must reuse it.
- UI strings, comments, and API error messages are in Italian; keep new ones consistent.

## Reference

`DEVELOPER.md` is the real technical doc (data flow, scale schema, extension recipes). Read it before changing `App.jsx` or the server. `README.md` is end-user install/run docs, not dev guidance.
