import fs from "node:fs/promises";
import path from "node:path";
import { SURVEY_POINTS } from "@shared/surveyPoints";
import {
  formatPointFullName,
  formatSubPointFullName,
  type CountingPoint,
  type CountingSubPoint,
} from "@shared/countingPoints";

const STORE_PATH = path.resolve(import.meta.dirname, "..", "data", "counting-points.json");

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

async function ensureStore() {
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(sortPoints(SURVEY_POINTS), null, 2));
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  const parsed = JSON.parse(raw) as CountingPoint[];
  return sortPoints(parsed);
}

async function writeStore(points: CountingPoint[]) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(sortPoints(points), null, 2));
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

export async function listCountingPoints() {
  return readStore();
}

export async function createCountingPoint(input: { code?: string; name: string }) {
  const points = await readStore();
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

  const next = [...points, point];
  await writeStore(next);
  return sortPoints(next);
}

export async function updateCountingPoint(input: { code: string; name: string }) {
  const points = await readStore();
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

  await writeStore(next);
  return sortPoints(next);
}

export async function deleteCountingPoint(input: { code: string }) {
  const points = await readStore();
  const next = points.filter((point) => point.code !== input.code);
  if (next.length === points.length) throw new Error("Point not found");
  await writeStore(next);
  return sortPoints(next);
}

export async function createCountingSubPoint(input: { pointCode: string; code?: string; name: string }) {
  const points = await readStore();
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

  await writeStore(next);
  return sortPoints(next);
}

export async function updateCountingSubPoint(input: { pointCode: string; code: string; name: string }) {
  const points = await readStore();
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
  await writeStore(next);
  return sortPoints(next);
}

export async function deleteCountingSubPoint(input: { pointCode: string; code: string }) {
  const points = await readStore();
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
  await writeStore(next);
  return sortPoints(next);
}
