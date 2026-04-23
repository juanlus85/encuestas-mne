import fs from "node:fs/promises";
import path from "node:path";
import { SURVEY_POINTS } from "@shared/surveyPoints";
import {
  formatPointFullName,
  formatSubPointFullName,
  type CountingPoint,
  type CountingSubPoint,
} from "@shared/countingPoints";
import { getStudySettingsByStudyId, upsertStudyCountingPoints } from "./db";

const LEGACY_STORE_PATH = path.resolve(import.meta.dirname, "..", "data", "counting-points.json");

function sortPoints(points: CountingPoint[]) {
  return [...points]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((point) => ({
      ...point,
      fullName: formatPointFullName(point.code, point.name),
      subPoints: [...point.subPoints]
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((subPoint) => ({
          ...subPoint,
          fullName: formatSubPointFullName(subPoint.code, subPoint.name),
        })),
    }));
}

function normalizeSubPoint(input: unknown): CountingSubPoint | null {
  if (!input || typeof input !== "object") return null;
  const subPoint = input as Partial<CountingSubPoint>;
  const code = typeof subPoint.code === "string" ? subPoint.code.trim() : "";
  const name = typeof subPoint.name === "string" ? subPoint.name.trim() : "";
  if (!code || !name) return null;
  return {
    code,
    name,
    fullName: formatSubPointFullName(code, name),
  };
}

function normalizePoints(input: unknown, fallback: CountingPoint[] = SURVEY_POINTS): CountingPoint[] {
  if (!Array.isArray(input)) {
    return sortPoints(fallback);
  }

  const normalized = input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const point = item as Partial<CountingPoint>;
      const code = typeof point.code === "string" ? point.code.trim() : "";
      const name = typeof point.name === "string" ? point.name.trim() : "";
      if (!code || !name) return null;

      return {
        code,
        name,
        fullName: formatPointFullName(code, name),
        subPoints: Array.isArray(point.subPoints)
          ? point.subPoints.map((subPoint) => normalizeSubPoint(subPoint)).filter((subPoint): subPoint is CountingSubPoint => Boolean(subPoint))
          : [],
      } satisfies CountingPoint;
    })
    .filter((point): point is CountingPoint => Boolean(point));

  return normalized.length > 0 ? sortPoints(normalized) : sortPoints(fallback);
}

async function ensureLegacyStore() {
  try {
    await fs.access(LEGACY_STORE_PATH);
  } catch {
    await fs.mkdir(path.dirname(LEGACY_STORE_PATH), { recursive: true });
    await fs.writeFile(LEGACY_STORE_PATH, JSON.stringify(sortPoints(SURVEY_POINTS), null, 2));
  }
}

async function readLegacyStore() {
  try {
    await ensureLegacyStore();
    const raw = await fs.readFile(LEGACY_STORE_PATH, "utf8");
    return normalizePoints(JSON.parse(raw));
  } catch {
    return sortPoints(SURVEY_POINTS);
  }
}

async function readStore(studyId?: number) {
  if (!studyId) {
    return readLegacyStore();
  }

  const studySettings = await getStudySettingsByStudyId(studyId);
  if (Array.isArray(studySettings?.countingPointsJson)) {
    return normalizePoints(studySettings.countingPointsJson);
  }

  const legacyPoints = await readLegacyStore();
  await upsertStudyCountingPoints(studyId, legacyPoints);
  return legacyPoints;
}

async function writeStore(studyId: number, points: CountingPoint[]) {
  const normalized = sortPoints(points);
  await upsertStudyCountingPoints(studyId, normalized);
  return normalized;
}

function assertPointCode(code: string) {
  if (!/^\d{2}$/.test(code)) {
    throw new Error("Point code must contain exactly 2 digits");
  }
}

function assertSubPointCode(code: string, pointCode: string) {
  if (!new RegExp(`^${pointCode}\\.\\d{2}$`).test(code)) {
    throw new Error(`Subpoint code must use the ${pointCode}.XX format`);
  }
}

function nextPointCode(points: CountingPoint[]) {
  const max = points.reduce((current, point) => Math.max(current, Number.parseInt(point.code, 10) || 0), 0);
  return String(max + 1).padStart(2, "0");
}

function nextSubPointCode(point: CountingPoint) {
  const max = point.subPoints.reduce((current, subPoint) => {
    const suffix = Number.parseInt(subPoint.code.split(".")[1] ?? "0", 10) || 0;
    return Math.max(current, suffix);
  }, 0);
  return `${point.code}.${String(max + 1).padStart(2, "0")}`;
}

export async function listCountingPoints(studyId?: number) {
  return readStore(studyId);
}

export async function createCountingPoint(studyId: number, input: { code?: string; name: string }) {
  const points = await readStore(studyId);
  const code = (input.code?.trim() || nextPointCode(points)).padStart(2, "0");
  const name = input.name.trim();

  assertPointCode(code);
  if (!name) throw new Error("Point name is required");
  if (points.some((point) => point.code === code)) throw new Error("A point with that code already exists");

  const point: CountingPoint = {
    code,
    name,
    fullName: formatPointFullName(code, name),
    subPoints: [],
  };

  return writeStore(studyId, [...points, point]);
}

export async function updateCountingPoint(studyId: number, input: { code: string; name: string }) {
  const points = await readStore(studyId);
  const name = input.name.trim();
  if (!name) throw new Error("Point name is required");

  const next = points.map((point) =>
    point.code === input.code
      ? {
          ...point,
          name,
          fullName: formatPointFullName(point.code, name),
        }
      : point,
  );

  if (!next.some((point) => point.code === input.code)) {
    throw new Error("Point not found");
  }

  return writeStore(studyId, next);
}

export async function deleteCountingPoint(studyId: number, input: { code: string }) {
  const points = await readStore(studyId);
  const next = points.filter((point) => point.code !== input.code);
  if (next.length === points.length) throw new Error("Point not found");
  return writeStore(studyId, next);
}

export async function createCountingSubPoint(studyId: number, input: { pointCode: string; code?: string; name: string }) {
  const points = await readStore(studyId);
  const point = points.find((item) => item.code === input.pointCode);
  if (!point) throw new Error("Point not found");

  const code = input.code?.trim() || nextSubPointCode(point);
  const name = input.name.trim();

  assertSubPointCode(code, point.code);
  if (!name) throw new Error("Subpoint name is required");
  if (points.some((item) => item.subPoints.some((subPoint) => subPoint.code === code))) {
    throw new Error("A subpoint with that code already exists");
  }

  const subPoint: CountingSubPoint = {
    code,
    name,
    fullName: formatSubPointFullName(code, name),
  };

  const next = points.map((item) =>
    item.code === point.code
      ? { ...item, subPoints: [...item.subPoints, subPoint] }
      : item,
  );

  return writeStore(studyId, next);
}

export async function updateCountingSubPoint(studyId: number, input: { pointCode: string; code: string; name: string }) {
  const points = await readStore(studyId);
  const name = input.name.trim();
  if (!name) throw new Error("Subpoint name is required");

  let found = false;
  const next = points.map((point) => {
    if (point.code !== input.pointCode) return point;

    return {
      ...point,
      subPoints: point.subPoints.map((subPoint) => {
        if (subPoint.code !== input.code) return subPoint;
        found = true;
        return {
          ...subPoint,
          name,
          fullName: formatSubPointFullName(subPoint.code, name),
        };
      }),
    };
  });

  if (!found) throw new Error("Subpoint not found");
  return writeStore(studyId, next);
}

export async function deleteCountingSubPoint(studyId: number, input: { pointCode: string; code: string }) {
  const points = await readStore(studyId);
  let found = false;

  const next = points.map((point) => {
    if (point.code !== input.pointCode) return point;

    const subPoints = point.subPoints.filter((subPoint) => {
      const keep = subPoint.code !== input.code;
      if (!keep) found = true;
      return keep;
    });

    return { ...point, subPoints };
  });

  if (!found) throw new Error("Subpoint not found");
  return writeStore(studyId, next);
}
