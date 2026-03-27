export type GnssStatus = "fix" | "degraded" | "denied" | "spoofing-suspected";
export type LinkStatus = "stable" | "degraded" | "lost";
export type NavigationSource = "gnss-ins" | "ins-only" | "visual-odometry" | "mixed-relative";
export type OperationMode = "operator-controlled" | "assisted" | "contested-link-safe-mode";

export interface GeoPoint {
  lat: number;
  lon: number;
  altitudeM: number;
}

export interface RelativeTrack {
  bearingDeg: number;
  distanceM: number;
  relativeAltitudeM: number;
}

export interface LinkHealth {
  status: LinkStatus;
  latencyMs: number;
  packetLossPct: number;
  lastPacketAgeMs: number;
}

export interface NavigationHealth {
  gnssStatus: GnssStatus;
  navigationSource: NavigationSource;
  imuDriftEstimateM: number;
  spoofingScore: number;
}

export interface DroneTelemetryFrame {
  timestampIso: string;
  clusterId: string;
  droneId: string;
  operationMode: OperationMode;
  link: LinkHealth;
  navigation: NavigationHealth;
  batteryPct: number;
  speedMps: number;
  headingDeg: number;
  position?: GeoPoint;
  relativeTrack?: RelativeTrack;
  notes?: string[];
}

export interface DroneSummary {
  id: string;
  callsign: string;
  clusterId: string;
}

export interface ClusterSummary {
  id: string;
  name: string;
  locality: string;
}
