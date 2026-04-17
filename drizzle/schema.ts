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
  timeSlot: mysqlEnum("timeSlot", ["manana", "mediodia", "tarde", "noche", "fin_semana"]),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  gpsAccuracy: decimal("gpsAccuracy", { precision: 8, scale: 2 }),

  // Timestamps
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt").defaultNow(),

  // Language
  language: mysqlEnum("language", ["es", "en"]).default("es").notNull(),

  // Answers: JSON array of {questionId, answer} — campo de auditoría completo
  answers: json("answers").notNull(),

  // Campos adicionales de metadatos
  windowCode: varchar("windowCode", { length: 16 }),     // ventana de 30 min (ej. V1, V2...)
  minuteStart: int("minuteStart"),                        // minuto de inicio de la entrevista
  minuteEnd: int("minuteEnd"),                            // minuto de fin de la entrevista
  earlyExit: boolean("earlyExit").default(false),         // salida anticipada (P1 residentes = NO)

  // ─── Respuestas VISITANTES (orders 7-26 → v_p01..v_p20) ──────────────────
  // P1. País de residencia
  v_p01: varchar("v_p01", { length: 255 }),
  // P1b. Si España → Provincia/Ciudad
  v_p02: varchar("v_p02", { length: 255 }),
  // P2. ¿Cuántas veces ha visitado Sevilla?
  v_p03: varchar("v_p03", { length: 64 }),
  // P3. ¿Cuántos días lleva en Sevilla?
  v_p04: varchar("v_p04", { length: 64 }),
  // P4. Rango de edad
  v_p05: varchar("v_p05", { length: 64 }),
  // P4b. Género
  v_p06: varchar("v_p06", { length: 64 }),
  // P5. Tipo de alojamiento
  v_p07: varchar("v_p07", { length: 64 }),
  // P5b. Zona de alojamiento
  v_p08: varchar("v_p08", { length: 255 }),
  // P6. Motivo principal de la visita
  v_p09: varchar("v_p09", { length: 64 }),
  // P7. Tamaño del grupo
  v_p10: varchar("v_p10", { length: 64 }),
  // P8. Tiempo en este lugar (minutos)
  v_p11: varchar("v_p11", { length: 64 }),
  // P9. Actividad principal en este lugar
  v_p12: varchar("v_p12", { length: 64 }),
  // P10. Gasto aproximado hoy en Sevilla
  v_p13: varchar("v_p13", { length: 64 }),
  // P11. Densidad percibida (1-5)
  v_p14: varchar("v_p14", { length: 8 }),
  // P12. Satisfacción general (1-5)
  v_p15: varchar("v_p15", { length: 8 }),
  // P13. Adaptación del espacio (1-5)
  v_p16: varchar("v_p16", { length: 8 }),
  // P14. ¿Volvería?
  v_p17: varchar("v_p17", { length: 64 }),
  // P15. ¿Recomendaría?
  v_p18: varchar("v_p18", { length: 64 }),
  // P16. Comentario libre
  v_p19: text("v_p19"),
  // P17. Nombre (opcional)
  v_p20: varchar("v_p20", { length: 255 }),

  // ─── Respuestas RESIDENTES (orders 5-38 → r_p01..r_p34) ──────────────
  // P1. ¿Vive en el centro histórico? (1=Sí, 2=No)
  r_p01: varchar("r_p01", { length: 16 }),
  // P1.1. ¿En qué calle? (solo si vive en centro histórico)
  r_p02: varchar("r_p02", { length: 255 }),
  // TERRITORIO (calculado): 1=Centro histórico, 2=Resto de Sevilla
  seccion037: int("seccion037").default(0),
  // P1.2. ¿Trabaja en el centro histórico? (1=Sí, 2=No)
  r_p03: varchar("r_p03", { length: 64 }),
  // P2. ¿Cuántos años lleva viviendo en el barrio? (solo si vive en centro histórico)
  r_p04: varchar("r_p04", { length: 64 }),
  // P4. Género
  r_p05: varchar("r_p05", { length: 64 }),
  // P5. Edad
  r_p06: varchar("r_p06", { length: 64 }),
  // P6.01 El turismo mejora la economía local (1-5)
  r_p07: varchar("r_p07", { length: 8 }),
  // P6.02 El turismo genera congestión (1-5)
  r_p08: varchar("r_p08", { length: 8 }),
  // P6.03 El turismo atrae inversores (1-5)
  r_p09: varchar("r_p09", { length: 8 }),
  // P6.04 El turismo encarece viviendas (1-5)
  r_p10: varchar("r_p10", { length: 8 }),
  // P6.05 El turismo aumenta calidad de vida (1-5)
  r_p11: varchar("r_p11", { length: 8 }),
  // P6.06 El turismo provoca desplazamientos (1-5)
  r_p12: varchar("r_p12", { length: 8 }),
  // P6.07 El turismo mejora imagen de la ciudad (1-5)
  r_p13: varchar("r_p13", { length: 8 }),
  // P6.08 El turismo contribuye a pérdida de identidad (1-5)
  r_p14: varchar("r_p14", { length: 8 }),
  // P6.09 El turismo conserva monumentos (1-5)
  r_p15: varchar("r_p15", { length: 8 }),
  // P6.10 El turismo genera ruido y suciedad (1-5)
  r_p16: varchar("r_p16", { length: 8 }),
  // P6.11 El turismo dificulta el comercio local (1-5)
  r_p17: varchar("r_p17", { length: 8 }),
  // P6.12 El turismo mejora la oferta cultural (1-5)
  r_p18: varchar("r_p18", { length: 8 }),
  // P6.13 El turismo encarece el coste de vida (1-5)
  r_p19: varchar("r_p19", { length: 8 }),
  // P6.14 El turismo fomenta la inseguridad (1-5)
  r_p20: varchar("r_p20", { length: 8 }),
  // P7. ¿Cómo valora la gestión del turismo en el barrio? (1-5)
  r_p21: varchar("r_p21", { length: 8 }),
  // P8. ¿Considera que hay demasiados turistas? (1-5)
  r_p22: varchar("r_p22", { length: 8 }),
  // P9. ¿Ha pensado en mudarse por el turismo?
  r_p23: varchar("r_p23", { length: 64 }),
  // P10. Frecuencia de uso del espacio público
  r_p24: varchar("r_p24", { length: 64 }),
  // P10b. Frecuencia de uso en verano
  r_p25: varchar("r_p25", { length: 64 }),
  // P10c. Frecuencia de uso en invierno
  r_p26: varchar("r_p26", { length: 64 }),
  // P10d. Frecuencia de uso en fines de semana
  r_p27: varchar("r_p27", { length: 64 }),
  // P10e. Motivo de reducción de uso
  r_p28: varchar("r_p28", { length: 64 }),
  // P10f. Problemas percibidos en el espacio público
  r_p29: varchar("r_p29", { length: 255 }),
  // P10g. Valoración del espacio público (1-5)
  r_p30: varchar("r_p30", { length: 8 }),
  // P10h. Valoración de la limpieza (1-5)
  r_p31: varchar("r_p31", { length: 8 }),
  // P10i. Valoración de la seguridad (1-5)
  r_p32: varchar("r_p32", { length: 8 }),
  // P11. ¿Cómo le afecta personalmente el turismo? (1-5)
  r_p33: varchar("r_p33", { length: 8 }),
  // P12. ¿Cómo afecta el turismo a su comunidad? (1-5)
  r_p34: varchar("r_p34", { length: 8 }),
  // P13. Medidas prioritarias (múltiple, hasta 3) → hasta 3 valores separados
  r_p35a: varchar("r_p35a", { length: 64 }),
  r_p35b: varchar("r_p35b", { length: 64 }),
  r_p35c: varchar("r_p35c", { length: 64 }),
  // P14. Observaciones finales
  r_p36: text("r_p36"),

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
  timeSlot: mysqlEnum("timeSlot", ["manana", "mediodia", "tarde", "noche", "fin_semana"]),
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
  timeSlot: mysqlEnum("timeSlot", ["manana", "mediodia", "tarde", "noche", "fin_semana"]),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD

  // GPS de la sesión
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  gpsAccuracy: decimal("gpsAccuracy", { precision: 8, scale: 2 }),

  // Timestamps
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt").defaultNow(),

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

// ─── Pedestrian Directions (sentidos por punto) ─────────────────────────────────

/**
 * Sentidos de paso definidos por el administrador para cada punto de conteo.
 * Ejemplo: punto "Mateos Gago" puede tener sentidos "A→B", "B→A", "A→C"...
 */
export const pedestrianDirections = mysqlTable("pedestrian_directions", {
  id: int("id").autoincrement().primaryKey(),
  surveyPoint: varchar("surveyPoint", { length: 255 }).notNull(), // nombre del punto
  label: varchar("label", { length: 128 }).notNull(),             // ej: "A → B"
  description: text("description"),                               // descripción opcional
  isActive: boolean("isActive").default(true).notNull(),
  order: int("order").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PedestrianDirection = typeof pedestrianDirections.$inferSelect;
export type InsertPedestrianDirection = typeof pedestrianDirections.$inferInsert;

// ─── Pedestrian Passes (pases individuales) ─────────────────────────────────────

/**
 * Cada pase registrado en campo: un grupo de N personas en un sentido determinado.
 * Cada vez que el encuestador pulsa "Añadir" se crea un registro.
 */
export const pedestrianPasses = mysqlTable("pedestrian_passes", {
  id: int("id").autoincrement().primaryKey(),
  encuestadorId: int("encuestadorId").notNull(),
  encuestadorName: varchar("encuestadorName", { length: 255 }),
  encuestadorIdentifier: varchar("encuestadorIdentifier", { length: 32 }),

  // Ubicación y contexto
  surveyPoint: varchar("surveyPoint", { length: 255 }).notNull(),     // nombre completo (ej: "01 Virgen de los Reyes")
  surveyPointCode: varchar("surveyPointCode", { length: 16 }),         // solo código (ej: "01")
  directionId: int("directionId"),           // FK a pedestrian_directions
  directionLabel: varchar("directionLabel", { length: 128 }), // desnormalizado para consultas rápidas
  flowOrigin: varchar("flowOrigin", { length: 128 }),          // código origen del flujo (ej: "01")
  flowDestination: varchar("flowDestination", { length: 128 }), // código destino del flujo (ej: "01.01")

  // El dato principal
  count: int("count").notNull(),             // número de personas en este pase

  // GPS en el momento del pase
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  gpsAccuracy: decimal("gpsAccuracy", { precision: 8, scale: 2 }),

  // Timestamp exacto del pase (para consultas por minuto, hora, franja)
  recordedAt: timestamp("recordedAt").notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PedestrianPass = typeof pedestrianPasses.$inferSelect;
export type InsertPedestrianPass = typeof pedestrianPasses.$inferInsert;

// ─── Counting Sessions (sesiones de conteo cronometradas) ───────────────────

/**
 * Sesión de conteo cronometrada: registra el inicio y fin de un conteo,
 * el total de personas contadas en ambos sentidos, el encuestador y el GPS.
 */
export const countingSessions = mysqlTable("counting_sessions", {
  id: int("id").autoincrement().primaryKey(),
  encuestadorId: int("encuestadorId").notNull(),
  encuestadorName: varchar("encuestadorName", { length: 255 }),
  encuestadorIdentifier: varchar("encuestadorIdentifier", { length: 32 }),

  // Punto de conteo
  surveyPointCode: varchar("surveyPointCode", { length: 16 }).notNull(), // ej: "01"
  surveyPointName: varchar("surveyPointName", { length: 255 }),           // ej: "01 Virgen de los Reyes"
  subPointCode: varchar("subPointCode", { length: 16 }),                  // ej: "01.01"
  subPointName: varchar("subPointName", { length: 255 }),                 // ej: "01.01 Alemanes"

  // Tiempos
  startedAt: timestamp("startedAt").notNull(),
  finishedAt: timestamp("finishedAt"),

  // Total personas (suma de todos los pases en ambos sentidos durante la sesión)
  totalPersons: int("totalPersons").default(0).notNull(),

  // GPS al inicio del conteo
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  gpsAccuracy: decimal("gpsAccuracy", { precision: 8, scale: 2 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CountingSession = typeof countingSessions.$inferSelect;
export type InsertCountingSession = typeof countingSessions.$inferInsert;

// ─── Survey Rejections (rechazos rápidos) ──────────────────────────────────

/**
 * Registro de rechazo rápido a la encuesta.
 * El encuestador pulsa "Rechazo" sin abrir el formulario completo.
 * Permite analizar la tasa de rechazo por punto, hora y tipo.
 */
export const surveyRejections = mysqlTable("survey_rejections", {
  id: int("id").autoincrement().primaryKey(),
  encuestadorId: int("encuestadorId").notNull(),
  encuestadorName: varchar("encuestadorName", { length: 255 }),
  encuestadorIdentifier: varchar("encuestadorIdentifier", { length: 32 }),

  // Tipo de encuesta rechazada
  surveyType: mysqlEnum("surveyType", ["residentes", "visitantes"]).notNull(),

  // Punto de encuesta
  surveyPoint: varchar("surveyPoint", { length: 255 }),

  // GPS en el momento del rechazo
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  gpsAccuracy: decimal("gpsAccuracy", { precision: 8, scale: 2 }),

  // Timestamp exacto del rechazo
  rejectedAt: timestamp("rejectedAt").notNull(),

  // Notas opcionales (motivo del rechazo)
  notes: text("notes"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SurveyRejection = typeof surveyRejections.$inferSelect;
export type InsertSurveyRejection = typeof surveyRejections.$inferInsert;

// ─── Turnos asignados ─────────────────────────────────────────────────────────
/**
 * Turnos de trabajo asignados a cada encuestador.
 * El administrador los crea/edita desde el panel de Usuarios.
 */
export const shifts = mysqlTable("shifts", {
  id: int("id").autoincrement().primaryKey(),
  encuestadorId: int("encuestadorId").notNull(),
  // Fecha del turno (YYYY-MM-DD)
  shiftDate: varchar("shiftDate", { length: 10 }).notNull(),
  // Hora de inicio y fin (HH:MM)
  startTime: varchar("startTime", { length: 5 }).notNull(),
  endTime: varchar("endTime", { length: 5 }).notNull(),
  // Punto de encuesta asignado
  surveyPoint: varchar("surveyPoint", { length: 255 }),
  // Tipo de encuesta asignada
  surveyType: mysqlEnum("surveyType", ["visitantes", "residentes", "conteo"]),
  // Notas del turno (instrucciones, observaciones del admin)
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Shift = typeof shifts.$inferSelect;
export type InsertShift = typeof shifts.$inferInsert;

// ─── Cierre de turno ──────────────────────────────────────────────────────────
/**
 * Registro de cierre de turno por parte del encuestador.
 * Incluye resumen de la jornada e incidencias.
 */
export const shiftClosures = mysqlTable("shift_closures", {
  id: int("id").autoincrement().primaryKey(),
  encuestadorId: int("encuestadorId").notNull(),
  encuestadorName: varchar("encuestadorName", { length: 255 }),
  shiftId: int("shiftId"), // Puede ser null si el turno no está asignado en BD
  // Fecha y hora de cierre
  closedAt: timestamp("closedAt").notNull(),
  // Resumen del turno
  totalEncuestas: int("totalEncuestas").default(0).notNull(),
  totalConteos: int("totalConteos").default(0),
  totalRechazos: int("totalRechazos").default(0),
  // Punto de trabajo
  surveyPoint: varchar("surveyPoint", { length: 255 }),
  surveyType: mysqlEnum("surveyType", ["visitantes", "residentes", "conteo"]),
  // Incidencias y observaciones
  incidencias: text("incidencias"),
  // Valoración del turno (1-5)
  valoracion: int("valoracion"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ShiftClosure = typeof shiftClosures.$inferSelect;
export type InsertShiftClosure = typeof shiftClosures.$inferInsert;

// ─── Survey Answers (respuestas normalizadas por columna) ─────────────────────
/**
 * Tabla normalizada de respuestas: una fila por pregunta por encuesta.
 * Facilita el análisis estadístico con SQL/Excel sin necesidad de parsear JSON.
 * Se rellena automáticamente al guardar una encuesta completa.
 *
 * Columnas:
 *   survey_id        → FK a survey_responses.id
 *   question_code    → código de la pregunta (ej. "V01", "R15")
 *   question_id      → ID numérico de la pregunta
 *   question_text_es → texto de la pregunta en español
 *   question_text_en → texto de la pregunta en inglés
 *   answer_value     → valor de la respuesta (string, número, o JSON si es array)
 *   answer_label_es  → etiqueta legible en español (para opciones de lista)
 *   answer_label_en  → etiqueta legible en inglés
 *   survey_type      → "visitantes" | "residentes"
 *   survey_point     → punto de encuesta
 *   encuestador_id   → FK a users.id
 *   recorded_at      → timestamp de la encuesta
 */
export const surveyAnswers = mysqlTable("survey_answers", {
  id: int("id").autoincrement().primaryKey(),
  // FK a la encuesta principal
  surveyId: int("surveyId").notNull(),
  // Identificación de la pregunta
  questionCode: varchar("questionCode", { length: 16 }).notNull(),   // ej. "V01", "R15"
  questionId: int("questionId").notNull(),                            // ID numérico
  questionTextEs: text("questionTextEs"),                             // texto ES
  questionTextEn: text("questionTextEn"),                             // texto EN
  // La respuesta
  answerValue: text("answerValue"),                                   // valor crudo (string/número/JSON)
  answerLabelEs: text("answerLabelEs"),                               // etiqueta legible ES
  answerLabelEn: text("answerLabelEn"),                               // etiqueta legible EN
  // Contexto de la encuesta (desnormalizado para consultas rápidas)
  surveyType: mysqlEnum("surveyType", ["visitantes", "residentes"]).notNull(),
  surveyPoint: varchar("surveyPoint", { length: 255 }),
  encuestadorId: int("encuestadorId").notNull(),
  encuestadorName: varchar("encuestadorName", { length: 255 }),
  encuestadorIdentifier: varchar("encuestadorIdentifier", { length: 32 }),
  recordedAt: timestamp("recordedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SurveyAnswer = typeof surveyAnswers.$inferSelect;
export type InsertSurveyAnswer = typeof surveyAnswers.$inferInsert;

// ─── Survey Responses Flat (una fila por encuesta, columnas por pregunta) ──────
/**
 * Tabla desnormalizada: UNA FILA POR ENCUESTA.
 * Cada pregunta tiene su propia columna (R01..R38 para residentes, V01..V26 para visitantes).
 * Facilita el análisis directo con SQL/Excel/SPSS sin parsear JSON.
 *
 * Metadatos de campo (calculados automáticamente, no preguntados al encuestador):
 *   survey_id          → FK a survey_responses.id (fuente de verdad)
 *   survey_type        → "visitantes" | "residentes"
 *   survey_number      → número correlativo de encuesta (0001, 0002...)
 *   survey_point       → punto de encuesta (seleccionado antes del formulario)
 *   time_slot          → franja horaria calculada automáticamente
 *   window_code        → ventana de 30 min calculada automáticamente
 *   minute_start       → minuto de inicio de la entrevista
 *   minute_end         → minuto de fin de la entrevista
 *   encuestador_id     → FK a users.id
 *   encuestador_name   → nombre del encuestador
 *   encuestador_code   → identificador del encuestador
 *   started_at         → timestamp de inicio
 *   finished_at        → timestamp de fin
 *   latitude           → GPS latitud
 *   longitude          → GPS longitud
 *   gps_accuracy       → precisión GPS en metros
 *   language           → idioma de la encuesta (es/en)
 *   status             → completa | incompleta | rechazada | sustitucion
 *   early_exit         → true si la encuesta terminó anticipadamente (P1 residentes = NO)
 *
 * Respuestas de visitantes (V01..V26):
 *   v01..v26           → respuestas a las preguntas P1..P18 de visitantes
 *
 * Respuestas de residentes (R01..R38):
 *   r01..r38           → respuestas a las preguntas P1..P14 de residentes
 */
export const surveyResponsesFlat = mysqlTable("survey_responses_flat", {
  id: int("id").autoincrement().primaryKey(),
  // FK a la encuesta principal
  surveyId: int("surveyId").notNull(),
  // Tipo de encuesta
  surveyType: mysqlEnum("surveyType", ["visitantes", "residentes"]).notNull(),
  // Metadatos de campo
  surveyNumber: varchar("surveyNumber", { length: 8 }),         // "0001", "0002"...
  surveyPoint: varchar("surveyPoint", { length: 255 }),
  timeSlot: varchar("timeSlot", { length: 32 }),                // "manana", "tarde", etc.
  windowCode: varchar("windowCode", { length: 16 }),            // "10:00-10:30"
  minuteStart: varchar("minuteStart", { length: 5 }),           // "10:05"
  minuteEnd: varchar("minuteEnd", { length: 5 }),               // "10:18"
  encuestadorId: int("encuestadorId").notNull(),
  encuestadorName: varchar("encuestadorName", { length: 255 }),
  encuestadorCode: varchar("encuestadorCode", { length: 32 }),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt").defaultNow(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  gpsAccuracy: decimal("gpsAccuracy", { precision: 8, scale: 2 }),
  language: mysqlEnum("language", ["es", "en"]).default("es").notNull(),
  status: mysqlEnum("status", ["completa", "incompleta", "rechazada", "sustitucion"]).default("completa").notNull(),
  earlyExit: boolean("earlyExit").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  // ── Respuestas VISITANTES (V01..V26) ──────────────────────────────────────
  v01: text("v01"),   // P1. País de residencia
  v02: text("v02"),   // P1b. Provincia/Ciudad (si España)
  v03: text("v03"),   // P2. ¿Primera vez en Sevilla?
  v04: text("v04"),   // P3. Días de estancia
  v05: text("v05"),   // P4. Rango de edad
  v06: text("v06"),   // P4b. Género
  v07: text("v07"),   // P5. Motivo principal de visita
  v08: text("v08"),   // P6. ¿Con quién viaja?
  v09: text("v09"),   // P6b. Número de personas en grupo
  v10: text("v10"),   // P7. Cómo llegó al punto
  v11: text("v11"),   // P8. Qué le llevó a este punto
  v12: text("v12"),   // P9. ¿Modificó recorrido por la gente?
  v13: text("v13"),   // P11. Cantidad de gente (1-5)
  v14: text("v14"),   // P12. Afecta a su experiencia (1-5)
  v15: text("v15"),   // P13. Nivel de afluencia le resulta...
  v16: text("v16"),   // P14. Adaptación del espacio (1-5)
  v17: text("v17"),   // P15. Uso principal del espacio
  v18: text("v18"),   // P16. Qué le gusta más
  v19: text("v19"),   // P17. Qué le incomoda
  v20: text("v20"),   // P18. Recomendaría este punto (1-5)
  v21: text("v21"),   // (reserva)
  v22: text("v22"),   // (reserva)
  v23: text("v23"),   // (reserva)
  v24: text("v24"),   // (reserva)
  v25: text("v25"),   // (reserva)
  v26: text("v26"),   // (reserva)
  // ── Respuestas RESIDENTES (R01..R38) ────────────────────────────────────────────
  r01: text("r01"),   // P1. ¿Vive en el centro histórico? (1=Sí, 2=No)
  r02: text("r02"),   // P1.1. ¿En qué calle? (solo si vive en centro histórico)
  seccion037: int("seccion037").default(0),  // TERRITORIO: 1=Centro histórico, 2=Resto de Sevilla
  r03: text("r03"),   // P1.2. ¿Trabaja en el centro histórico? (1=Sí, 2=No)
  r04: text("r04"),   // P2. Años viviendo en el barrio (solo si vive en centro histórico)
  r05: text("r05"),   // P4. Género
  r06: text("r06"),   // P5. Edad
  r07: text("r07"),   // P6.01. Turismo mejora economía local
  r08: text("r08"),   // P6.02. Turismo genera congestión
  r09: text("r09"),   // P6.03. Turismo atrae inversores
  r10: text("r10"),   // P6.04. Turismo encarece viviendas
  r11: text("r11"),   // P6.05. Turismo aumenta calidad de vida
  r12: text("r12"),   // P6.06. Turismo provoca desplazamientos
  r13: text("r13"),   // P6.07. Turismo mejora prestigio ciudad
  r14: text("r14"),   // P6.08. Turismo pérdida identidad/cultura
  r15: text("r15"),   // P6.09. Turismo conserva monumentos
  r16: text("r16"),   // P6.10. Turismo aumenta tráfico
  r17: text("r17"),   // P6.11. Turismo incrementa ocio
  r18: text("r18"),   // P6.12. Turismo mejora servicios
  r19: text("r19"),   // P6.13. Turismo consume recursos
  r20: text("r20"),   // P6.14. Turismo aumenta contaminación
  r21: text("r21"),   // P6.15. Turismo sociedad más tolerante
  r22: text("r22"),   // P7a. Frecuencia: Compras en el barrio
  r23: text("r23"),   // P7b. Frecuencia: Restaurantes/bares
  r24: text("r24"),   // P7c. Frecuencia: Espacios culturales
  r25: text("r25"),   // P7d. Frecuencia: Espacios naturales
  r26: text("r26"),   // P7e. Frecuencia: Transporte público
  r27: text("r27"),   // P7f. Frecuencia: A pie o en bicicleta
  r28: text("r28"),   // P8. ¿Ha modificado comportamiento por turistas?
  r29: text("r29"),   // P9. Situaciones experimentadas (múltiple)
  r30: text("r30"),   // P10. Presencia turística cambió uso espacio público (1-5)
  r31: text("r31"),   // P11. Cómo le afecta el turismo (1-5)
  r32: text("r32"),   // P12. Cómo afecta el turismo a su comunidad (1-5)
  r33: text("r33"),   // P13. Medidas a priorizar (múltiple)
  r34: text("r34"),   // P14. Observaciones/comentarios finales
  r35: text("r35"),   // (reserva)
  r36: text("r36"),   // (reserva)
  r37: text("r37"),   // (reserva)
  r38: text("r38"),   // (reserva)
});
export type SurveyResponseFlat = typeof surveyResponsesFlat.$inferSelect;
export type InsertSurveyResponseFlat = typeof surveyResponsesFlat.$inferInsert;
