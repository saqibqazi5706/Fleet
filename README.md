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
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
```

Frontend:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

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
- Weather uses one Open-Meteo point for the whole operational area. If the API fails, adverse weather is enabled so the fuel penalty remains demonstrable.
- Supabase persistence is fire-and-forget and stubbed unless real credentials are configured.
- Claude distress parsing falls back to deterministic keyword parsing if the API key is missing, slow, or rate limited.
- Clerk credentials in this workspace are placeholders, so the demo remains URL-role based until real Clerk keys and public metadata are configured.
