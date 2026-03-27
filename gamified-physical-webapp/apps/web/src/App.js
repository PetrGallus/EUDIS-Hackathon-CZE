import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
const BRIDGE_BASE_URL = "http://localhost:8787";
function statusTone(status) {
    if (status === "fix" || status === "stable") {
        return "ok";
    }
    if (status === "degraded") {
        return "warn";
    }
    return "bad";
}
export function App() {
    const [clusters, setClusters] = useState([]);
    const [drones, setDrones] = useState([]);
    const [selectedClusterId, setSelectedClusterId] = useState("");
    const [selectedDroneId, setSelectedDroneId] = useState("");
    const [frame, setFrame] = useState(null);
    const [relativeMode, setRelativeMode] = useState(false);
    const [bridgeStatus, setBridgeStatus] = useState(null);
    const [bridgeLogs, setBridgeLogs] = useState([]);
    const [bridgeReachable, setBridgeReachable] = useState(false);
    useEffect(() => {
        fetch(`${BRIDGE_BASE_URL}/api/clusters`)
            .then((res) => res.json())
            .then((data) => {
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
                const statusData = (await statusRes.json());
                const logsData = (await logsRes.json());
                if (!mounted) {
                    return;
                }
                setBridgeStatus(statusData);
                setBridgeLogs(logsData);
                setBridgeReachable(true);
                if (!selectedClusterId && statusData.lastAssignedClusterId) {
                    setSelectedClusterId(statusData.lastAssignedClusterId);
                }
            }
            catch {
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
            .then((data) => {
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
            .then((data) => {
            if (data) {
                setFrame(data);
            }
        })
            .catch(console.error);
        const ws = new WebSocket(`${BRIDGE_BASE_URL.replace("http", "ws")}/ws/telemetry`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
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
            return { text: "No MATLAB frames yet", tone: "warn" };
        }
        const ageMs = Date.now() - new Date(bridgeStatus.lastMatlabFrameAtIso).getTime();
        if (ageMs < 6000) {
            return { text: "Live", tone: "ok" };
        }
        if (ageMs < 20000) {
            return { text: "Idle", tone: "warn" };
        }
        return { text: "Disconnected", tone: "bad" };
    }, [bridgeStatus]);
    const bridgeConnectionLabel = bridgeReachable ? "Online" : "Offline";
    return (_jsxs("div", { className: "shell", children: [_jsxs("header", { className: "topbar", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Contested Environment Console" }), _jsx("h1", { children: "UAV Ops Dashboard" })] }), _jsxs("div", { className: "selectors", children: [_jsxs("label", { children: ["Operator cluster", _jsx("select", { value: selectedClusterId, onChange: (e) => setSelectedClusterId(e.target.value), children: clusters.map((cluster) => (_jsxs("option", { value: cluster.id, children: [cluster.name, " (", cluster.locality, ")"] }, cluster.id))) })] }), _jsxs("label", { children: ["Drone", _jsx("select", { value: selectedDroneId, onChange: (e) => setSelectedDroneId(e.target.value), children: drones.map((drone) => (_jsx("option", { value: drone.id, children: drone.callsign }, drone.id))) })] })] })] }), _jsx("main", { className: "grid", children: !frame ? (_jsxs("section", { className: "panel empty-telemetry", children: [_jsx("h2", { children: "Telemetry not assigned yet" }), _jsxs("p", { children: ["Bridge is ", _jsx("strong", { children: bridgeConnectionLabel }), ". Select cluster and drone, then ensure bridge is running and sending frames."] }), _jsxs("p", { children: ["Selected route: ", _jsx("strong", { children: selectedClusterId || "-" }), " / ", _jsx("strong", { children: selectedDroneId || "-" })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("section", { className: "panel", children: [_jsx("h2", { children: "Resilience Indicators" }), _jsxs("div", { className: "status-grid", children: [_jsxs("div", { className: `status ${statusTone(frame.link.status)}`, children: [_jsx("span", { children: "C2 Link" }), _jsx("strong", { children: frame.link.status }), _jsxs("small", { children: [frame.link.latencyMs, " ms latency, ", frame.link.packetLossPct, "% loss"] })] }), _jsxs("div", { className: `status ${statusTone(frame.navigation.gnssStatus)}`, children: [_jsx("span", { children: "GNSS Status" }), _jsx("strong", { children: frame.navigation.gnssStatus }), _jsxs("small", { children: ["Spoof score ", frame.navigation.spoofingScore] })] }), _jsxs("div", { className: "status neutral", children: [_jsx("span", { children: "Navigation Source" }), _jsx("strong", { children: frame.navigation.navigationSource }), _jsxs("small", { children: ["IMU drift est. ", frame.navigation.imuDriftEstimateM, " m"] })] }), _jsxs("div", { className: "status neutral", children: [_jsx("span", { children: "Operation Mode" }), _jsx("strong", { children: frame.operationMode }), _jsxs("small", { children: ["Last packet age: ", frame.link.lastPacketAgeMs, " ms"] })] })] })] }), _jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row", children: [_jsx("h2", { children: "Tactical View" }), _jsx("button", { onClick: () => setRelativeMode((v) => !v), children: relativeMode ? "Switch to absolute" : "Switch to relative" })] }), relativeMode ? (_jsxs("div", { className: "view-box", children: [_jsx("p", { className: "view-title", children: "Relative mode (GNSS-denied friendly)" }), _jsx("p", { children: relativeText })] })) : (_jsxs("div", { className: "view-box", children: [_jsx("p", { className: "view-title", children: "Absolute position" }), _jsx("p", { children: frame.position
                                                ? `${frame.position.lat.toFixed(5)}, ${frame.position.lon.toFixed(5)} @ ${frame.position.altitudeM.toFixed(1)} m`
                                                : "No absolute position available" })] }))] }), _jsxs("section", { className: "panel", children: [_jsx("h2", { children: "Flight Telemetry" }), _jsxs("ul", { className: "kv", children: [_jsxs("li", { children: [_jsx("span", { children: "Drone" }), _jsx("strong", { children: frame.droneId })] }), _jsxs("li", { children: [_jsx("span", { children: "Battery" }), _jsxs("strong", { children: [frame.batteryPct.toFixed(2), "%"] })] }), _jsxs("li", { children: [_jsx("span", { children: "Speed" }), _jsxs("strong", { children: [frame.speedMps.toFixed(2), " m/s"] })] }), _jsxs("li", { children: [_jsx("span", { children: "Heading" }), _jsxs("strong", { children: [frame.headingDeg.toFixed(1), "\u00B0"] })] }), _jsxs("li", { children: [_jsx("span", { children: "Timestamp" }), _jsx("strong", { children: new Date(frame.timestampIso).toLocaleTimeString() })] })] })] }), _jsxs("section", { className: "panel", children: [_jsx("h2", { children: "System Notes" }), _jsx("ul", { className: "notes", children: (frame.notes || []).map((note) => (_jsx("li", { children: note }, note))) })] })] })) }), _jsxs("aside", { className: "matlab-mini", children: [_jsx("h3", { children: "MATLAB Link" }), _jsxs("div", { className: "mini-grid", children: [_jsxs("div", { className: `pill ${bridgeReachable ? "ok" : "bad"}`, children: ["Bridge: ", bridgeConnectionLabel] }), _jsxs("div", { className: `pill ${matlabLinkLabel.tone}`, children: ["MATLAB: ", matlabLinkLabel.text] })] }), _jsxs("ul", { className: "mini-stats", children: [_jsxs("li", { children: [_jsx("span", { children: "Total frames" }), _jsx("strong", { children: bridgeStatus?.totalFrames ?? 0 })] }), _jsxs("li", { children: [_jsx("span", { children: "MATLAB frames" }), _jsx("strong", { children: bridgeStatus?.matlabFrames ?? 0 })] }), _jsxs("li", { children: [_jsx("span", { children: "Sim frames" }), _jsx("strong", { children: bridgeStatus?.simulationFrames ?? 0 })] }), _jsxs("li", { children: [_jsx("span", { children: "Last assigned" }), _jsx("strong", { children: bridgeStatus?.lastAssignedDroneId || "-" })] }), _jsxs("li", { children: [_jsx("span", { children: "WS clients" }), _jsx("strong", { children: bridgeStatus?.wsClients ?? 0 })] })] }), _jsx("h4", { children: "Ingest Summary" }), _jsxs("ol", { className: "mini-log", children: [bridgeLogs.length === 0 ? _jsx("li", { children: "No logs yet." }) : null, bridgeLogs.map((log) => (_jsxs("li", { children: [_jsx("strong", { children: new Date(log.tsIso).toLocaleTimeString() }), " ", log.source, " | ", log.droneId, " (", log.clusterId, ") | ", log.linkStatus, " | ", log.navSource] }, `${log.tsIso}-${log.droneId}-${log.source}`)))] })] })] }));
}
