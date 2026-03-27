import { useEffect, useMemo, useState } from "react";
import type { ClusterSummary, DroneSummary, DroneTelemetryFrame, GnssStatus, LinkStatus } from "@eudis/shared";

const BRIDGE_BASE_URL = "http://localhost:8787";

interface BridgeStatus {
  wsClients: number;
  totalFrames: number;
  matlabFrames: number;
  simulationFrames: number;
  lastFrameAtIso: string;
  lastMatlabFrameAtIso: string;
  lastAssignedClusterId: string;
  lastAssignedDroneId: string;
}

interface BridgeLogEntry {
  tsIso: string;
  source: "matlab" | "simulation";
  clusterId: string;
  droneId: string;
  linkStatus: "stable" | "degraded" | "lost";
  navSource: "gnss-ins" | "ins-only" | "visual-odometry" | "mixed-relative";
  message: string;
}

function statusTone(status: GnssStatus | LinkStatus): "ok" | "warn" | "bad" {
  if (status === "fix" || status === "stable") {
    return "ok";
  }
  if (status === "degraded") {
    return "warn";
  }
  return "bad";
}

export function App() {
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [drones, setDrones] = useState<DroneSummary[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<string>("");
  const [selectedDroneId, setSelectedDroneId] = useState<string>("");
  const [frame, setFrame] = useState<DroneTelemetryFrame | null>(null);
  const [relativeMode, setRelativeMode] = useState<boolean>(false);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);
  const [bridgeLogs, setBridgeLogs] = useState<BridgeLogEntry[]>([]);
  const [bridgeReachable, setBridgeReachable] = useState<boolean>(false);

  useEffect(() => {
    fetch(`${BRIDGE_BASE_URL}/api/clusters`)
      .then((res) => res.json())
      .then((data: ClusterSummary[]) => {
        setClusters(data);
        if (data[0]) {
          setSelectedClusterId(data[0].id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    let mounted = true;

    const refreshBridgeMeta = async () => {
      try {
        const [statusRes, logsRes] = await Promise.all([
          fetch(`${BRIDGE_BASE_URL}/api/bridge/status`),
          fetch(`${BRIDGE_BASE_URL}/api/bridge/logs?limit=8`),
        ]);

        if (!statusRes.ok || !logsRes.ok) {
          throw new Error("Bridge metadata fetch failed");
        }

        const statusData = (await statusRes.json()) as BridgeStatus;
        const logsData = (await logsRes.json()) as BridgeLogEntry[];

        if (!mounted) {
          return;
        }

        setBridgeStatus(statusData);
        setBridgeLogs(logsData);
        setBridgeReachable(true);

        if (!selectedClusterId && statusData.lastAssignedClusterId) {
          setSelectedClusterId(statusData.lastAssignedClusterId);
        }
      } catch {
        if (mounted) {
          setBridgeReachable(false);
        }
      }
    };

    void refreshBridgeMeta();
    const intervalId = window.setInterval(refreshBridgeMeta, 2500);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [selectedClusterId]);

  useEffect(() => {
    if (!selectedClusterId) {
      return;
    }

    fetch(`${BRIDGE_BASE_URL}/api/drones?clusterId=${selectedClusterId}`)
      .then((res) => res.json())
      .then((data: DroneSummary[]) => {
        setDrones(data);
        setSelectedDroneId(data[0]?.id || "");
      })
      .catch(console.error);
  }, [selectedClusterId]);

  useEffect(() => {
    if (!selectedClusterId || !selectedDroneId) {
      return;
    }

    fetch(`${BRIDGE_BASE_URL}/api/telemetry/latest?clusterId=${selectedClusterId}&droneId=${selectedDroneId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DroneTelemetryFrame | null) => {
        if (data) {
          setFrame(data);
        }
      })
      .catch(console.error);

    const ws = new WebSocket(`${BRIDGE_BASE_URL.replace("http", "ws")}/ws/telemetry`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as { type: string; payload?: DroneTelemetryFrame };
      if (data.type !== "telemetry" || !data.payload) {
        return;
      }

      if (data.payload.clusterId === selectedClusterId && data.payload.droneId === selectedDroneId) {
        setFrame(data.payload);
      }
    };

    return () => ws.close();
  }, [selectedClusterId, selectedDroneId]);

  const relativeText = useMemo(() => {
    if (!frame?.relativeTrack) {
      return "No relative track data.";
    }

    const { bearingDeg, distanceM, relativeAltitudeM } = frame.relativeTrack;
    return `Bearing ${bearingDeg.toFixed(1)}°, distance ${distanceM.toFixed(1)} m, altitude delta ${relativeAltitudeM.toFixed(1)} m`;
  }, [frame]);

  const matlabLinkLabel = useMemo(() => {
    if (!bridgeStatus?.lastMatlabFrameAtIso) {
      return { text: "No MATLAB frames yet", tone: "warn" as const };
    }

    const ageMs = Date.now() - new Date(bridgeStatus.lastMatlabFrameAtIso).getTime();
    if (ageMs < 6000) {
      return { text: "Live", tone: "ok" as const };
    }
    if (ageMs < 20000) {
      return { text: "Idle", tone: "warn" as const };
    }
    return { text: "Disconnected", tone: "bad" as const };
  }, [bridgeStatus]);

  const bridgeConnectionLabel = bridgeReachable ? "Online" : "Offline";

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Contested Environment Console</p>
          <h1>UAV Ops Dashboard</h1>
        </div>
        <div className="selectors">
          <label>
            Operator cluster
            <select value={selectedClusterId} onChange={(e) => setSelectedClusterId(e.target.value)}>
              {clusters.map((cluster) => (
                <option key={cluster.id} value={cluster.id}>
                  {cluster.name} ({cluster.locality})
                </option>
              ))}
            </select>
          </label>
          <label>
            Drone
            <select value={selectedDroneId} onChange={(e) => setSelectedDroneId(e.target.value)}>
              {drones.map((drone) => (
                <option key={drone.id} value={drone.id}>
                  {drone.callsign}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <main className="grid">
        {!frame ? (
          <section className="panel empty-telemetry">
            <h2>Telemetry not assigned yet</h2>
            <p>
              Bridge is <strong>{bridgeConnectionLabel}</strong>. Select cluster and drone, then ensure bridge is running and sending frames.
            </p>
            <p>
              Selected route: <strong>{selectedClusterId || "-"}</strong> / <strong>{selectedDroneId || "-"}</strong>
            </p>
          </section>
        ) : (
          <>
          <section className="panel">
            <h2>Resilience Indicators</h2>
            <div className="status-grid">
              <div className={`status ${statusTone(frame.link.status)}`}>
                <span>C2 Link</span>
                <strong>{frame.link.status}</strong>
                <small>{frame.link.latencyMs} ms latency, {frame.link.packetLossPct}% loss</small>
              </div>
              <div className={`status ${statusTone(frame.navigation.gnssStatus)}`}>
                <span>GNSS Status</span>
                <strong>{frame.navigation.gnssStatus}</strong>
                <small>Spoof score {frame.navigation.spoofingScore}</small>
              </div>
              <div className="status neutral">
                <span>Navigation Source</span>
                <strong>{frame.navigation.navigationSource}</strong>
                <small>IMU drift est. {frame.navigation.imuDriftEstimateM} m</small>
              </div>
              <div className="status neutral">
                <span>Operation Mode</span>
                <strong>{frame.operationMode}</strong>
                <small>Last packet age: {frame.link.lastPacketAgeMs} ms</small>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="row">
              <h2>Tactical View</h2>
              <button onClick={() => setRelativeMode((v) => !v)}>
                {relativeMode ? "Switch to absolute" : "Switch to relative"}
              </button>
            </div>

            {relativeMode ? (
              <div className="view-box">
                <p className="view-title">Relative mode (GNSS-denied friendly)</p>
                <p>{relativeText}</p>
              </div>
            ) : (
              <div className="view-box">
                <p className="view-title">Absolute position</p>
                <p>
                  {frame.position
                    ? `${frame.position.lat.toFixed(5)}, ${frame.position.lon.toFixed(5)} @ ${frame.position.altitudeM.toFixed(1)} m`
                    : "No absolute position available"}
                </p>
              </div>
            )}
          </section>

          <section className="panel">
            <h2>Flight Telemetry</h2>
            <ul className="kv">
              <li><span>Drone</span><strong>{frame.droneId}</strong></li>
              <li><span>Battery</span><strong>{frame.batteryPct.toFixed(2)}%</strong></li>
              <li><span>Speed</span><strong>{frame.speedMps.toFixed(2)} m/s</strong></li>
              <li><span>Heading</span><strong>{frame.headingDeg.toFixed(1)}°</strong></li>
              <li><span>Timestamp</span><strong>{new Date(frame.timestampIso).toLocaleTimeString()}</strong></li>
            </ul>
          </section>

          <section className="panel">
            <h2>System Notes</h2>
            <ul className="notes">
              {(frame.notes || []).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
          </>
        )}
      </main>

      <aside className="matlab-mini">
        <h3>MATLAB Link</h3>
        <div className="mini-grid">
          <div className={`pill ${bridgeReachable ? "ok" : "bad"}`}>Bridge: {bridgeConnectionLabel}</div>
          <div className={`pill ${matlabLinkLabel.tone}`}>MATLAB: {matlabLinkLabel.text}</div>
        </div>

        <ul className="mini-stats">
          <li><span>Total frames</span><strong>{bridgeStatus?.totalFrames ?? 0}</strong></li>
          <li><span>MATLAB frames</span><strong>{bridgeStatus?.matlabFrames ?? 0}</strong></li>
          <li><span>Sim frames</span><strong>{bridgeStatus?.simulationFrames ?? 0}</strong></li>
          <li><span>Last assigned</span><strong>{bridgeStatus?.lastAssignedDroneId || "-"}</strong></li>
          <li><span>WS clients</span><strong>{bridgeStatus?.wsClients ?? 0}</strong></li>
        </ul>

        <h4>Ingest Summary</h4>
        <ol className="mini-log">
          {bridgeLogs.length === 0 ? <li>No logs yet.</li> : null}
          {bridgeLogs.map((log) => (
            <li key={`${log.tsIso}-${log.droneId}-${log.source}`}>
              <strong>{new Date(log.tsIso).toLocaleTimeString()}</strong> {log.source} | {log.droneId} ({log.clusterId}) | {log.linkStatus} | {log.navSource}
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
