# DS‑Online

Browser‑based dental 3D slicer.

## Tech Stack

- Vue 3 + Vite 6, Vue Router, Pinia
- Three.js (`src/three`) with managers for selection, mesh, slicing, supports, hollowing
- PrimeVue + Tailwind CSS for UI
- Web workers + WASM (`src/workers`, `src/three/wasm/**`) for slicing
- Axios clients for API and UDP print service integration

## Getting Started

1) Install dependencies

```sh
npm install
```

2) Set environment variables (optional for local dev)

Create a `.env.local` with values as needed:

```ini
# DB-backed API origin.
# Auth/account endpoints are called as /v1/... from this origin.
VITE_DB_API_ORIGIN=http://localhost:3000

# Slicer backend origin.
# Slicing calls append /api/v2/... or /api/jobs/... to this origin.
VITE_SLICER_API_ORIGIN=http://127.0.0.1:5179

# Legacy slicing v2 client base.
# Only needed by src/axios/sliceApis.js.
VITE_SLICER_V2_API_BASE_URL=http://127.0.0.1:5179/api/v2

# UDP printer service base used by the dashboard (see Print Service below)
VITE_UDP_API_BASE_URL=http://localhost:5180/api/v1/printers

# Default UI locale code (en|jp|tw|cn)
VITE_DEFAULT_LOCALE=en
```

3) Run the app (with cross‑origin isolation headers enabled for WASM)

```sh
npm run dev
```

Vite dev server is configured to send COOP/COEP headers required for certain WASM/worker features. Visit the printed URL (typically `http://localhost:5173`).

## Build & Preview

```sh
npm run build
npm run preview
```

If you deploy behind your own server, ensure COOP/COEP headers are set so SharedArrayBuffer/WebAssembly features work:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Example (Nginx):

```
add_header Cross-Origin-Opener-Policy same-origin always;
add_header Cross-Origin-Embedder-Policy require-corp always;
```

## Testing & Linting

- Unit tests (Vitest):

```sh
npm run test:unit
```

- E2E (Cypress):

```sh
# Fast dev mode
npm run test:e2e:dev

# Against production preview
npm run build
npm run test:e2e
```

- Lint (ESLint):

```sh
npm run lint
```
