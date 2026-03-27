# EUDIS-Hackathon-CZE

## Scope

This repository contains a **non-weapon** UAV operations software platform.
It is intended for simulation, operator training, contested-environment resilience testing,
and software integration experiments only.

## Repository Stack

This repository is organized around four top-level subprojects:

- `gamified-physical-webapp/`: active TypeScript monorepo for the dashboard, bridge, marketing experience, shared contracts, simulator, and legacy prototype
- `matlab-code-outputs/`: MATLAB simulation, control, and bridge utilities (real quadrotor control/model code)
- `simulink-output-1/`: reserved for Simulink-generated outputs
- `simulink-output-2/`: reserved for additional Simulink-generated outputs

The active application stack lives inside `gamified-physical-webapp/`:

- `gamified-physical-webapp/apps/web`: React + Vite tactical dashboard (desktop/tablet)
- `gamified-physical-webapp/apps/bridge`: Node.js telemetry bridge API for MATLAB integration
- `gamified-physical-webapp/apps/marketing`: React + Vite immersive 3D marketing/demo experience
- `gamified-physical-webapp/packages/shared`: shared data contracts/types used by web and bridge

Core goals:

- MATLAB 3 subprojects
  - telemetry ingestion and visualization
- Collect these data into the operator dashboard
- Cluster-based operator workflow (select locality cluster, then drone)
- Resilience indicators for contested/jammed environments
- Stable contracts for future C2 integration

## MATLAB Subprojects

`matlab-code-outputs/` now contains actual MATLAB-side control and simulation work, not placeholders.

It includes:

- 6-DoF quadrotor simulation entrypoint (`simulateQuadMinimalICAO.m`)
- Control logic building blocks (`ControlSystem.m`, `desiredAttitudeFromAccel.m`, `eulerPDToMoments.m`)
- Linear and nonlinear control allocation (`allocateQuadXLinear.m`, `allocateQuadXNonlinearIterative.m`)
- Rotation/math helpers (`Rx.m`, `Ry.m`, `Rz.m`, `Hat.m`, `Vee.m`)
- UDP/JSON send utility for integration tests (`JSON_Send.m`)
- Bridge diagnostics in `matlab-code-outputs/bridge/` (`interceptor_bridge.c`, compiled receiver, `udp_test.py`)

Use this subproject as the algorithm + controls workspace, then connect produced telemetry to the Node bridge and dashboard in `gamified-physical-webapp/`.

## Contested-Environment Features

Implemented in telemetry contracts and dashboard:

- `GNSS status`: `fix`, `degraded`, `denied`, `spoofing-suspected`
- `C2 link health`: status, latency, packet loss, packet age
- `Navigation source`: GNSS/INS, INS-only, visual odometry, mixed-relative
- Relative tactical mode for GNSS-denied operation
- Safe operation mode flag: `contested-link-safe-mode`

## Quick Start

Requirements:

- Node.js 20+
- npm 9+

Install dependencies:

```bash
npm install
```

Repository layout notes:

- Run root scripts from the repository root
- Daily product work happens in `gamified-physical-webapp/`
- MATLAB handoff artifacts belong in `matlab-code-outputs/`
- The two `simulink-output-*` folders are reserved for generated Simulink deliverables

Run bridge API (terminal 1):

```bash
npm run dev:bridge
```

Run web app (terminal 2):

```bash
npm run dev:web
```

Open: `http://localhost:5173`

## Before MATLAB Is Ready

You can fully prepare and test the platform without MATLAB using a built-in simulator.

Run in 3 terminals:

1. Bridge:

```bash
npm run dev:bridge
```

2. Web dashboard:

```bash
npm run dev:web
```

3. MATLAB-like frame stream:

```bash
npm run sim:matlab
```

Optional simulator parameters:

- `BRIDGE_URL` (default `http://localhost:8787`)
- `CLUSTER_ID` (default `cluster-brno`)
- `DRONE_ID` (default `INT-01`)
- `PERIOD_MS` (default `1000`)

Example:

```bash
BRIDGE_URL=http://localhost:8787 CLUSTER_ID=cluster-vyskov DRONE_ID=INT-14 PERIOD_MS=500 npm run sim:matlab
```

If UI shows "Telemetry not assigned yet":

- Ensure `npm run dev:bridge` is running
- Ensure selected `cluster/drone` matches the stream (`CLUSTER_ID`, `DRONE_ID`)
- Check bottom-right MATLAB Link panel for bridge state and ingest summary

## MATLAB Integration Path

MATLAB should publish normalized telemetry frames to bridge endpoint:

- `POST /api/matlab/frame`

Example payload:

```json
{
	"timestampIso": "2026-03-26T13:30:00.000Z",
	"clusterId": "cluster-brno",
	"droneId": "INT-01",
	"operationMode": "operator-controlled",
	"link": {
		"status": "stable",
		"latencyMs": 38,
		"packetLossPct": 0.2,
		"lastPacketAgeMs": 120
	},
	"navigation": {
		"gnssStatus": "fix",
		"navigationSource": "gnss-ins",
		"imuDriftEstimateM": 0.4,
		"spoofingScore": 0.03
	},
	"batteryPct": 92,
	"speedMps": 22.6,
	"headingDeg": 41.2,
	"position": {
		"lat": 49.1934,
		"lon": 16.6089,
		"altitudeM": 104
	},
	"relativeTrack": {
		"bearingDeg": 33.1,
		"distanceM": 580.5,
		"relativeAltitudeM": 11
	},
	"notes": ["MATLAB frame"]
}
```

The bridge then streams frames to UI via:

- `ws://localhost:8787/ws/telemetry`

## API Overview

- `GET /health`
- `GET /api/clusters`
- `GET /api/drones?clusterId=...`
- `GET /api/telemetry/latest?clusterId=...&droneId=...`
- `POST /api/matlab/frame`
- `GET /api/bridge/status`
- `GET /api/bridge/logs?limit=8`

The web dashboard now includes a bottom-right mini panel with:

- Bridge online/offline state
- MATLAB link freshness (live/idle/disconnected)
- Frame counters (total, MATLAB, simulation)
- A concise ingest log with timestamp, source, drone assignment, link state, and navigation source

## Legacy Prototype

The original static prototype remains in `gamified-physical-webapp/dashboard/` for reference.
Active development should continue in `gamified-physical-webapp/apps/web`, `gamified-physical-webapp/apps/bridge`, and `gamified-physical-webapp/apps/marketing`.