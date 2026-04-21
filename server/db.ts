import { and, between, desc, eq, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  fieldMetrics,
  InsertFieldMetric,
  InsertPhoto,
  InsertQuestion,
  InsertSurveyResponse,
  InsertSurveyTemplate,
  InsertUser,
  photos,
  questions,
  surveyAnswers,
  InsertSurveyAnswer,
  surveyResponsesFlat,
  InsertSurveyResponseFlat,
  surveyResponses,
  surveyTemplates,
  users,
  shifts,
  shiftClosures,
  InsertShift,
  InsertShiftClosure,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

/**
 * Ajusta un Date para que MySQL lo almacene como hora española.
 * MySQL/TiDB interpreta los valores Date como UTC al insertarlos.
 * Esta función suma el offset de Europe/Madrid para que el valor almacenado
 * coincida con la hora local española cuando se lee sin conversión.
 */
export function toSpainTime(date: Date): Date {
  const madridStr = date.toLocaleString("en-US", { timeZone: "Europe/Madrid", hour12: false });
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC", hour12: false });
  const offsetMs = new Date(madridStr).getTime() - new Date(utcStr).getTime();
  return new Date(date.getTime() + offsetMs);
}

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(users.name);
}

export async function getEncuestadores() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.role, "encuestador")).orderBy(users.name);
}

export async function updateUser(id: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, id));
}

export async function createUser(data: InsertUser) {
  const db = await getDb();
  if (!db) return;
  await db.insert(users).values(data);
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserPassword(id: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

// ─── Survey Templates ─────────────────────────────────────────────────────────

export async function getSurveyTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(surveyTemplates).orderBy(surveyTemplates.name);
}

export async function getActiveSurveyTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(surveyTemplates).where(eq(surveyTemplates.isActive, true));
}

export async function getSurveyTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(surveyTemplates).where(eq(surveyTemplates.id, id)).limit(1);
  return result[0];
}

export async function createSurveyTemplate(data: InsertSurveyTemplate) {
  const db = await getDb();
  if (!db) return;
  await db.insert(surveyTemplates).values(data);
}

export async function updateSurveyTemplate(id: number, data: Partial<InsertSurveyTemplate>) {
  const db = await getDb();
  if (!db) return;
  await db.update(surveyTemplates).set(data).where(eq(surveyTemplates.id, id));
}

// ─── Questions ────────────────────────────────────────────────────────────────

export async function getQuestionsByTemplate(templateId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(questions).where(eq(questions.templateId, templateId)).orderBy(questions.order);
  // MySQL estándar puede devolver campos json como string — parsear defensivamente
  return rows.map((q) => ({
    ...q,
    options: typeof q.options === "string" ? JSON.parse(q.options) : (q.options ?? null),
  }));
}

export async function createQuestion(data: InsertQuestion) {
  const db = await getDb();
  if (!db) return;
  await db.insert(questions).values(data);
}

export async function updateQuestion(id: number, data: Partial<InsertQuestion>) {
  const db = await getDb();
  if (!db) return;
  await db.update(questions).set(data).where(eq(questions.id, id));
}

export async function deleteQuestion(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(questions).where(eq(questions.id, id));
}

// ─── Survey Responses ─────────────────────────────────────────────────────────

export async function createSurveyResponse(data: InsertSurveyResponse) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(surveyResponses).values(data);
  return result[0];
}

/**
 * Inserta una fila desnormalizada en survey_responses_flat (una por encuesta).
 * Cada pregunta tiene su propia columna (V01..V26 para visitantes, R01..R38 para residentes).
 */
export async function insertSurveyResponseFlat(row: InsertSurveyResponseFlat) {
  const db = await getDb();
  if (!db) return;
  await db.insert(surveyResponsesFlat).values(row);
}

/**
 * Inserta filas normalizadas en survey_answers (una por pregunta).
 * Se llama desde el router de encuestas tras guardar la encuesta principal.
 */
export async function insertSurveyAnswers(rows: InsertSurveyAnswer[]) {
  const db = await getDb();
  if (!db || rows.length === 0) return;
  // Insertar en lotes de 50 para evitar límites de MySQL
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.insert(surveyAnswers).values(rows.slice(i, i + BATCH));
  }
}

export async function getSurveyResponses(filters?: {
  encuestadorId?: number;
  templateId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  status?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.encuestadorId) conditions.push(eq(surveyResponses.encuestadorId, filters.encuestadorId));
  if (filters?.templateId) conditions.push(eq(surveyResponses.templateId, filters.templateId));
  if (filters?.dateFrom) conditions.push(gte(surveyResponses.startedAt, filters.dateFrom));
  if (filters?.dateTo) conditions.push(lte(surveyResponses.startedAt, filters.dateTo));
  if (filters?.status) conditions.push(eq(surveyResponses.status, filters.status as any));

  const query = db
    .select({
      id: surveyResponses.id,
      templateId: surveyResponses.templateId,
      templateType: surveyTemplates.type,
      encuestadorId: surveyResponses.encuestadorId,
      encuestadorName: surveyResponses.encuestadorName,
      encuestadorIdentifier: surveyResponses.encuestadorIdentifier,
      deviceInfo: surveyResponses.deviceInfo,
      surveyPoint: surveyResponses.surveyPoint,
      timeSlot: surveyResponses.timeSlot,
      windowCode: surveyResponses.windowCode,
      minuteStart: surveyResponses.minuteStart,
      minuteEnd: surveyResponses.minuteEnd,
      earlyExit: surveyResponses.earlyExit,
      latitude: surveyResponses.latitude,
      longitude: surveyResponses.longitude,
      gpsAccuracy: surveyResponses.gpsAccuracy,
      startedAt: surveyResponses.startedAt,
      finishedAt: surveyResponses.finishedAt,
      language: surveyResponses.language,
      answers: surveyResponses.answers,
      status: surveyResponses.status,
      createdAt: surveyResponses.createdAt,
      // Respuestas visitantes
      v_p01: surveyResponses.v_p01, v_p02: surveyResponses.v_p02, v_p03: surveyResponses.v_p03,
      v_p04: surveyResponses.v_p04, v_p05: surveyResponses.v_p05, v_p06: surveyResponses.v_p06,
      v_p07: surveyResponses.v_p07, v_p08: surveyResponses.v_p08, v_p09: surveyResponses.v_p09,
      v_p10: surveyResponses.v_p10, v_p11: surveyResponses.v_p11, v_p12: surveyResponses.v_p12,
      v_p13: surveyResponses.v_p13, v_p14: surveyResponses.v_p14, v_p15: surveyResponses.v_p15,
      v_p16: surveyResponses.v_p16, v_p17: surveyResponses.v_p17, v_p18: surveyResponses.v_p18,
      v_p19: surveyResponses.v_p19, v_p20: surveyResponses.v_p20,
      // Respuestas residentes
      r_p01: surveyResponses.r_p01, r_p02: surveyResponses.r_p02, r_p03: surveyResponses.r_p03,
      r_p04: surveyResponses.r_p04, r_p05: surveyResponses.r_p05, r_p06: surveyResponses.r_p06,
      r_p07: surveyResponses.r_p07, r_p08: surveyResponses.r_p08, r_p09: surveyResponses.r_p09,
      r_p10: surveyResponses.r_p10, r_p11: surveyResponses.r_p11, r_p12: surveyResponses.r_p12,
      r_p13: surveyResponses.r_p13, r_p14: surveyResponses.r_p14, r_p15: surveyResponses.r_p15,
      r_p16: surveyResponses.r_p16, r_p17: surveyResponses.r_p17, r_p18: surveyResponses.r_p18,
      r_p19: surveyResponses.r_p19, r_p20: surveyResponses.r_p20, r_p21: surveyResponses.r_p21,
      r_p22: surveyResponses.r_p22, r_p23: surveyResponses.r_p23, r_p24: surveyResponses.r_p24,
      r_p25: surveyResponses.r_p25, r_p26: surveyResponses.r_p26, r_p27: surveyResponses.r_p27,
      r_p28: surveyResponses.r_p28, r_p29: surveyResponses.r_p29, r_p30: surveyResponses.r_p30,
      r_p31: surveyResponses.r_p31, r_p32: surveyResponses.r_p32, r_p33: surveyResponses.r_p33,
      r_p34: surveyResponses.r_p34, r_p35a: surveyResponses.r_p35a, r_p35b: surveyResponses.r_p35b,
      r_p35c: surveyResponses.r_p35c, r_p36: surveyResponses.r_p36,
    })
    .from(surveyResponses)
    .leftJoin(surveyTemplates, eq(surveyResponses.templateId, surveyTemplates.id))
    .orderBy(desc(surveyResponses.startedAt));
  if (conditions.length > 0) return query.where(and(...conditions));
  return query;
}

export async function getSurveyResponseById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(surveyResponses).where(eq(surveyResponses.id, id)).limit(1);
  return result[0];
}

export async function getSurveyResponsesByEncuestador(encuestadorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(surveyResponses)
    .where(eq(surveyResponses.encuestadorId, encuestadorId))
    .orderBy(desc(surveyResponses.startedAt))
    .limit(50);
}

// ─── Photos ───────────────────────────────────────────────────────────────────

export async function createPhoto(data: InsertPhoto) {
  const db = await getDb();
  if (!db) return;
  await db.insert(photos).values(data);
}

export async function getPhotosByResponse(responseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(photos).where(eq(photos.responseId, responseId));
}

// ─── Field Metrics ────────────────────────────────────────────────────────────

export async function upsertFieldMetric(data: InsertFieldMetric) {
  const db = await getDb();
  if (!db) return;
  await db.insert(fieldMetrics).values(data).onDuplicateKeyUpdate({
    set: {
      completed: data.completed,
      rejected: data.rejected,
      substituted: data.substituted,
      incomplete: data.incomplete,
      notes: data.notes,
    },
  });
}

export async function getFieldMetrics(filters?: { encuestadorId?: number; dateFrom?: string; dateTo?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.encuestadorId) conditions.push(eq(fieldMetrics.encuestadorId, filters.encuestadorId));
  if (filters?.dateFrom) conditions.push(gte(fieldMetrics.date, filters.dateFrom));
  if (filters?.dateTo) conditions.push(lte(fieldMetrics.date, filters.dateTo));
  const query = db.select().from(fieldMetrics).orderBy(desc(fieldMetrics.date));
  if (conditions.length > 0) return query.where(and(...conditions));
  return query;
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export async function getDashboardStats(filters?: { dateFrom?: Date; dateTo?: Date; encuestadorId?: number }) {
  const db = await getDb();
  if (!db) return null;

  const conditions = [eq(surveyResponses.status, "completa")];
  if (filters?.encuestadorId) conditions.push(eq(surveyResponses.encuestadorId, filters.encuestadorId));
  if (filters?.dateFrom) conditions.push(gte(surveyResponses.startedAt, filters.dateFrom));
  if (filters?.dateTo) conditions.push(lte(surveyResponses.startedAt, filters.dateTo));

  const [totals] = await db.select({
    total: sql<number>`COUNT(*)`,
    residentes: sql<number>`SUM(CASE WHEN ${surveyTemplates.type} = 'residentes' THEN 1 ELSE 0 END)`,
    visitantes: sql<number>`SUM(CASE WHEN ${surveyTemplates.type} = 'visitantes' THEN 1 ELSE 0 END)`,
  })
    .from(surveyResponses)
    .leftJoin(surveyTemplates, eq(surveyResponses.templateId, surveyTemplates.id))
    .where(and(...conditions));

  return totals;
}

export async function getResponsesByDay(filters?: { dateFrom?: Date; dateTo?: Date }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.dateFrom) conditions.push(gte(surveyResponses.startedAt, filters.dateFrom));
  if (filters?.dateTo) conditions.push(lte(surveyResponses.startedAt, filters.dateTo));

  const query = db.select({
    date: sql<string>`DATE(${surveyResponses.startedAt})`,
    total: sql<number>`COUNT(*)`,
    residentes: sql<number>`SUM(CASE WHEN ${surveyTemplates.type} = 'residentes' THEN 1 ELSE 0 END)`,
    visitantes: sql<number>`SUM(CASE WHEN ${surveyTemplates.type} = 'visitantes' THEN 1 ELSE 0 END)`,
  })
    .from(surveyResponses)
    .leftJoin(surveyTemplates, eq(surveyResponses.templateId, surveyTemplates.id))
    .groupBy(sql`DATE(${surveyResponses.startedAt})`)
    .orderBy(sql`DATE(${surveyResponses.startedAt})`);

  if (conditions.length > 0) return query.where(and(...conditions));
  return query;
}

export async function getResponsesByEncuestador(filters?: { dateFrom?: Date; dateTo?: Date }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.dateFrom) conditions.push(gte(surveyResponses.startedAt, filters.dateFrom));
  if (filters?.dateTo) conditions.push(lte(surveyResponses.startedAt, filters.dateTo));

  const query = db.select({
    encuestadorId: surveyResponses.encuestadorId,
    encuestadorName: surveyResponses.encuestadorName,
    encuestadorIdentifier: surveyResponses.encuestadorIdentifier,
    total: sql<number>`COUNT(*)`,
    residentes: sql<number>`SUM(CASE WHEN ${surveyTemplates.type} = 'residentes' THEN 1 ELSE 0 END)`,
    visitantes: sql<number>`SUM(CASE WHEN ${surveyTemplates.type} = 'visitantes' THEN 1 ELSE 0 END)`,
  })
    .from(surveyResponses)
    .leftJoin(surveyTemplates, eq(surveyResponses.templateId, surveyTemplates.id))
    .groupBy(surveyResponses.encuestadorId, surveyResponses.encuestadorName, surveyResponses.encuestadorIdentifier)
    .orderBy(desc(sql`COUNT(*)`));

  if (conditions.length > 0) return query.where(and(...conditions));
  return query;
}

export async function getResponsesByTimeSlot(filters?: { dateFrom?: Date; dateTo?: Date }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.dateFrom) conditions.push(gte(surveyResponses.startedAt, filters.dateFrom));
  if (filters?.dateTo) conditions.push(lte(surveyResponses.startedAt, filters.dateTo));

  const query = db.select({
    timeSlot: surveyResponses.timeSlot,
    total: sql<number>`COUNT(*)`,
  })
    .from(surveyResponses)
    .groupBy(surveyResponses.timeSlot)
    .orderBy(desc(sql`COUNT(*)`));

  if (conditions.length > 0) return query.where(and(...conditions));
  return query;
}

export async function getGpsLocations(filters?: { dateFrom?: Date; dateTo?: Date; encuestadorId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [sql`${surveyResponses.latitude} IS NOT NULL`];
  if (filters?.encuestadorId) conditions.push(eq(surveyResponses.encuestadorId, filters.encuestadorId));
  if (filters?.dateFrom) conditions.push(gte(surveyResponses.startedAt, filters.dateFrom));
  if (filters?.dateTo) conditions.push(lte(surveyResponses.startedAt, filters.dateTo));

  return db.select({
    id: surveyResponses.id,
    latitude: surveyResponses.latitude,
    longitude: surveyResponses.longitude,
    encuestadorName: surveyResponses.encuestadorName,
    startedAt: surveyResponses.startedAt,
    templateId: surveyResponses.templateId,
    surveyPoint: surveyResponses.surveyPoint,
  })
    .from(surveyResponses)
    .where(and(...conditions))
    .limit(1000);
}

// ─── Pedestrian Counts ────────────────────────────────────────────────────────

import {
  pedestrianSessions,
  pedestrianIntervals,
  InsertPedestrianSession,
  InsertPedestrianInterval,
} from "../drizzle/schema";

export async function createPedestrianSession(data: InsertPedestrianSession) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(pedestrianSessions).values(data);
  return result[0];
}

export async function updatePedestrianSession(id: number, data: Partial<InsertPedestrianSession>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(pedestrianSessions).set(data as any).where(eq(pedestrianSessions.id, id));
}

export async function getPedestrianSessionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(pedestrianSessions).where(eq(pedestrianSessions.id, id)).limit(1);
  return result[0];
}

export async function getPedestrianSessions(filters?: {
  encuestadorId?: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.encuestadorId) conditions.push(eq(pedestrianSessions.encuestadorId, filters.encuestadorId));
  if (filters?.dateFrom) conditions.push(gte(pedestrianSessions.date, filters.dateFrom));
  if (filters?.dateTo) conditions.push(lte(pedestrianSessions.date, filters.dateTo));
  const query = db.select().from(pedestrianSessions).orderBy(desc(pedestrianSessions.startedAt));
  if (conditions.length > 0) return query.where(and(...conditions));
  return query;
}

export async function createPedestrianInterval(data: InsertPedestrianInterval) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(pedestrianIntervals).values(data);
  return result[0];
}

export async function updatePedestrianInterval(id: number, data: Partial<InsertPedestrianInterval>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(pedestrianIntervals).set(data as any).where(eq(pedestrianIntervals.id, id));
}

export async function getIntervalsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pedestrianIntervals)
    .where(eq(pedestrianIntervals.sessionId, sessionId))
    .orderBy(pedestrianIntervals.intervalMinute);
}

// ─── Pedestrian Directions ────────────────────────────────────────────────────
import {
  pedestrianDirections,
  pedestrianPasses,
  InsertPedestrianPass,
} from "../drizzle/schema";

export async function getDirectionsByPoint(surveyPoint: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pedestrianDirections)
    .where(and(eq(pedestrianDirections.surveyPoint, surveyPoint), eq(pedestrianDirections.isActive, true)))
    .orderBy(pedestrianDirections.order, pedestrianDirections.id);
}

export async function getAllDirectionPoints() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ surveyPoint: pedestrianDirections.surveyPoint })
    .from(pedestrianDirections)
    .groupBy(pedestrianDirections.surveyPoint);
  return rows.map(r => r.surveyPoint);
}

export async function createPedestrianDirection(data: { surveyPoint: string; label: string; description?: string; order?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(pedestrianDirections).values({
    surveyPoint: data.surveyPoint,
    label: data.label,
    description: data.description ?? null,
    order: data.order ?? 0,
    isActive: true,
  });
  return result[0];
}

export async function updatePedestrianDirection(id: number, data: { label?: string; description?: string; isActive?: boolean; order?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(pedestrianDirections).set(data as any).where(eq(pedestrianDirections.id, id));
}

export async function deletePedestrianDirection(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(pedestrianDirections).where(eq(pedestrianDirections.id, id));
}

// ─── Pedestrian Passes ────────────────────────────────────────────────────────

export async function createPedestrianPass(data: InsertPedestrianPass) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(pedestrianPasses).values(data);
  return result[0];
}

export async function getPedestrianPasses(filters?: {
  encuestadorId?: number;
  surveyPoint?: string;
  dateFrom?: string;
  dateTo?: string;
  directionId?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.encuestadorId) conditions.push(eq(pedestrianPasses.encuestadorId, filters.encuestadorId));
  if (filters?.surveyPoint) conditions.push(eq(pedestrianPasses.surveyPoint, filters.surveyPoint));
  if (filters?.directionId) conditions.push(eq(pedestrianPasses.directionId, filters.directionId));
  if (filters?.dateFrom) {
    conditions.push(gte(pedestrianPasses.recordedAt, new Date(filters.dateFrom)));
  }
  if (filters?.dateTo) {
    const to = new Date(filters.dateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(pedestrianPasses.recordedAt, to));
  }
  const query = db.select().from(pedestrianPasses).orderBy(desc(pedestrianPasses.recordedAt));
  if (conditions.length > 0) return query.where(and(...conditions));
  return query;
}

export async function getPedestrianPassStats(filters?: {
  surveyPoint?: string;
  dateFrom?: string;
  dateTo?: string;
  encuestadorId?: number;
}) {
  const passes = await getPedestrianPasses(filters);
  // Agrupar por sentido
  const byDirection: Record<string, number> = {};
  let total = 0;
  for (const p of passes) {
    const key = p.directionLabel ?? "Sin sentido";
    byDirection[key] = (byDirection[key] ?? 0) + p.count;
    total += p.count;
  }
  // Agrupar por hora
  const byHour: Record<string, number> = {};
  for (const p of passes) {
    const h = new Date(p.recordedAt).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).slice(0, 2) + ":00";
    byHour[h] = (byHour[h] ?? 0) + p.count;
  }
  // Agrupar por punto
  const byPoint: Record<string, number> = {};
  for (const p of passes) {
    byPoint[p.surveyPoint] = (byPoint[p.surveyPoint] ?? 0) + p.count;
  }
  return { total, byDirection, byHour, byPoint, passes };
}

// ─── Survey Rejections ────────────────────────────────────────────────────────
import {
  surveyRejections,
  InsertSurveyRejection,
} from "../drizzle/schema";

export async function createSurveyRejection(data: InsertSurveyRejection) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(surveyRejections).values(data);
  return result[0];
}

export async function getSurveyRejections(filters?: {
  encuestadorId?: number;
  surveyType?: "residentes" | "visitantes";
  surveyPoint?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.encuestadorId) conditions.push(eq(surveyRejections.encuestadorId, filters.encuestadorId));
  if (filters?.surveyType) conditions.push(eq(surveyRejections.surveyType, filters.surveyType));
  if (filters?.surveyPoint) conditions.push(eq(surveyRejections.surveyPoint, filters.surveyPoint));
  if (filters?.dateFrom) conditions.push(gte(surveyRejections.rejectedAt, new Date(filters.dateFrom)));
  if (filters?.dateTo) {
    const to = new Date(filters.dateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(surveyRejections.rejectedAt, to));
  }
  const query = db.select().from(surveyRejections).orderBy(desc(surveyRejections.rejectedAt));
  if (conditions.length > 0) return query.where(and(...conditions));
  return query;
}

export async function getSurveyRejectionStats(filters?: {
  encuestadorId?: number;
  surveyType?: "residentes" | "visitantes";
  dateFrom?: string;
  dateTo?: string;
}) {
  const rejections = await getSurveyRejections(filters);
  const byType: Record<string, number> = { residentes: 0, visitantes: 0 };
  const byPoint: Record<string, number> = {};
  const byHour: Record<string, number> = {};
  const byEncuestador: Record<string, number> = {};
  for (const r of rejections) {
    byType[r.surveyType] = (byType[r.surveyType] ?? 0) + 1;
    if (r.surveyPoint) byPoint[r.surveyPoint] = (byPoint[r.surveyPoint] ?? 0) + 1;
    const h = new Date(r.rejectedAt).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).slice(0, 2) + ":00";
    byHour[h] = (byHour[h] ?? 0) + 1;
    const enc = r.encuestadorName ?? `ID ${r.encuestadorId}`;
    byEncuestador[enc] = (byEncuestador[enc] ?? 0) + 1;
  }
  return { total: rejections.length, byType, byPoint, byHour, byEncuestador, rejections };
}

// ─── Shifts (Turnos) ──────────────────────────────────────────────────────────

export async function createShift(data: InsertShift) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(shifts).values(data);
  return result;
}

export async function getShiftsByEncuestador(encuestadorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shifts)
    .where(eq(shifts.encuestadorId, encuestadorId))
    .orderBy(desc(shifts.shiftDate));
}

export async function getAllShifts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shifts).orderBy(desc(shifts.shiftDate));
}

export async function updateShift(id: number, data: Partial<InsertShift>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(shifts).set(data).where(eq(shifts.id, id));
}

export async function deleteShift(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(shifts).where(eq(shifts.id, id));
}

// ─── Shift Closures (Cierre de turno) ────────────────────────────────────────────────

export async function createShiftClosure(data: InsertShiftClosure) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(shiftClosures).values(data);
  return result;
}

export async function getShiftClosuresByEncuestador(encuestadorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shiftClosures)
    .where(eq(shiftClosures.encuestadorId, encuestadorId))
    .orderBy(desc(shiftClosures.closedAt));
}

export async function getAllShiftClosures() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shiftClosures).orderBy(desc(shiftClosures.closedAt));
}

// ─── Última localización de encuestadores ─────────────────────────────────────────────
export async function getLatestEncuestadorLocations() {
  const db = await getDb();
  if (!db) return [];
  // Get the most recent GPS location for each encuestador
  const result = await db.execute(sql`
    SELECT 
      sr.encuestadorId,
      sr.encuestadorName,
      sr.encuestadorIdentifier,
      sr.latitude,
      sr.longitude,
      sr.gpsAccuracy,
      sr.startedAt AS lastSeen,
      sr.surveyPoint
    FROM survey_responses sr
    INNER JOIN (
      SELECT encuestadorId, MAX(startedAt) AS maxDate
      FROM survey_responses
      WHERE latitude IS NOT NULL AND encuestadorId IS NOT NULL
      GROUP BY encuestadorId
    ) latest ON sr.encuestadorId = latest.encuestadorId AND sr.startedAt = latest.maxDate
    WHERE sr.latitude IS NOT NULL
    ORDER BY sr.startedAt DESC
  `);
  return ((result[0] as unknown) as any[]).map((row: any) => ({
    encuestadorId: row.encuestadorId,
    encuestadorName: row.encuestadorName,
    encuestadorIdentifier: row.encuestadorIdentifier,
    latitude: row.latitude,
    longitude: row.longitude,
    gpsAccuracy: row.gpsAccuracy,
    lastSeen: row.lastSeen,
    surveyPoint: row.surveyPoint,
  }));
}

/**
 * Obtiene todas las filas de survey_responses_flat con filtros opcionales.
 * Usada para la exportación CSV plana (una fila por encuesta, columna por pregunta).
 */
export async function getSurveyResponsesFlat(filters?: {
  encuestadorId?: number;
  surveyType?: string;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(surveyResponsesFlat).orderBy(surveyResponsesFlat.startedAt);
  return rows.filter((r) => {
    if (filters?.encuestadorId && r.encuestadorId !== filters.encuestadorId) return false;
    if (filters?.surveyType && r.surveyType !== filters.surveyType) return false;
    if (filters?.dateFrom && r.startedAt < filters.dateFrom) return false;
    if (filters?.dateTo && r.startedAt > filters.dateTo) return false;
    return true;
  });
}

// ─── Counting Sessions ────────────────────────────────────────────────────────
import {
  countingSessions,
  InsertCountingSession,
} from "../drizzle/schema";

export async function createCountingSession(data: InsertCountingSession) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(countingSessions).values(data);
  return result;
}

export async function finishCountingSession(id: number, data: {
  finishedAt: Date;
  totalPersons: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(countingSessions)
    .set({ finishedAt: data.finishedAt, totalPersons: data.totalPersons })
    .where(eq(countingSessions.id, id));
}

export async function getCountingSessions(filters?: {
  encuestadorId?: number;
  surveyPointCode?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.encuestadorId) conditions.push(eq(countingSessions.encuestadorId, filters.encuestadorId));
  if (filters?.surveyPointCode) conditions.push(eq(countingSessions.surveyPointCode, filters.surveyPointCode));
  if (filters?.dateFrom) conditions.push(gte(countingSessions.startedAt, new Date(filters.dateFrom)));
  if (filters?.dateTo) {
    const to = new Date(filters.dateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(countingSessions.startedAt, to));
  }
  const query = db.select().from(countingSessions).orderBy(desc(countingSessions.startedAt));
  if (conditions.length > 0) return query.where(and(...conditions));
  return query;
}
