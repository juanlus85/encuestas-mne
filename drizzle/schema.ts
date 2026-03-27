import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  decimal,
  json,
  bigint,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "encuestador", "revisor", "user"]).default("user").notNull(),
  // Login propio (username + password)
  username: varchar("username", { length: 64 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  // Encuestador-specific fields
  identifier: varchar("identifier", { length: 32 }), // e.g. ENC-01
  surveyTypeAssigned: mysqlEnum("surveyTypeAssigned", ["residentes", "visitantes", "ambos"]).default("ambos"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Survey Templates ─────────────────────────────────────────────────────────

export const surveyTemplates = mysqlTable("survey_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }),
  type: mysqlEnum("type", ["residentes", "visitantes"]).notNull(),
  description: text("description"),
  descriptionEn: text("descriptionEn"),
  isActive: boolean("isActive").default(true).notNull(),
  targetCount: int("targetCount").default(0).notNull(), // e.g. 300 or 400
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SurveyTemplate = typeof surveyTemplates.$inferSelect;
export type InsertSurveyTemplate = typeof surveyTemplates.$inferInsert;

// ─── Questions ────────────────────────────────────────────────────────────────

export const questions = mysqlTable("questions", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  order: int("order").notNull().default(0),
  type: mysqlEnum("type", ["single_choice", "multiple_choice", "text", "scale", "yes_no", "number"]).notNull(),
  text: text("text").notNull(),
  textEn: text("textEn"),
  options: json("options"), // Array of {value, label, labelEn}
  isRequired: boolean("isRequired").default(true).notNull(),
  requiresPhoto: boolean("requiresPhoto").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = typeof questions.$inferInsert;

// ─── Survey Responses ─────────────────────────────────────────────────────────

export const surveyResponses = mysqlTable("survey_responses", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  encuestadorId: int("encuestadorId").notNull(),

  // Trazabilidad completa
  encuestadorName: varchar("encuestadorName", { length: 255 }),
  encuestadorIdentifier: varchar("encuestadorIdentifier", { length: 32 }),
  deviceInfo: text("deviceInfo"), // user agent
  surveyPoint: varchar("surveyPoint", { length: 255 }), // punto de encuesta
  timeSlot: mysqlEnum("timeSlot", ["manana", "tarde", "noche", "fin_semana"]),

  // GPS
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  gpsAccuracy: decimal("gpsAccuracy", { precision: 8, scale: 2 }),

  // Timestamps
  startedAt: timestamp("startedAt").notNull(),
  finishedAt: timestamp("finishedAt"),

  // Language
  language: mysqlEnum("language", ["es", "en"]).default("es").notNull(),

  // Answers: JSON array of {questionId, answer}
  answers: json("answers").notNull(),

  // Status
  status: mysqlEnum("status", ["completa", "incompleta", "rechazada", "sustitucion"]).default("completa").notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SurveyResponse = typeof surveyResponses.$inferSelect;
export type InsertSurveyResponse = typeof surveyResponses.$inferInsert;

// ─── Photos ───────────────────────────────────────────────────────────────────

export const photos = mysqlTable("photos", {
  id: int("id").autoincrement().primaryKey(),
  responseId: int("responseId").notNull(),
  questionId: int("questionId"),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  url: text("url").notNull(),
  mimeType: varchar("mimeType", { length: 64 }).default("image/jpeg"),
  sizeBytes: bigint("sizeBytes", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = typeof photos.$inferInsert;

// ─── Field Metrics ────────────────────────────────────────────────────────────

export const fieldMetrics = mysqlTable("field_metrics", {
  id: int("id").autoincrement().primaryKey(),
  encuestadorId: int("encuestadorId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  templateId: int("templateId"),
  surveyPoint: varchar("surveyPoint", { length: 255 }),
  timeSlot: mysqlEnum("timeSlot", ["manana", "tarde", "noche", "fin_semana"]),

  // Metrics
  completed: int("completed").default(0).notNull(),
  rejected: int("rejected").default(0).notNull(),
  substituted: int("substituted").default(0).notNull(),
  incomplete: int("incomplete").default(0).notNull(),

  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FieldMetric = typeof fieldMetrics.$inferSelect;
export type InsertFieldMetric = typeof fieldMetrics.$inferInsert;

// ─── Pedestrian Counts ───────────────────────────────────────────────────────

/**
 * Sesión de conteo peatonal: una sesión por técnico, punto y franja horaria.
 * Contiene múltiples intervalos de 5 minutos.
 */
export const pedestrianSessions = mysqlTable("pedestrian_sessions", {
  id: int("id").autoincrement().primaryKey(),
  encuestadorId: int("encuestadorId").notNull(),
  encuestadorName: varchar("encuestadorName", { length: 255 }),
  encuestadorIdentifier: varchar("encuestadorIdentifier", { length: 32 }),

  // Localización y contexto
  surveyPoint: varchar("surveyPoint", { length: 255 }).notNull(),
  timeSlot: mysqlEnum("timeSlot", ["manana", "tarde", "noche", "fin_semana"]),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD

  // GPS de la sesión
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  gpsAccuracy: decimal("gpsAccuracy", { precision: 8, scale: 2 }),

  // Timestamps
  startedAt: timestamp("startedAt").notNull(),
  finishedAt: timestamp("finishedAt"),

  // Totales calculados (suma de todos los intervalos)
  totalIn: int("totalIn").default(0).notNull(),
  totalOut: int("totalOut").default(0).notNull(),

  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PedestrianSession = typeof pedestrianSessions.$inferSelect;
export type InsertPedestrianSession = typeof pedestrianSessions.$inferInsert;

/**
 * Intervalo de 5 minutos dentro de una sesión de conteo peatonal.
 * Cada intervalo registra entradas y salidas por dirección.
 */
export const pedestrianIntervals = mysqlTable("pedestrian_intervals", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),

  // Tiempo del intervalo
  intervalStart: timestamp("intervalStart").notNull(),
  intervalEnd: timestamp("intervalEnd").notNull(),
  intervalMinute: int("intervalMinute").notNull(), // minuto 0, 5, 10...

  // Conteos por dirección
  countIn: int("countIn").default(0).notNull(),   // entrando al barrio
  countOut: int("countOut").default(0).notNull(),  // saliendo del barrio

  // Foto del intervalo (opcional)
  photoUrl: text("photoUrl"),
  photoKey: varchar("photoKey", { length: 512 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PedestrianInterval = typeof pedestrianIntervals.$inferSelect;
export type InsertPedestrianInterval = typeof pedestrianIntervals.$inferInsert;
