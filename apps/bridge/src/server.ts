import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { z } from "zod";
import type { ClusterSummary, DroneSummary, DroneTelemetryFrame } from "@eudis/shared";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const clusters: ClusterSummary[] = [
  { id: "cluster-brno", name: "Brno Sector", locality: "Brno" },
  { id: "cluster-vyskov", name: "Vyskov Sector", locality: "Vyskov" },
  { id: "cluster-olomouc", name: "Olomouc Sector", locality: "Olomouc" },
];

const drones: DroneSummary[] = [
  { id: "INT-01", callsign: "Aegis-01", clusterId: "cluster-brno" },
  { id: "INT-02", callsign: "Aegis-02", clusterId: "cluster-brno" },
  { id: "INT-14", callsign: "Aegis-14", clusterId: "cluster-vyskov" },
  { id: "INT-21", callsign: "Aegis-21", clusterId: "cluster-olomouc" },
];

const frameSchema = z.object({
  timestampIso: z.string(),
  clusterId: z.string(),
  droneId: z.string(),
  operationMode: z.enum(["operator-controlled", "assisted", "contested-link-safe-mode"]),
  link: z.object({
    status: z.enum(["stable", "degraded", "lost"]),
    latencyMs: z.number(),
    packetLossPct: z.number(),
    lastPacketAgeMs: z.number(),
  }),
  navigation: z.object({
    gnssStatus: z.enum(["fix", "degraded", "denied", "spoofing-suspected"]),
    navigationSource: z.enum(["gnss-ins", "ins-only", "visual-odometry", "mixed-relative"]),
    imuDriftEstimateM: z.number(),
    spoofingScore: z.number(),
  }),
  batteryPct: z.number(),
  speedMps: z.number(),
  headingDeg: z.number(),
  position: z
    .object({
      lat: z.number(),
      lon: z.number(),
      altitudeM: z.number(),
    })
    .optional(),
  relativeTrack: z
    .object({
      bearingDeg: z.number(),
      distanceM: z.number(),
      relativeAltitudeM: z.number(),
    })
    .optional(),
  notes: z.array(z.string()).optional(),
});

const frames = new Map<string, DroneTelemetryFrame>();

type IngestSource = "matlab" | "simulation";

interface BridgeLogEntry {
  tsIso: string;
  source: IngestSource;
  clusterId: string;
  droneId: string;
  linkStatus: DroneTelemetryFrame["link"]["status"];
  navSource: DroneTelemetryFrame["navigation"]["navigationSource"];
  message: string;
}

const bridgeStats = {
  totalFrames: 0,
  matlabFrames: 0,
  simulationFrames: 0,
  lastFrameAtIso: "",
  lastMatlabFrameAtIso: "",
  lastAssignedClusterId: "",
  lastAssignedDroneId: "",
};

const bridgeLogs: BridgeLogEntry[] = [];

function appendBridgeLog(source: IngestSource, frame: DroneTelemetryFrame, message: string): void {
  bridgeLogs.unshift({
    tsIso: frame.timestampIso,
    source,
    clusterId: frame.clusterId,
    droneId: frame.droneId,
    linkStatus: frame.link.status,
    navSource: frame.navigation.navigationSource,
    message,
  });
  bridgeLogs.splice(60);
}

function trackIngest(source: IngestSource, frame: DroneTelemetryFrame): void {
  bridgeStats.totalFrames += 1;
  bridgeStats.lastFrameAtIso = frame.timestampIso;
  bridgeStats.lastAssignedClusterId = frame.clusterId;
  bridgeStats.lastAssignedDroneId = frame.droneId;

  if (source === "matlab") {
    bridgeStats.matlabFrames += 1;
    bridgeStats.lastMatlabFrameAtIso = frame.timestampIso;
  } else {
    bridgeStats.simulationFrames += 1;
  }
}

function keyOf(clusterId: string, droneId: string): string {
  return `${clusterId}:${droneId}`;
}

function broadcastFrame(frame: DroneTelemetryFrame): void {
  const payload = JSON.stringify({ type: "telemetry", payload: frame });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "bridge", now: new Date().toISOString() });
});

app.get("/api/clusters", (_req, res) => {
  res.json(clusters);
});

app.get("/api/drones", (req, res) => {
  const clusterId = String(req.query.clusterId || "");
  const result = clusterId ? drones.filter((d) => d.clusterId === clusterId) : drones;
  res.json(result);
});

app.get("/api/telemetry/latest", (req, res) => {
  const clusterId = String(req.query.clusterId || "");
  const droneId = String(req.query.droneId || "");
  const frame = frames.get(keyOf(clusterId, droneId));
  if (!frame) {
    res.status(404).json({ error: "No telemetry frame for selected drone" });
    return;
  }
  res.json(frame);
});

app.get("/api/bridge/status", (_req, res) => {
  res.json({
    wsClients: wss.clients.size,
    ...bridgeStats,
  });
});

app.get("/api/bridge/logs", (req, res) => {
  const limit = Math.max(1, Math.min(25, Number(req.query.limit || 8)));
  res.json(bridgeLogs.slice(0, limit));
});

app.post("/api/matlab/frame", (req, res) => {
  const parsed = frameSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const frame = parsed.data as DroneTelemetryFrame;
  frames.set(keyOf(frame.clusterId, frame.droneId), frame);
  trackIngest("matlab", frame);
  appendBridgeLog("matlab", frame, "Frame accepted from MATLAB ingest endpoint");
  broadcastFrame(frame);
  res.status(202).json({ accepted: true });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws/telemetry" });

wss.on("connection", (socket) => {
  socket.send(JSON.stringify({ type: "hello", payload: { service: "bridge" } }));
});

function seedSimulation(): void {
  const base: DroneTelemetryFrame = {
    timestampIso: new Date().toISOString(),
    clusterId: "cluster-brno",
    droneId: "INT-01",
    operationMode: "operator-controlled",
    link: {
      status: "stable",
      latencyMs: 32,
      packetLossPct: 0.2,
      lastPacketAgeMs: 110,
    },
    navigation: {
      gnssStatus: "fix",
      navigationSource: "gnss-ins",
      imuDriftEstimateM: 0.4,
      spoofingScore: 0.03,
    },
    batteryPct: 94,
    speedMps: 23,
    headingDeg: 44,
    position: {
      lat: 49.1934,
      lon: 16.6089,
      altitudeM: 102,
    },
    relativeTrack: {
      bearingDeg: 30,
      distanceM: 640,
      relativeAltitudeM: 14,
    },
    notes: ["Simulation source: bridge seed"],
  };

  frames.set(keyOf(base.clusterId, base.droneId), base);
  trackIngest("simulation", base);
  appendBridgeLog("simulation", base, "Seed frame emitted by bridge simulator");

  setInterval(() => {
    const prev = frames.get(keyOf(base.clusterId, base.droneId));
    if (!prev) {
      return;
    }

    const jitter = () => (Math.random() - 0.5);
    const latency = Math.max(20, Math.min(400, prev.link.latencyMs + jitter() * 18));
    const packetLoss = Math.max(0, Math.min(40, prev.link.packetLossPct + jitter() * 2));
    const lastPacketAgeMs = Math.max(60, Math.min(1800, prev.link.lastPacketAgeMs + jitter() * 95));

    const linkStatus = lastPacketAgeMs > 1200 ? "lost" : latency > 150 || packetLoss > 8 ? "degraded" : "stable";
    const gnssStatus = packetLoss > 10 ? "degraded" : Math.random() > 0.985 ? "spoofing-suspected" : "fix";
    const navigationSource =
      linkStatus === "lost" || gnssStatus === "spoofing-suspected" ? "mixed-relative" : "gnss-ins";

    const next: DroneTelemetryFrame = {
      ...prev,
      timestampIso: new Date().toISOString(),
      operationMode: linkStatus === "lost" ? "contested-link-safe-mode" : "operator-controlled",
      link: {
        status: linkStatus,
        latencyMs: Number(latency.toFixed(1)),
        packetLossPct: Number(packetLoss.toFixed(2)),
        lastPacketAgeMs: Number(lastPacketAgeMs.toFixed(0)),
      },
      navigation: {
        gnssStatus,
        navigationSource,
        imuDriftEstimateM: Number(Math.max(0.2, prev.navigation.imuDriftEstimateM + jitter() * 0.15).toFixed(2)),
        spoofingScore: Number(Math.max(0, Math.min(1, prev.navigation.spoofingScore + jitter() * 0.08)).toFixed(2)),
      },
      batteryPct: Number(Math.max(0, prev.batteryPct - 0.02).toFixed(2)),
      speedMps: Number(Math.max(8, Math.min(38, prev.speedMps + jitter() * 1.5)).toFixed(2)),
      headingDeg: Number(((prev.headingDeg + jitter() * 5 + 360) % 360).toFixed(1)),
      relativeTrack: prev.relativeTrack
        ? {
            ...prev.relativeTrack,
            bearingDeg: Number(((prev.relativeTrack.bearingDeg + jitter() * 4 + 360) % 360).toFixed(1)),
            distanceM: Number(Math.max(100, prev.relativeTrack.distanceM + jitter() * 26).toFixed(1)),
          }
        : undefined,
      notes: linkStatus === "lost" ? ["Link contested: safe mode active"] : ["Nominal telemetry"],
    };

    frames.set(keyOf(next.clusterId, next.droneId), next);
    trackIngest("simulation", next);
    if (bridgeStats.totalFrames % 3 === 0 || next.link.status !== prev.link.status) {
      appendBridgeLog("simulation", next, "Sim frame emitted");
    }
    broadcastFrame(next);
  }, 1000);
}

seedSimulation();

const port = Number(process.env.PORT || 8787);
server.listen(port, () => {
  console.log(`Bridge running on http://localhost:${port}`);
});
