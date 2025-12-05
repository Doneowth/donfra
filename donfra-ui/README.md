# Donfra Landing — SSR build

Next.js app router, Framer Motion accents, and all styling in `/public/styles/main.css`. The app now runs as an SSR server (no `next export`).

## Dev
```bash
npm install
# point the UI to your API/WS if needed:
# export NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api
# export NEXT_PUBLIC_COLLAB_WS=ws://localhost:6789/yjs
npm run dev   # http://localhost:3000
```

## Production build
```bash
npm run build
npm run start   # PORT defaults to 3000
```

## Docker (standalone Next server)
```bash
# Build-time env injects into the client bundle
docker build -t donfra-ui:ssr --build-arg NEXT_PUBLIC_API_BASE_URL=/api .
docker run -p 3000:3000 donfra-ui:ssr
```

## Compose
- `infra/docker-compose.yml`: Caddy fronts everything and proxies `/api` + `/yjs` + `/ws` to backend services; UI runs on port 3000 inside the network.
- `infra/docker-compose.local.yml`: publishes UI to `http://localhost` (80→3000) and bakes host API/WS endpoints into the client bundle.

## Structure
- `app/layout.tsx` links `/styles/main.css`
- `public/styles/main.css` holds all CSS
