# Fleet Command

Fleet Command is a real-time maritime crisis operations system for the Strait of Hormuz scenario. It simulates 15 cargo ships at 1Hz, synchronizes all clients through Socket.IO, supports Command/Captain roles, restricted zones, alerts, directives, distress parsing, weather penalties, and playback snapshots.

## Run Locally

Backend:

```powershell
cd backend
npm install
npm run dev
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open:

- Command: http://localhost:3000/command
- Captain: http://localhost:3000/captain/MV-3
- Backend health: http://localhost:4000/health

## Docker

```powershell
docker compose up --build
```

Services:

- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- Redis: included for compose parity, not required by the in-memory simulator

## Environment Variables

Backend:

```env
PORT=4000
FRONTEND_URL=http://localhost:3000
OPEN_METEO_URL=https://api.open-meteo.com/v1/forecast
DEMO_TIME_SCALE=20
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
```

Frontend:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Deployment

This demo deploys without Clerk or Supabase. Keep all live behavior on the backend simulator and Socket.IO.

### Railway Backend

Create a Railway project from this GitHub repository and set the service root directory to:

```text
backend
```

Railway will use `backend/railway.json`.

Set these Railway environment variables:

```env
NODE_ENV=production
FRONTEND_URL=https://your-vercel-app.vercel.app
AI_PROVIDER=gemini
GEMINI_API_KEY=your_real_gemini_key
GEMINI_MODEL=gemini-1.5-flash
DEMO_TIME_SCALE=20
OPEN_METEO_URL=https://api.open-meteo.com/v1/forecast
```

Do not set `PORT`; Railway provides it automatically.

After deploy, verify:

```text
https://your-railway-backend.up.railway.app/health
https://your-railway-backend.up.railway.app/debug/routes
```

### Vercel Frontend

Create a Vercel project from this GitHub repository and set the project root directory to:

```text
frontend
```

Vercel will use `frontend/vercel.json`.

Set these Vercel environment variables:

```env
NEXT_PUBLIC_BACKEND_URL=https://your-railway-backend.up.railway.app
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_public_token
NEXT_PUBLIC_SITE_URL=https://your-vercel-app.vercel.app
```

Do not put `GEMINI_API_KEY` in Vercel. Gemini is backend-only.

After the Vercel URL is created, copy it into Railway as `FRONTEND_URL` and redeploy/restart the Railway backend so CORS and Socket.IO allow the deployed frontend.

## Demo Flow

1. Open Command and Captain MV-3 side by side.
2. Show all 15 ships moving live from backend state.
3. Click a ship in Command and show cargo, fuel, speed, heading, destination, weather, and status.
4. Draw a restricted zone from Command. The zone appears in Captain, and the backend detects breaches.
5. Send a directive from Command to MV-3.
6. Accept it from the Captain window or escalate distress.
7. Show AI/fallback distress parsing in Command.
8. Drag playback to inspect historical ship positions.

## Assumptions

- The backend is the single source of truth for ships, zones, alerts, directives, weather, and playback.
- `DEMO_TIME_SCALE` accelerates backend simulation time for demos while preserving the 1Hz WebSocket broadcast and backend-owned state. Use `20` for visible ship movement during judging; omit it for real-time movement.
- Weather uses one Open-Meteo point for the whole operational area. If the API fails, adverse weather is enabled so the fuel penalty remains demonstrable.
- Supabase persistence is fire-and-forget and stubbed unless real credentials are configured.
- Claude distress parsing falls back to deterministic keyword parsing if the API key is missing, slow, or rate limited.
- Clerk credentials in this workspace are placeholders, so the demo remains URL-role based until real Clerk keys and public metadata are configured.
