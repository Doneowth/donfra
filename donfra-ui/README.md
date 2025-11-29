# Donfra Landing — 007 + Defender (Static CSS edition)

**Maintainable & extensible**: all styles live in `/public/styles/main.css`, linked from `app/layout.tsx`.
- Next.js (App Router), static export
- Framer Motion subtle animations
- Dockerized with Nginx

## Dev
```bash
npm install
npm run dev
# http://localhost:3000
```

## Mission GIF/MP4 (optional)
Place media in `public/` (e.g., `public/bond.gif`) and set `BOND_GIF_URL` in `app/page.tsx`.
For MP4, replace `.hero-gif` with a <video> element as described in previous README.

## Build static
```bash
npm run build:static
npm run preview:static
```

## Docker
```bash
docker build -t donfra-landing-007:staticcss .
docker run -p 8080:80 donfra-landing-007:staticcss
```

## Structure
```
├─ app/
│  ├─ layout.tsx   # links /styles/main.css
│  └─ page.tsx     # React + Framer Motion; no inline CSS
├─ public/
│  ├─ styles/
│  │  └─ main.css  # all site styles (variables + layout + components)
│  └─ (put bond.gif/mp4 here)
├─ docker/
│  └─ nginx.conf
├─ Dockerfile
├─ docker-compose.yml
├─ next.config.mjs
└─ package.json
```
