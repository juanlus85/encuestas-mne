import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createPedestrianDirection,
  getDirectionsByPoint,
  getAllDirectionPoints,
  updatePedestrianDirection,
  deletePedestrianDirection,
  createPedestrianPass,
  getPedestrianPasses,
  getPedestrianPassStats,
} from "./db";

const TEST_POINT = "Mateos Gago";
let directionId: number;
let passId: number;

describe("Pedestrian Directions", () => {
  it("creates a direction for a survey point", async () => {
    const dir = await createPedestrianDirection({
      surveyPoint: TEST_POINT,
      label: "Catedral → Alcázar",
      description: "Flujo principal",
      order: 1,
    });
    expect(dir).toBeDefined();
    const insertedId = (dir as any)?.insertId;
    expect(insertedId).toBeGreaterThan(0);
    directionId = insertedId;
  });

  it("retrieves directions by point", async () => {
    const dirs = await getDirectionsByPoint(TEST_POINT);
    expect(Array.isArray(dirs)).toBe(true);
    const found = dirs.find((d) => d.id === directionId);
    expect(found).toBeDefined();
    expect(found?.label).toBe("Catedral → Alcázar");
  });

  it("retrieves all distinct points", async () => {
    const points = await getAllDirectionPoints();
    expect(Array.isArray(points)).toBe(true);
    expect(points).toContain(TEST_POINT);
  });

  it("updates a direction", async () => {
    // updatePedestrianDirection returns void; verify by re-fetching
    await updatePedestrianDirection(directionId, { label: "Catedral → Alcázar (actualizado)" });
    const dirs = await getDirectionsByPoint(TEST_POINT);
    const found = dirs.find((d) => d.id === directionId);
    expect(found?.label).toBe("Catedral → Alcázar (actualizado)");
  });
});

describe("Pedestrian Passes", () => {
  it("creates a pedestrian pass", async () => {
    const pass = await createPedestrianPass({
      encuestadorId: 1,
      encuestadorName: "Test Encuestador",
      surveyPoint: TEST_POINT,
      directionId,
      directionLabel: "Catedral → Alcázar (actualizado)",
      count: 5,
      latitude: "37.3861",
      longitude: "-5.9925",
      gpsAccuracy: "3.5",
      recordedAt: new Date(),
    });
    expect(pass).toBeDefined();
    const insertedPassId = (pass as any)?.insertId;
    expect(insertedPassId).toBeGreaterThan(0);
    passId = insertedPassId;
  });

  it("lists passes with filters", async () => {
    const passes = await getPedestrianPasses({ surveyPoint: TEST_POINT });
    expect(Array.isArray(passes)).toBe(true);
    const found = passes.find((p) => p.id === passId);
    expect(found).toBeDefined();
    expect(found?.count).toBe(5);
  });

  it("computes pass statistics", async () => {
    const stats = await getPedestrianPassStats({ surveyPoint: TEST_POINT });
    expect(stats).toBeDefined();
    expect(stats.total).toBeGreaterThanOrEqual(5);
    expect(stats.passes.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Cleanup", () => {
  it("deletes the test direction", async () => {
    await deletePedestrianDirection(directionId);
    const dirs = await getDirectionsByPoint(TEST_POINT);
    const found = dirs.find((d) => d.id === directionId);
    expect(found).toBeUndefined();
  });
});
