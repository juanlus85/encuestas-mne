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
  surveyResponses,
  surveyTemplates,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

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
  return db.select().from(questions).where(eq(questions.templateId, templateId)).orderBy(questions.order);
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
      latitude: surveyResponses.latitude,
      longitude: surveyResponses.longitude,
      gpsAccuracy: surveyResponses.gpsAccuracy,
      startedAt: surveyResponses.startedAt,
      finishedAt: surveyResponses.finishedAt,
      language: surveyResponses.language,
      answers: surveyResponses.answers,
      status: surveyResponses.status,
      createdAt: surveyResponses.createdAt,
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
    residentes: sql<number>`SUM(CASE WHEN t.type = 'residentes' THEN 1 ELSE 0 END)`,
    visitantes: sql<number>`SUM(CASE WHEN t.type = 'visitantes' THEN 1 ELSE 0 END)`,
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
    residentes: sql<number>`SUM(CASE WHEN t.type = 'residentes' THEN 1 ELSE 0 END)`,
    visitantes: sql<number>`SUM(CASE WHEN t.type = 'visitantes' THEN 1 ELSE 0 END)`,
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
    residentes: sql<number>`SUM(CASE WHEN t.type = 'residentes' THEN 1 ELSE 0 END)`,
    visitantes: sql<number>`SUM(CASE WHEN t.type = 'visitantes' THEN 1 ELSE 0 END)`,
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
