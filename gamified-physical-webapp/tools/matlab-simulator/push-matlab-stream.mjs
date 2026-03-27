#!/usr/bin/env node

const BRIDGE_URL = process.env.BRIDGE_URL || "http://localhost:8787";
const CLUSTER_ID = process.env.CLUSTER_ID || "cluster-brno";
const DRONE_ID = process.env.DRONE_ID || "INT-01";
const PERIOD_MS = Number(process.env.PERIOD_MS || 1000);

if (!Number.isFinite(PERIOD_MS) || PERIOD_MS < 200) {
  console.error("PERIOD_MS must be a number >= 200");
  process.exit(1);
}

const state = {
  speedMps: 22.5,
  headingDeg: 42,
  batteryPct: 95,
  latencyMs: 34,
  packetLossPct: 0.2,
  lastPacketAgeMs: 120,
  imuDriftEstimateM: 0.4,
  spoofingScore: 0.04,
  lat: 49.1934,
  lon: 16.6089,
  altitudeM: 106,
  relativeBearingDeg: 31,
  distanceM: 590,
  relativeAltitudeM: 13,
};

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function buildFrame() {
  state.speedMps = clamp(state.speedMps + rand(-0.9, 0.9), 10, 38);
  state.headingDeg = (state.headingDeg + rand(-4, 4) + 360) % 360;
  state.batteryPct = clamp(state.batteryPct - 0.03, 0, 100);

  state.latencyMs = clamp(state.latencyMs + rand(-14, 18), 20, 260);
  state.packetLossPct = clamp(state.packetLossPct + rand(-0.5, 0.7), 0, 20);
  state.lastPacketAgeMs = clamp(state.lastPacketAgeMs + rand(-30, 120), 60, 1800);

  state.imuDriftEstimateM = clamp(state.imuDriftEstimateM + rand(-0.08, 0.09), 0.2, 6);
  state.spoofingScore = clamp(state.spoofingScore + rand(-0.05, 0.06), 0, 1);

  state.relativeBearingDeg = (state.relativeBearingDeg + rand(-2.6, 2.6) + 360) % 360;
  state.distanceM = clamp(state.distanceM + rand(-16, 14), 100, 1200);

  let linkStatus = "stable";
  if (state.lastPacketAgeMs > 1200 || state.packetLossPct > 10) {
    linkStatus = "lost";
  } else if (state.latencyMs > 140 || state.packetLossPct > 4) {
    linkStatus = "degraded";
  }

  let gnssStatus = "fix";
  if (state.spoofingScore > 0.7) {
    gnssStatus = "spoofing-suspected";
  } else if (state.packetLossPct > 5) {
    gnssStatus = "degraded";
  }

  const navigationSource =
    linkStatus === "lost" || gnssStatus === "spoofing-suspected" ? "mixed-relative" : "gnss-ins";

  return {
    timestampIso: new Date().toISOString(),
    clusterId: CLUSTER_ID,
    droneId: DRONE_ID,
    operationMode: linkStatus === "lost" ? "contested-link-safe-mode" : "operator-controlled",
    link: {
      status: linkStatus,
      latencyMs: Number(state.latencyMs.toFixed(1)),
      packetLossPct: Number(state.packetLossPct.toFixed(2)),
      lastPacketAgeMs: Number(state.lastPacketAgeMs.toFixed(0)),
    },
    navigation: {
      gnssStatus,
      navigationSource,
      imuDriftEstimateM: Number(state.imuDriftEstimateM.toFixed(2)),
      spoofingScore: Number(state.spoofingScore.toFixed(2)),
    },
    batteryPct: Number(state.batteryPct.toFixed(2)),
    speedMps: Number(state.speedMps.toFixed(2)),
    headingDeg: Number(state.headingDeg.toFixed(1)),
    position: {
      lat: state.lat,
      lon: state.lon,
      altitudeM: Number(state.altitudeM.toFixed(1)),
    },
    relativeTrack: {
      bearingDeg: Number(state.relativeBearingDeg.toFixed(1)),
      distanceM: Number(state.distanceM.toFixed(1)),
      relativeAltitudeM: Number(state.relativeAltitudeM.toFixed(1)),
    },
    notes: ["Synthetic MATLAB-like stream"],
  };
}

async function sendFrame() {
  const frame = buildFrame();
  const res = await fetch(`${BRIDGE_URL}/api/matlab/frame`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(frame),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Bridge responded ${res.status}: ${txt}`);
  }

  return frame;
}

console.log(`MATLAB simulator -> ${BRIDGE_URL}/api/matlab/frame`);
console.log(`cluster=${CLUSTER_ID} drone=${DRONE_ID} period=${PERIOD_MS}ms`);

const interval = setInterval(async () => {
  try {
    const frame = await sendFrame();
    console.log(`${new Date().toLocaleTimeString()} sent frame for ${frame.droneId} (${frame.clusterId})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${new Date().toLocaleTimeString()} send failed: ${msg}`);
  }
}, PERIOD_MS);

process.on("SIGINT", () => {
  clearInterval(interval);
  console.log("\nMATLAB simulator stopped.");
  process.exit(0);
});
