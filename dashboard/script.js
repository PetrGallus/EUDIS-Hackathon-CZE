const state = {
  viewMode: "2d",
  startTime: Date.now(),
  alerts: 0,
  ownship: {
    id: "OWN-01",
    lat: 49.1934,
    lon: 16.6089,
    altitudeM: 112,
    speedMps: 24,
    headingDeg: 42,
    batteryPct: 91,
    uplinkMs: 38,
  },
  track: {
    id: "SIM-TRACK-ALPHA",
    classLabel: "Unknown UAV",
    confidence: 0.34,
    distanceM: 680,
    relativeBearingDeg: 77,
    thermalDeltaC: 5.2,
    speedMps: 19,
    lat: 49.1962,
    lon: 16.6133,
    riskLevel: "Monitor",
  },
  events: [],
};

const telemetryList = document.getElementById("telemetryList");
const trackList = document.getElementById("trackList");
const confidenceBar = document.getElementById("confidenceBar");
const confidenceLabel = document.getElementById("confidenceLabel");
const eventLog = document.getElementById("eventLog");
const alertState = document.getElementById("alertState");
const simClock = document.getElementById("simClock");
const canvas = document.getElementById("radarCanvas");
const ctx = canvas.getContext("2d");

function fmt(num, digits = 0) {
  return Number(num).toFixed(digits);
}

function formatElapsed(ms) {
  const sec = Math.floor(ms / 1000);
  const hh = String(Math.floor(sec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return `T+${hh}:${mm}:${ss}`;
}

function pushEvent(message, severity = "info") {
  state.events.unshift({ message, severity, ts: new Date() });
  state.events = state.events.slice(0, 18);
  if (severity !== "info") {
    state.alerts += 1;
  }
}

function updateLists() {
  const telemetry = [
    ["Vehicle", state.ownship.id],
    ["Altitude", `${fmt(state.ownship.altitudeM)} m`],
    ["Speed", `${fmt(state.ownship.speedMps, 1)} m/s`],
    ["Heading", `${fmt(state.ownship.headingDeg)} deg`],
    ["Battery", `${fmt(state.ownship.batteryPct)} %`],
    ["Uplink", `${fmt(state.ownship.uplinkMs)} ms`],
    ["Position", `${fmt(state.ownship.lat, 4)}, ${fmt(state.ownship.lon, 4)}`],
  ];

  const track = [
    ["Track ID", state.track.id],
    ["Class", state.track.classLabel],
    ["Distance", `${fmt(state.track.distanceM)} m`],
    ["Bearing", `${fmt(state.track.relativeBearingDeg)} deg`],
    ["Thermal Delta", `${fmt(state.track.thermalDeltaC, 1)} C`],
    ["Track Speed", `${fmt(state.track.speedMps, 1)} m/s`],
    ["Risk", state.track.riskLevel],
  ];

  telemetryList.innerHTML = telemetry.map(([k, v]) => `<li><span>${k}</span><strong>${v}</strong></li>`).join("");
  trackList.innerHTML = track.map(([k, v]) => `<li><span>${k}</span><strong>${v}</strong></li>`).join("");

  const confPct = Math.round(state.track.confidence * 100);
  confidenceBar.style.width = `${confPct}%`;
  confidenceLabel.textContent = `${confPct}%`;

  eventLog.innerHTML = state.events
    .map((e) => {
      const cls = e.severity === "alert" ? "sev-alert" : e.severity === "warn" ? "sev-warn" : "";
      return `<li class="${cls}">${e.ts.toLocaleTimeString()} - ${e.message}</li>`;
    })
    .join("");

  alertState.textContent = `Alerts: ${state.alerts}`;
}

function drawRadar() {
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(121, 185, 255, 0.22)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i += 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, i * 74, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(61, 213, 182, 0.24)";
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(rad) * 300, cy + Math.sin(rad) * 300);
    ctx.stroke();
  }

  const ownX = cx;
  const ownY = cy;

  const distancePx = Math.min(state.track.distanceM * 0.35, 280);
  const bearingRad = (state.track.relativeBearingDeg * Math.PI) / 180;
  const trackX = ownX + Math.cos(bearingRad) * distancePx;
  const trackY = ownY + Math.sin(bearingRad) * distancePx;

  // Draw ownship marker.
  ctx.fillStyle = "#3dd5b6";
  ctx.beginPath();
  ctx.arc(ownX, ownY, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff6a69";
  ctx.beginPath();
  ctx.arc(trackX, trackY, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 106, 105, 0.33)";
  ctx.beginPath();
  ctx.arc(trackX, trackY, 26, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(234, 244, 251, 0.88)";
  ctx.font = '14px "IBM Plex Mono"';
  ctx.fillText("OWN", ownX + 12, ownY - 10);
  ctx.fillText("TRACK", trackX + 10, trackY - 8);

  if (state.viewMode === "thermal") {
    const gradient = ctx.createRadialGradient(trackX, trackY, 2, trackX, trackY, 42);
    gradient.addColorStop(0, "rgba(255, 180, 71, 0.58)");
    gradient.addColorStop(1, "rgba(255, 106, 105, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(trackX, trackY, 42, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.viewMode === "3d") {
    ctx.strokeStyle = "rgba(121, 185, 255, 0.5)";
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(trackX, trackY);
    ctx.lineTo(trackX, trackY - Math.min(state.track.speedMps * 2.8, 75));
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function tickSimulation() {
  const noise = () => (Math.random() - 0.5);

  state.ownship.headingDeg = (state.ownship.headingDeg + noise() * 8 + 360) % 360;
  state.ownship.speedMps = Math.max(12, Math.min(33, state.ownship.speedMps + noise() * 1.8));
  state.ownship.altitudeM = Math.max(70, Math.min(150, state.ownship.altitudeM + noise() * 3.2));
  state.ownship.batteryPct = Math.max(0, state.ownship.batteryPct - 0.04);
  state.ownship.uplinkMs = Math.max(16, Math.min(140, state.ownship.uplinkMs + noise() * 8));

  state.track.distanceM = Math.max(80, state.track.distanceM - (state.ownship.speedMps - state.track.speedMps) * 0.9 + noise() * 8);
  state.track.relativeBearingDeg = (state.track.relativeBearingDeg + noise() * 5 + 360) % 360;
  state.track.thermalDeltaC = Math.max(1.5, state.track.thermalDeltaC + noise() * 0.35);
  state.track.confidence = Math.max(0.05, Math.min(0.99, state.track.confidence + noise() * 0.03 + (state.track.distanceM < 320 ? 0.02 : 0)));

  if (state.track.confidence > 0.8) {
    state.track.classLabel = "High-probability hostile UAV (simulated)";
    state.track.riskLevel = "High";
  } else if (state.track.confidence > 0.5) {
    state.track.classLabel = "Suspicious UAV";
    state.track.riskLevel = "Medium";
  } else {
    state.track.classLabel = "Unknown UAV";
    state.track.riskLevel = "Monitor";
  }

  if (state.track.distanceM < 250 && Math.random() > 0.62) {
    pushEvent("Safety bubble crossed by tracked object.", "warn");
  }

  if (state.ownship.uplinkMs > 110 && Math.random() > 0.7) {
    pushEvent("Data link latency spike detected.", "warn");
  }

  if (state.track.confidence > 0.9 && Math.random() > 0.76) {
    pushEvent("Operator action requested: classify / handoff to C2.", "alert");
  }
}

function bindUi() {
  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-view]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.viewMode = btn.dataset.view;
      drawRadar();
      pushEvent(`View mode changed to ${state.viewMode.toUpperCase()}.`);
      updateLists();
    });
  });

  document.getElementById("clearLogBtn").addEventListener("click", () => {
    state.events = [];
    updateLists();
  });
}

function bootstrap() {
  pushEvent("Simulation stream initialized.");
  pushEvent("Dashboard ready for operator training.");
  bindUi();

  setInterval(() => {
    simClock.textContent = formatElapsed(Date.now() - state.startTime);
    tickSimulation();
    updateLists();
    drawRadar();
  }, 1000);

  updateLists();
  drawRadar();
}

bootstrap();
