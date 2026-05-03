import type { HeatmapColumn, HeatmapRow, PlotSeries, RankedBarDatum, ScatterPoint } from "../../components/ScientificPlots";
import { ROUTES } from "../constants";
import type { GenericRecord, MeasuredRoleMetadataState } from "../types";

export type { HeatmapColumn, HeatmapRow, PlotSeries, RankedBarDatum, ScatterPoint };

export function getRouteFromHash() {
  if (typeof window === "undefined") {
    return "landing";
  }
  const raw = window.location.hash.replace(/^#/, "").trim().toLowerCase();
  return ROUTES.includes(raw as typeof ROUTES[number]) ? (raw as typeof ROUTES[number]) : "landing";
}

export function setRouteHash(route: typeof ROUTES[number]) {
  if (typeof window === "undefined") {
    return;
  }
  const nextHash = route === "landing" ? "" : route;
  const target = nextHash ? `#${nextHash}` : "#";
  if (window.location.hash !== target) {
    window.location.hash = target;
  }
}

export function statusRank(status: string): number {
  switch (status) {
    case "ready":
      return 0;
    case "prototype":
      return 1;
    case "blocked":
      return 2;
    default:
      return 3;
  }
}

export function isRecord(value: unknown): value is GenericRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function formatNumber(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) {
    return "n/a";
  }
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

export function formatMetric(value: number | null, digits = 3): string {
  if (value === null || !Number.isFinite(value)) {
    return "n/a";
  }
  return value.toFixed(digits);
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) {
    return "n/a";
  }
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatShape(shape: number[] | null): string {
  return shape && shape.length > 0 ? shape.join(" x ") : "n/a";
}

export function uniqueStrings(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function listStringEntries(value: unknown): string[] {
  return asArray(value)
    .map((entry) => asString(entry))
    .filter((entry): entry is string => entry !== null);
}

export function meanFromStats(value: unknown): number | null {
  return isRecord(value) ? asNumber(value.mean) : null;
}

export function benchmarkRoleSourceLabel(state: MeasuredRoleMetadataState): string {
  return state === "payload-metadata" ? "published role metadata" : "fallback role inference";
}

export function benchmarkRoleSourceNote(state: MeasuredRoleMetadataState): string {
  return state === "payload-metadata"
    ? "Model roles come from the published benchmark payload."
    : "This benchmark payload predates the role-metadata refresh, so the app is inferring stable roles from model ids until the full rerun lands.";
}
