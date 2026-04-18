import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createPhoto,
  createPedestrianInterval,
  createPedestrianSession,
  createQuestion,
  createSurveyResponse,
  createSurveyTemplate,
  createUser,
  deleteQuestion,
  getActiveSurveyTemplates,
  getAllUsers,
  getDashboardStats,
  getEncuestadores,
  getFieldMetrics,
  getGpsLocations,
  getLatestEncuestadorLocations,
  getIntervalsBySession,
  getPedestrianSessionById,
  getPedestrianSessions,
  getPhotosByResponse,
  getQuestionsByTemplate,
  getResponsesByDay,
  getResponsesByEncuestador,
  getResponsesByTimeSlot,
  getSurveyResponseById,
  getSurveyResponses,
  getSurveyResponsesByEncuestador,
  getSurveyTemplateById,
  getSurveyTemplates,
  updatePedestrianInterval,
  updatePedestrianSession,
  updateQuestion,
  updateSurveyTemplate,
  updateUser,
  updateUserPassword,
  upsertFieldMetric,
  createPedestrianPass,
  getPedestrianPasses,
  getPedestrianPassStats,
  createPedestrianDirection,
  updatePedestrianDirection,
  deletePedestrianDirection,
  getDirectionsByPoint,
  getAllDirectionPoints,
  createSurveyRejection,
  getSurveyRejections,
  getSurveyRejectionStats,
  createCountingSession,
  finishCountingSession,
  getCountingSessions,
  createShift,
  getAllShifts,
  getShiftsByEncuestador,
  updateShift,
  deleteShift,
  createShiftClosure,
  getShiftClosuresByEncuestador,
  getAllShiftClosures,
  insertSurveyAnswers,
  insertSurveyResponseFlat,
  getSurveyResponsesFlat,
} from "./db";
import { hashPassword } from "./_core/localAuth";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import {
  VISITANTES_QUOTAS,
  RESIDENTES_QUOTAS,
  VISITANTES_QUESTION_IDS,
  RESIDENTES_QUESTION_IDS,
  clasificarProcedencia,
  clasificarEdadResidente,
  tieneVinculoTurismo,
} from "@shared/quotas";
import { getSeccion037 } from "@shared/calles";

// ─── Codificación numérica de respuestas ────────────────────────────────────
// Convierte valores de texto a códigos numéricos para almacenamiento en BD
const ANSWER_CODES: Record<string, string> = {
  // Sí/No
  "si": "1",
  "sí": "1",
  "yes": "1",
  "no": "2",
  // Género
  "hombre": "1",
  "mujer": "2",
  "otro": "3",
  // NS/NC
  "ns": "99",
  "nc": "99",
  "ns_nc": "99",
  "ns/nc": "99",
  "no_sabe": "99",
  "no_contesta": "99",
  "no_responde": "99",
};

/**
 * Codifica una respuesta de texto a su código numérico si existe mapeo.
 * Si no hay mapeo, devuelve el valor original.
 */
function encodeAnswer(val: string | null): string | null {
  if (val === null || val === undefined) return null;
  const lower = val.toLowerCase().trim();
  return ANSWER_CODES[lower] ?? val;
}

// ─── Middleware helpers ───────────────────────────────────────────────────────

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Solo administradores" });
  return next({ ctx });
});

const adminOrRevisorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "revisor") throw new TRPCError({ code: "FORBIDDEN", message: "Acceso restringido" });
  return next({ ctx });
});

const encuestadorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["admin", "encuestador"].includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Solo encuestadores" });
  return next({ ctx });
});

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Users ─────────────────────────────────────────────────────────────────

  users: router({
    list: adminProcedure.query(() => getAllUsers()),
    encuestadores: protectedProcedure.query(() => getEncuestadores()),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(2),
        email: z.string().email().optional(),
        role: z.enum(["admin", "encuestador", "revisor"]),
        identifier: z.string().optional(),
        surveyTypeAssigned: z.enum(["residentes", "visitantes", "ambos"]).optional(),
        openId: z.string(),
        // Optional local login credentials
        username: z.string().min(3).max(64).optional(),
        password: z.string().min(6).optional(),
      }))
      .mutation(async ({ input }) => {
        const { password, ...rest } = input;
        const passwordHash = password ? await hashPassword(password) : undefined;
        const username = rest.username ? rest.username.trim().toLowerCase() : undefined;
        await createUser({
          ...rest,
          username,
          passwordHash,
          loginMethod: "manual",
          lastSignedIn: new Date(),
        });
        return { success: true };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        role: z.enum(["admin", "encuestador", "revisor", "user"]).optional(),
        identifier: z.string().optional(),
        surveyTypeAssigned: z.enum(["residentes", "visitantes", "ambos"]).optional(),
        isActive: z.boolean().optional(),
        username: z.string().min(3).max(64).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, username, ...data } = input;
        const updateData: Record<string, unknown> = { ...data };
        if (username !== undefined) updateData.username = username.trim().toLowerCase();
        await updateUser(id, updateData);
        return { success: true };
      }),

    // Set or reset a user's password (admin only)
    setPassword: adminProcedure
      .input(z.object({
        id: z.number(),
        password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
      }))
      .mutation(async ({ input }) => {
        const hash = await hashPassword(input.password);
        await updateUserPassword(input.id, hash);
        return { success: true };
      }),
  }),

  // ─── Survey Templates ───────────────────────────────────────────────────────

  templates: router({
    list: protectedProcedure.query(() => getSurveyTemplates()),
    active: protectedProcedure.query(async ({ ctx }) => {
      const all = await getActiveSurveyTemplates();
      // Si el usuario es encuestador con tipo asignado, filtrar
      const assigned = (ctx.user as any).surveyTypeAssigned;
      if (ctx.user.role === "encuestador" && assigned && assigned !== "ambos") {
        return all.filter((t: any) => t.type === assigned);
      }
      return all;
    }),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const template = await getSurveyTemplateById(input.id);
        if (!template) throw new TRPCError({ code: "NOT_FOUND" });
        const qs = await getQuestionsByTemplate(input.id);
        return { ...template, questions: qs };
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(2),
        nameEn: z.string().optional(),
        type: z.enum(["residentes", "visitantes"]),
        description: z.string().optional(),
        descriptionEn: z.string().optional(),
        targetCount: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        await createSurveyTemplate(input);
        return { success: true };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        nameEn: z.string().optional(),
        type: z.enum(["residentes", "visitantes"]).optional(),
        description: z.string().optional(),
        descriptionEn: z.string().optional(),
        targetCount: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateSurveyTemplate(id, data);
        return { success: true };
      }),
  }),

  // ─── Questions ──────────────────────────────────────────────────────────────

  questions: router({
    byTemplate: protectedProcedure
      .input(z.object({ templateId: z.number() }))
      .query(({ input }) => getQuestionsByTemplate(input.templateId)),

    create: adminProcedure
      .input(z.object({
        templateId: z.number(),
        order: z.number(),
        type: z.enum(["single_choice", "multiple_choice", "text", "scale", "yes_no", "number"]),
        text: z.string().min(1),
        textEn: z.string().optional(),
        options: z.array(z.object({ value: z.string(), label: z.string(), labelEn: z.string().optional() })).optional(),
        isRequired: z.boolean().default(true),
        requiresPhoto: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        await createQuestion(input as any);
        return { success: true };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        order: z.number().optional(),
        text: z.string().optional(),
        textEn: z.string().optional(),
        options: z.any().optional(),
        isRequired: z.boolean().optional(),
        requiresPhoto: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateQuestion(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteQuestion(input.id);
        return { success: true };
      }),
  }),

  // ─── Survey Responses ───────────────────────────────────────────────────────

  responses: router({
    submit: encuestadorProcedure
      .input(z.object({
        templateId: z.number(),
        surveyPoint: z.string().optional(),
        timeSlot: z.enum(["manana", "mediodia", "tarde", "noche", "fin_semana"]).optional(),
        windowCode: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        gpsAccuracy: z.number().optional(),
        startedAt: z.date().optional(),   // opcional: si no viene, se genera en el servidor
        finishedAt: z.date().optional(),
        language: z.enum(["es", "en"]).default("es"),
        answers: z.array(z.object({ questionId: z.number(), answer: z.any() })),
        status: z.enum(["completa", "incompleta", "rechazada", "sustitucion"]).default("completa"),
        deviceInfo: z.string().optional(),
        earlyExit: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // ── Construir columnas por pregunta (v_p01..v_p20 / r_p01..r_p36) ──────
        let flatCols: Record<string, string | null> = {};
        try {
          const tplQuestions = await getQuestionsByTemplate(input.templateId);
          const tpl = await getSurveyTemplateById(input.templateId);
          const sType = (tpl?.type ?? "visitantes") as "visitantes" | "residentes";
          const metaCount = sType === "visitantes" ? 6 : 4;
          const qMapById = new Map(tplQuestions.map((q) => [q.id, q]));
          // Construir mapa order → valor de respuesta (string)
          const answerByOrder: Record<number, string> = {};
          for (const a of input.answers) {
            const q = qMapById.get(a.questionId);
            if (!q) continue;
            const rawVal = a.answer;
            let strVal: string;
            if (Array.isArray(rawVal)) strVal = JSON.stringify(rawVal);
            else if (rawVal === null || rawVal === undefined) strVal = "";
            else strVal = String(rawVal);
            answerByOrder[q.order] = strVal;
          }
          // Mapear a columnas v_p01..v_p20 o r_p01..r_p36
          const prefix = sType === "visitantes" ? "v" : "r";
          const realQuestions = tplQuestions.filter((q) => !q.text.startsWith("META:"));
          for (const q of realQuestions) {
            const colIdx = q.order - metaCount;
            const rawVal = answerByOrder[q.order] ?? null;
            if (sType === "visitantes") {
              // v_p01..v_p20 — codificar Si/No, género, NS/NC
              const colName = `v_p${String(colIdx).padStart(2, "0")}`;
              flatCols[colName] = encodeAnswer(rawVal);
            } else {
              // r_p01..r_p37 (normales) + r_p35a/b/c (múltiple, order 40 = colIdx 36)
              if (colIdx === 36) {
                // P13 múltiple: r_p35a, r_p35b, r_p35c
                let vals: string[] = [];
                try { vals = rawVal ? JSON.parse(rawVal) : []; } catch { vals = rawVal ? [rawVal] : []; }
                flatCols["r_p35a"] = encodeAnswer(vals[0] ?? null);
                flatCols["r_p35b"] = encodeAnswer(vals[1] ?? null);
                flatCols["r_p35c"] = encodeAnswer(vals[2] ?? null);
              } else {
                const colName = `r_p${String(colIdx).padStart(2, "0")}`;
                flatCols[colName] = encodeAnswer(rawVal);
              }
            }
          }
          // Calcular seccion037 para residentes: r_p02 = P1.0 ¿Vive en centro histórico? (1=Sí, 2=No)
          // Si r_p02 = "1" (Sí) → seccion037 = 1 (Centro histórico)
          // Si r_p02 = "2" (No) → seccion037 = 2 (Resto de Sevilla)
          if (sType === "residentes") {
            const viveCentro = flatCols["r_p02"] as string | null;
            if (viveCentro === "1" || viveCentro?.toLowerCase() === "si" || viveCentro?.toLowerCase() === "sí") {
              flatCols["seccion037"] = "1";
            } else if (viveCentro === "2" || viveCentro?.toLowerCase() === "no") {
              flatCols["seccion037"] = "2";
            }
          }
        } catch (err) {
          console.error("[responses.submit] Error construyendo columnas planas:", err);
        }

        // Log flatCols para diagnóstico
        console.log("[responses.submit] flatCols keys:", Object.keys(flatCols).sort().join(", "));
        console.log("[responses.submit] flatCols values sample:", JSON.stringify(Object.fromEntries(Object.entries(flatCols).slice(0, 10))));
        
        let result;
        try {
          result = await createSurveyResponse({
            ...input,
            ...flatCols,
            encuestadorId: ctx.user.id,
            encuestadorName: ctx.user.name ?? "",
            encuestadorIdentifier: ctx.user.identifier ?? "",
            latitude: input.latitude?.toString(),
            longitude: input.longitude?.toString(),
            gpsAccuracy: input.gpsAccuracy?.toString(),
            answers: input.answers,
            // startedAt y finishedAt usan DEFAULT NOW() de TiDB (igual que createdAt)
          });
        } catch (dbErr: any) {
          console.error("[responses.submit] DB INSERT error:", {
            message: dbErr?.message,
            code: dbErr?.code,
            errno: dbErr?.errno,
            sqlState: dbErr?.sqlState,
            sqlMessage: dbErr?.sqlMessage,
            sql: dbErr?.sql?.substring(0, 500),
          });
          throw dbErr;
        }
        const surveyId = result?.insertId as number | undefined;
        // Si la encuesta se guardó correctamente y está completa, insertar en survey_answers
        if (surveyId && input.status === "completa") {
          try {
            // Obtener las preguntas del template para enriquecer los datos
            const templateQuestions = await getQuestionsByTemplate(input.templateId);
            const qMap = new Map(templateQuestions.map((q) => [q.id, q]));
            // Obtener el tipo de encuesta (visitantes/residentes)
            const template = await getSurveyTemplateById(input.templateId);
            const surveyType = (template?.type ?? "visitantes") as "visitantes" | "residentes";
            const recordedAt = new Date(); // hora del servidor
            const answerRows = input.answers.map((a, idx) => {
              const q = qMap.get(a.questionId);
              const opts = (q?.options as Array<{ value: string; label: string; labelEn?: string }> | null) ?? [];
              // Convertir la respuesta a string (si es array, JSON)
              const rawVal = a.answer;
              let answerValue: string;
              if (Array.isArray(rawVal)) {
                answerValue = JSON.stringify(rawVal);
              } else if (rawVal === null || rawVal === undefined) {
                answerValue = "";
              } else {
                answerValue = String(rawVal);
              }
              // Buscar etiquetas legibles si es opción de lista
              let labelEs: string | undefined;
              let labelEn: string | undefined;
              if (opts.length > 0) {
                if (Array.isArray(rawVal)) {
                  const labels = (rawVal as string[]).map((v) => {
                    const opt = opts.find((o) => o.value === v);
                    return opt ? { es: opt.label, en: opt.labelEn ?? opt.label } : { es: v, en: v };
                  });
                  labelEs = labels.map((l) => l.es).join(", ");
                  labelEn = labels.map((l) => l.en).join(", ");
                } else {
                  const opt = opts.find((o) => o.value === String(rawVal));
                  if (opt) { labelEs = opt.label; labelEn = opt.labelEn ?? opt.label; }
                }
              }
              // Código de pregunta: "V" + orden para visitantes, "R" + orden para residentes
              const prefix = surveyType === "visitantes" ? "V" : "R";
              const order = q?.order ?? idx + 1;
              const questionCode = `${prefix}${String(order).padStart(2, "0")}`;
              return {
                surveyId,
                questionCode,
                questionId: a.questionId,
                questionTextEs: q?.text ?? "",
                questionTextEn: q?.textEn ?? q?.text ?? "",
                answerValue,
                answerLabelEs: labelEs,
                answerLabelEn: labelEn,
                surveyType,
                surveyPoint: input.surveyPoint,
                encuestadorId: ctx.user.id,
                encuestadorName: ctx.user.name ?? "",
                encuestadorIdentifier: ctx.user.identifier ?? "",
                recordedAt,
              };
            });
            await insertSurveyAnswers(answerRows);
          } catch (err) {
            // No bloquear la respuesta si falla la inserción normalizada
            console.error("[survey_answers] Error al insertar respuestas normalizadas:", err);
          }
          // ── Insertar en survey_responses_flat (una fila por encuesta) ──────────
          try {
            const template2 = await getSurveyTemplateById(input.templateId);
            const surveyType2 = (template2?.type ?? "visitantes") as "visitantes" | "residentes";
            const templateQuestions2 = await getQuestionsByTemplate(input.templateId);
            // Filtrar preguntas META (text empieza con "META:")
            const realQuestions = templateQuestions2.filter((q) => !q.text.startsWith("META:"));
            // Offset de orden: para visitantes las META son orders 1-6, para residentes 1-4
            const metaCount = surveyType2 === "visitantes" ? 6 : 4;
            // Construir mapa order → answer
            const qMap2 = new Map(templateQuestions2.map((q) => [q.id, q]));
            const answerByOrder: Record<number, string> = {};
            for (const a of input.answers) {
              const q = qMap2.get(a.questionId);
              if (!q) continue;
              const rawVal = a.answer;
              let strVal: string;
              if (Array.isArray(rawVal)) strVal = JSON.stringify(rawVal);
              else if (rawVal === null || rawVal === undefined) strVal = "";
              else strVal = String(rawVal);
              answerByOrder[q.order] = strVal;
            }
            // Construir el objeto flat
            const flatRow: Record<string, unknown> = {
              surveyId,
              surveyType: surveyType2,
              surveyPoint: input.surveyPoint,
              timeSlot: input.timeSlot,
              windowCode: input.windowCode,
              encuestadorId: ctx.user.id,
              encuestadorName: ctx.user.name ?? "",
              encuestadorCode: ctx.user.identifier ?? "",
              // startedAt y finishedAt usan DEFAULT NOW() de TiDB
              latitude: input.latitude?.toString(),
              longitude: input.longitude?.toString(),
              gpsAccuracy: input.gpsAccuracy?.toString(),
              language: input.language,
              status: input.status,
              earlyExit: input.earlyExit ?? false,
            };
            // Mapear respuestas a columnas vXX / rXX — codificar Si/No, género, NS/NC
            const prefix2 = surveyType2 === "visitantes" ? "v" : "r";
            for (const q of realQuestions) {
              const colIdx = q.order - metaCount; // 1-based index of real question
              const colName = `${prefix2}${String(colIdx).padStart(2, "0")}`;
              const rawAns = (answerByOrder[q.order] ?? null) as string | null;
              flatRow[colName] = encodeAnswer(rawAns);
            }
            // Calcular seccion037 para residentes: r02 = P1.0 ¿Vive en centro histórico? (1=Sí, 2=No)
            if (surveyType2 === "residentes") {
              const viveCentro = flatRow["r02"] as string | null;
              if (viveCentro === "1" || viveCentro?.toLowerCase() === "si" || viveCentro?.toLowerCase() === "sí") {
                flatRow["seccion037"] = 1;
              } else if (viveCentro === "2" || viveCentro?.toLowerCase() === "no") {
                flatRow["seccion037"] = 2;
              }
            }
            await insertSurveyResponseFlat(flatRow as any);
          } catch (err) {
            console.error("[survey_responses_flat] Error al insertar fila plana:", err);
          }
        }
        return { success: true, id: surveyId };
      }),

    list: adminOrRevisorProcedure
      .input(z.object({
        encuestadorId: z.number().optional(),
        templateId: z.number().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        status: z.string().optional(),
      }).optional())
      .query(({ input }) => getSurveyResponses(input)),

    myList: encuestadorProcedure
      .query(({ ctx }) => getSurveyResponsesByEncuestador(ctx.user.id)),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const response = await getSurveyResponseById(input.id);
        if (!response) throw new TRPCError({ code: "NOT_FOUND" });
        const responsePhotos = await getPhotosByResponse(input.id);
        // Parse defensivo: en MySQL estándar (VPS) el campo JSON puede llegar como string
        const rawAnswers = response.answers;
        const parsedAnswers = typeof rawAnswers === "string"
          ? (() => { try { return JSON.parse(rawAnswers); } catch { return []; } })()
          : (Array.isArray(rawAnswers) ? rawAnswers : []);
        return { ...response, answers: parsedAnswers, photos: responsePhotos };
      }),
  }),

  // ─── Photos ─────────────────────────────────────────────────────────────────

  photos: router({
    upload: encuestadorProcedure
      .input(z.object({
        responseId: z.number(),
        questionId: z.number().optional(),
        base64: z.string(), // base64 encoded image
        mimeType: z.string().default("image/jpeg"),
        sizeBytes: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const suffix = nanoid(8);
        const ext = input.mimeType === "image/png" ? "png" : "jpg";
        const fileKey = `encuestas/photos/${input.responseId}/${suffix}.${ext}`;
        const buffer = Buffer.from(input.base64, "base64");
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        await createPhoto({
          responseId: input.responseId,
          questionId: input.questionId,
          fileKey,
          url,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
        });
        return { success: true, url };
      }),
  }),

  // ─── Field Metrics ──────────────────────────────────────────────────────────

  fieldMetrics: router({
    upsert: encuestadorProcedure
      .input(z.object({
        date: z.string(),
        templateId: z.number().optional(),
        surveyPoint: z.string().optional(),
        timeSlot: z.enum(["manana", "mediodia", "tarde", "noche", "fin_semana"]).optional(),
        completed: z.number().default(0),
        rejected: z.number().default(0),
        substituted: z.number().default(0),
        incomplete: z.number().default(0),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await upsertFieldMetric({ ...input, encuestadorId: ctx.user.id });
        return { success: true };
      }),

    list: adminOrRevisorProcedure
      .input(z.object({
        encuestadorId: z.number().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional())
      .query(({ input }) => getFieldMetrics(input ? {
        encuestadorId: input.encuestadorId,
        dateFrom: input.dateFrom ? new Date(input.dateFrom).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) : undefined,
        dateTo: input.dateTo ? new Date(input.dateTo).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) : undefined,
      } : undefined)),
  }),

  // ─── Dashboard ──────────────────────────────────────────────────────────────

  dashboard: router({
    stats: adminOrRevisorProcedure
      .input(z.object({
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        encuestadorId: z.number().optional(),
      }).optional())
      .query(({ input }) => getDashboardStats(input)),

    byDay: adminOrRevisorProcedure
      .input(z.object({ dateFrom: z.date().optional(), dateTo: z.date().optional() }).optional())
      .query(({ input }) => getResponsesByDay(input)),

    byEncuestador: adminOrRevisorProcedure
      .input(z.object({ dateFrom: z.date().optional(), dateTo: z.date().optional() }).optional())
      .query(({ input }) => getResponsesByEncuestador(input)),

    byTimeSlot: adminOrRevisorProcedure
      .input(z.object({ dateFrom: z.date().optional(), dateTo: z.date().optional() }).optional())
      .query(({ input }) => getResponsesByTimeSlot(input)),

    byStatus: adminOrRevisorProcedure
      .input(z.object({ dateFrom: z.date().optional(), dateTo: z.date().optional() }).optional())
      .query(async ({ input }) => {
        const { getDb } = await import('./db');
        const { surveyResponses } = await import('../drizzle/schema');
        const { sql, and, gte, lte } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) return [];
        const conditions = [];
        if (input?.dateFrom) conditions.push(gte(surveyResponses.startedAt, input.dateFrom));
        if (input?.dateTo) conditions.push(lte(surveyResponses.startedAt, input.dateTo));
        const rows = await db
          .select({ status: surveyResponses.status, count: sql<number>`count(*)` })
          .from(surveyResponses)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .groupBy(surveyResponses.status);
        return rows;
      }),

    gpsLocations: adminOrRevisorProcedure
      .input(z.object({
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        encuestadorId: z.number().optional(),
      }).optional())
      .query(({ input }) => getGpsLocations(input)),
    latestLocations: adminOrRevisorProcedure
      .query(() => getLatestEncuestadorLocations()),

    // ── Estadísticas detalladas de visitantes ──────────────────────────────
    visitantesStats: adminOrRevisorProcedure
      .input(z.object({ dateFrom: z.date().optional(), dateTo: z.date().optional() }).optional())
      .query(async ({ input }) => {
        const responses = await getSurveyResponses({
          ...(input?.dateFrom ? { dateFrom: input.dateFrom } : {}),
          ...(input?.dateTo ? { dateTo: input.dateTo } : {}),
        });
        const vis = responses.filter((r) => r.templateType === "visitantes");

        const count = (arr: string[]) => {
          const m: Record<string, number> = {};
          for (const v of arr) { m[v] = (m[v] ?? 0) + 1; }
          return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
        };
        const getA = (answers: any[], qId: number) => answers.find((a: any) => a.questionId === qId)?.answer;

        const pais: string[] = [];
        const frecuencia: string[] = [];
        const estancia: string[] = [];
        const edad: string[] = [];
        const genero: string[] = [];
        const motivo: string[] = [];
        const grupo: string[] = [];
        const transporte: string[] = [];
        const actividad: string[] = [];
        const masificacion: string[] = [];
        const valoracion: number[] = [];
        const satisfaccion: number[] = [];
        const byPunto: Record<string, number> = {};

        for (const r of vis) {
          const raw = typeof r.answers === "string" ? JSON.parse(r.answers) : r.answers;
          const ans = (raw as any[]) ?? [];
          // Procedencia
          const p = getA(ans, 60007) ?? "";
          const pp = getA(ans, 60008) ?? "";
          const proc = clasificarProcedencia(p, pp);
          pais.push(proc === "sevilla" ? "Sevilla" : proc === "nacional" ? "Nacional" : "Extranjero");
          // Frecuencia visita
          const frec = getA(ans, 60009);
          if (frec) frecuencia.push(frec);
          // Estancia
          const est = getA(ans, 60010);
          if (est) estancia.push(est);
          // Edad
          const e = getA(ans, 60011);
          if (e) edad.push(e);
          // Género
          const g = getA(ans, 60012);
          if (g) genero.push(g);
          // Motivo
          const m = getA(ans, 60013);
          if (m) motivo.push(m);
          // Grupo
          const gr = getA(ans, 60014);
          if (gr) grupo.push(gr);
          // Transporte
          const tr = getA(ans, 60016);
          if (tr) transporte.push(tr);
          // Actividad
          const ac = getA(ans, 60017);
          if (ac) actividad.push(ac);
          // Masificación
          const mas = getA(ans, 60018);
          if (mas) masificacion.push(mas);
          // Valoración espacio (P11)
          const val = Number(getA(ans, 60019));
          if (!isNaN(val) && val > 0) valoracion.push(val);
          // Satisfacción general (P13)
          const sat = Number(getA(ans, 60021));
          if (!isNaN(sat) && sat > 0) satisfaccion.push(sat);
          // Punto
          const pt = r.surveyPoint ?? "Sin punto";
          byPunto[pt] = (byPunto[pt] ?? 0) + 1;
        }

        const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

        const FREC_LABELS: Record<string, string> = {
          primera_vez: "1ª vez", "2_3_veces": "2-3 veces", "4_10_veces": "4-10 veces", mas_10: ">10 veces",
        };
        const ESTANCIA_LABELS: Record<string, string> = {
          "1_noche": "1 noche", "2_3_noches": "2-3 noches", "4_7_noches": "4-7 noches", mas_semana: ">1 semana", sin_pernocta: "Sin pernocta",
        };
        const EDAD_LABELS: Record<string, string> = {
          "18_29": "18-29", "30_44": "30-44", "45_64": "45-64", "65_75": "65-75", "76_mas": ">75",
        };
        const MOTIVO_LABELS: Record<string, string> = {
          turismo_cultural: "Cultural", ocio: "Ocio", familia_amigos: "Familia/amigos",
          eventos: "Eventos", trabajo: "Trabajo", otro: "Otro",
        };
        const GRUPO_LABELS: Record<string, string> = {
          solo: "Solo", pareja: "Pareja", familia: "Familia", amigos: "Amigos",
          grupo_organizado: "Grupo org.", otro: "Otro",
        };
        const TRANSPORTE_LABELS: Record<string, string> = {
          caminando: "A pie", autobus_tranvia: "Bus/Tranvía", taxi_vtc: "Taxi/VTC",
          vehiculo_propio: "Vehículo propio", bicicleta: "Bicicleta", otro: "Otro",
        };
        const ACTIVIDAD_LABELS: Record<string, string> = {
          paseando: "Paseando", visita_monumento: "Visita monumento", camino_otro_lugar: "De paso",
          recorrido_planificado: "Recorrido plan.", recomendacion: "Recomendación", otro: "Otro",
        };
        const MAS_LABELS: Record<string, string> = {
          no: "No afecta", acorte_visita: "Acorté visita", cambie_horario: "Cambié horario",
          evite_lugar: "Evité el lugar", otro: "Otro",
        };

        const relabel = (arr: string[], labels: Record<string, string>) =>
          count(arr).map((d) => ({ ...d, name: labels[d.name] ?? d.name }));

        return {
          total: vis.length,
          pais: relabel(pais, { Sevilla: "Sevilla", Nacional: "Nacional", Extranjero: "Extranjero" }),
          frecuencia: relabel(frecuencia, FREC_LABELS),
          estancia: relabel(estancia, ESTANCIA_LABELS),
          edad: relabel(edad, EDAD_LABELS),
          genero: relabel(genero, { hombre: "Hombre", mujer: "Mujer", otro: "Otro" }),
          motivo: relabel(motivo, MOTIVO_LABELS),
          grupo: relabel(grupo, GRUPO_LABELS),
          transporte: relabel(transporte, TRANSPORTE_LABELS),
          actividad: relabel(actividad, ACTIVIDAD_LABELS),
          masificacion: relabel(masificacion, MAS_LABELS),
          avgValoracion: avg(valoracion),
          avgSatisfaccion: avg(satisfaccion),
          valoracionDist: count(valoracion.map(String)).map((d) => ({ name: `${d.name}★`, value: d.value })).sort((a, b) => a.name.localeCompare(b.name)),
          satisfaccionDist: count(satisfaccion.map(String)).map((d) => ({ name: `${d.name}★`, value: d.value })).sort((a, b) => a.name.localeCompare(b.name)),
          byPunto: Object.entries(byPunto).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
        };
      }),

    // ── Estadísticas detalladas de residentes ──────────────────────────────
    residentesStats: adminOrRevisorProcedure
      .input(z.object({ dateFrom: z.date().optional(), dateTo: z.date().optional() }).optional())
      .query(async ({ input }) => {
        const responses = await getSurveyResponses({
          ...(input?.dateFrom ? { dateFrom: input.dateFrom } : {}),
          ...(input?.dateTo ? { dateTo: input.dateTo } : {}),
        });
        const res = responses.filter((r) => r.templateType === "residentes");

        const count = (arr: string[]) => {
          const m: Record<string, number> = {};
          for (const v of arr) { m[v] = (m[v] ?? 0) + 1; }
          return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
        };
        const getA = (answers: any[], qId: number) => answers.find((a: any) => a.questionId === qId)?.answer;
        const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

        const genero: string[] = [];
        const edad: string[] = [];
        const vinculo: string[] = [];
        const territorio: string[] = [];
        const residencia: number[] = []; // años en barrio
        // Satisfacción (R_P07..R_P20 → qIds 90011..90024 aprox)
        const satisfItems: Record<string, number[]> = {};
        // Frecuencia uso espacios (R_P22..R_P27)
        const frecItems: Record<string, string[]> = {};
        // Comportamiento adaptación (R_P28)
        const comportamiento: string[] = [];
        // Problemas percibidos (R_P29 múltiple)
        const problemas: string[] = [];
        // Impacto turismo (R_P30..R_P34)
        const impactoItems: Record<string, number[]> = {};

        // Mapeo de questionIds del seed v6 (residentes template 90001)
        // P4 (género) = order 9 → qId 90013
        // P5 (edad) = order 10 → qId 90014
        // P3 (vínculo) = order 8 → qId 90012
        // P1.0 (vive centro) = order 6 → qId 90006
        // P2 (años residencia) = order 11 → qId 90015
        // Satisfacción P6.01..P6.14 = orders 14..27 → qIds 90018..90031
        // Frecuencia P7.01..P7.06 = orders 28..33 → qIds 90032..90037 (aproximado)
        // Comportamiento P8 = order 34 → qId 90038
        // Problemas P9 = order 35 → qId 90039
        // Impacto P10..P14 = orders 36..40 → qIds 90040..90044

        for (const r of res) {
          const raw = typeof r.answers === "string" ? JSON.parse(r.answers) : r.answers;
          const ans = (raw as any[]) ?? [];

          const g = getA(ans, 90013);
          if (g) genero.push(g);
          const e = getA(ans, 90014);
          if (e) edad.push(e);
          const v = getA(ans, 90012);
          if (v) vinculo.push(v);
          const tc = getA(ans, 90006);
          if (tc) territorio.push(tc === "si" || tc === "1" ? "Centro histórico" : "Resto Sevilla");

          // Satisfacción (P6.01..P6.14): qIds 90018..90031
          const satisfLabels: Record<number, string> = {
            90018: "Calidad vida", 90019: "Tranquilidad", 90020: "Limpieza",
            90021: "Seguridad", 90022: "Transporte", 90023: "Comercio local",
            90024: "Zonas verdes", 90025: "Ruido", 90026: "Accesibilidad",
            90027: "Masificación", 90028: "Identidad barrio", 90029: "Relación vecinos",
            90030: "Precio vivienda", 90031: "Servicios públicos",
          };
          for (const [qId, label] of Object.entries(satisfLabels)) {
            const val = Number(getA(ans, Number(qId)));
            if (!isNaN(val) && val > 0 && val <= 5) {
              if (!satisfItems[label]) satisfItems[label] = [];
              satisfItems[label].push(val);
            }
          }

          // Frecuencia uso espacios (P7.01..P7.06): qIds 90032..90037
          const frecLabels: Record<number, string> = {
            90032: "Plazas/jardines", 90033: "Comercios locales", 90034: "Restaurantes/bares",
            90035: "Monumentos", 90036: "Calles peatonales", 90037: "Mercados",
          };
          const FREC_ORDER = ["diario", "varias_semana", "1_semana", "menos_1_semana", "nunca"];
          for (const [qId, label] of Object.entries(frecLabels)) {
            const val = getA(ans, Number(qId));
            if (val) {
              if (!frecItems[label]) frecItems[label] = [];
              frecItems[label].push(val);
            }
          }

          // Comportamiento P8 = qId 90038
          const comp = getA(ans, 90038);
          if (comp) comportamiento.push(comp);

          // Problemas P9 = qId 90039 (múltiple)
          const prob = getA(ans, 90039);
          if (prob) {
            let arr: string[] = [];
            try { arr = Array.isArray(prob) ? prob : JSON.parse(prob); } catch { arr = [prob]; }
            problemas.push(...arr);
          }

          // Impacto P10..P14: qIds 90040..90044 (aproximado)
          const impactoLabels: Record<number, string> = {
            90040: "Actividad económica", 90041: "Empleo local", 90042: "Precios",
            90043: "Cultura/patrimonio", 90044: "Convivencia",
          };
          for (const [qId, label] of Object.entries(impactoLabels)) {
            const val = Number(getA(ans, Number(qId)));
            if (!isNaN(val) && val > 0 && val <= 5) {
              if (!impactoItems[label]) impactoItems[label] = [];
              impactoItems[label].push(val);
            }
          }
        }

        const COMP_LABELS: Record<string, string> = {
          no: "No cambia", evito_calles: "Evita calles", reducido_uso: "Reduce uso",
          cambio_horario: "Cambia horario", otro: "Otro",
        };
        const PROB_LABELS: Record<string, string> = {
          ruido: "Ruido", masificacion: "Masificación", suciedad: "Suciedad",
          inseguridad_vial: "Inseg. vial", perdida_identidad: "Pérdida identidad",
          aumento_precios: "Aumento precios", ninguna: "Ninguna", otro: "Otro",
        };
        const EDAD_LABELS: Record<string, string> = {
          "18_29": "18-29", "30_44": "30-44", "45_64": "45-64", "65_75": "65-75", "76_mas": ">75",
        };
        const VINCULO_LABELS: Record<string, string> = {
          si_yo: "Sí (yo)", si_otro: "Sí (familiar)", no: "No",
        };

        const relabel = (arr: string[], labels: Record<string, string>) =>
          count(arr).map((d) => ({ ...d, name: labels[d.name] ?? d.name }));

        return {
          total: res.length,
          genero: relabel(genero, { hombre: "Hombre", mujer: "Mujer", otro: "Otro" }),
          edad: relabel(edad, EDAD_LABELS),
          vinculo: relabel(vinculo, VINCULO_LABELS),
          territorio: relabel(territorio, {}),
          comportamiento: relabel(comportamiento, COMP_LABELS),
          problemas: relabel(problemas, PROB_LABELS),
          satisfaccion: Object.entries(satisfItems).map(([name, vals]) => ({ name, avg: avg(vals), n: vals.length })).sort((a, b) => b.avg - a.avg),
          frecuencia: Object.entries(frecItems).map(([name, vals]) => {
            const m: Record<string, number> = {};
            for (const v of vals) m[v] = (m[v] ?? 0) + 1;
            return { name, diario: m.diario ?? 0, varias_semana: m.varias_semana ?? 0, "1_semana": m["1_semana"] ?? 0, menos_1_semana: m.menos_1_semana ?? 0, nunca: m.nunca ?? 0 };
          }),
          impacto: Object.entries(impactoItems).map(([name, vals]) => ({ name, avg: avg(vals), n: vals.length })).sort((a, b) => b.avg - a.avg),
        };
      }),

    // ── Estadísticas de conteos peatonales ────────────────────────────────
    conteosStats: adminOrRevisorProcedure
      .input(z.object({ dateFrom: z.date().optional(), dateTo: z.date().optional() }).optional())
      .query(async ({ input }) => {
        const { getDb } = await import('./db');
        const { pedestrianPasses, countingSessions } = await import('../drizzle/schema');
        const { sql, and, gte, lte } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) return { total: 0, byPunto: [], byTramo: [], bySentido: [], sessions: [] };

        const conditions: any[] = [];
        if (input?.dateFrom) conditions.push(gte(pedestrianPasses.recordedAt, input.dateFrom));
        if (input?.dateTo) conditions.push(lte(pedestrianPasses.recordedAt, input.dateTo));
        const where = conditions.length > 0 ? and(...conditions) : undefined;

        // Total y por punto principal (agrupado por surveyPointCode)
        const byPuntoRows = await db
          .select({
            puntoCode: pedestrianPasses.surveyPointCode,
            puntoName: pedestrianPasses.surveyPoint,
            total: sql<number>`sum(${pedestrianPasses.count})`,
            registros: sql<number>`count(*)`
          })
          .from(pedestrianPasses)
          .where(where)
          .groupBy(pedestrianPasses.surveyPointCode, pedestrianPasses.surveyPoint);

        // Consolidar por código de punto (sumar todos los flujos del mismo punto)
        const { SURVEY_POINTS } = await import('../shared/surveyPoints');
        const puntoMap = new Map<string, { name: string; value: number; registros: number }>();
        // Inicializar todos los puntos con 0
        for (const p of SURVEY_POINTS) {
          puntoMap.set(p.code, { name: p.fullName, value: 0, registros: 0 });
        }
        // Acumular los conteos reales
        for (const r of byPuntoRows) {
          const code = r.puntoCode ?? (r.puntoName ?? "").substring(0, 2);
          const existing = puntoMap.get(code);
          if (existing) {
            existing.value += Number(r.total ?? 0);
            existing.registros += Number(r.registros ?? 0);
          } else {
            // Punto no registrado en SURVEY_POINTS, añadirlo igualmente
            puntoMap.set(code, { name: r.puntoName ?? code, value: Number(r.total ?? 0), registros: Number(r.registros ?? 0) });
          }
        }

        // Por tramo de 30 min
        const allCounts = await db.select().from(pedestrianPasses).where(where);
        const byTramo: Record<string, number> = {};
        for (const c of allCounts) {
          if (!c.recordedAt) continue;
          const d = new Date(c.recordedAt);
          const h = d.getHours();
          const m = d.getMinutes() < 30 ? "00" : "30";
          const key = `${String(h).padStart(2, "0")}:${m}`;
          byTramo[key] = (byTramo[key] ?? 0) + Number(c.count ?? 0);
        }

        // Por sentido (top 15)
        const bySentidoRows = await db
          .select({ sentido: pedestrianPasses.directionLabel, total: sql<number>`sum(${pedestrianPasses.count})` })
          .from(pedestrianPasses)
          .where(where)
          .groupBy(pedestrianPasses.directionLabel);

        // Sesiones
        const sessionRows = await db.select().from(countingSessions);

        const allPuntos = Array.from(puntoMap.values());
        const totalPersons = allPuntos.reduce((acc, r) => acc + r.value, 0);

        return {
          total: totalPersons,
          byPunto: allPuntos.sort((a, b) => a.name.localeCompare(b.name)),
          byTramo: Object.entries(byTramo).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value })),
          bySentido: bySentidoRows.map((r) => ({ name: r.sentido ?? "Sin sentido", value: Number(r.total ?? 0) })).sort((a, b) => b.value - a.value).slice(0, 15),
          sessions: sessionRows.map((s) => ({
            punto: s.surveyPointName ?? s.surveyPointCode ?? "",
            subpunto: s.subPointName ?? s.subPointCode ?? "",
            encuestador: s.encuestadorName ?? "",
            total: Number(s.totalPersons ?? 0),
            inicio: s.startedAt ? new Date(s.startedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "",
            fin: s.finishedAt ? new Date(s.finishedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "",
          })),
        };
      }),
  }),
  // ─── Conteo Peatonall ───────────────────────────────────────────────────────────────────────────────

  pedestrian: router({
    createSession: encuestadorProcedure
      .input(z.object({
        surveyPoint: z.string().min(1),
        timeSlot: z.enum(["manana", "mediodia", "tarde", "noche", "fin_semana"]).optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        gpsAccuracy: z.number().optional(),
        startedAt: z.date(),
      }))
      .mutation(async ({ input, ctx }) => {
        const sessionDate = input.startedAt.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).split("/").reverse().join("-");
        const result = await createPedestrianSession({
          ...input,
          date: sessionDate,
          encuestadorId: ctx.user.id,
          encuestadorName: ctx.user.name ?? "",
          encuestadorIdentifier: ctx.user.identifier ?? "",
          latitude: input.latitude?.toString(),
          longitude: input.longitude?.toString(),
          gpsAccuracy: input.gpsAccuracy?.toString(),
        });
        return { success: true, id: (result as any)?.insertId };
      }),

    finishSession: encuestadorProcedure
      .input(z.object({
        id: z.number(),
        finishedAt: z.date(),
        notes: z.string().optional(),
        totalIn: z.number(),
        totalOut: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updatePedestrianSession(id, data);
        return { success: true };
      }),

    addInterval: encuestadorProcedure
      .input(z.object({
        sessionId: z.number(),
        intervalStart: z.date(),
        intervalEnd: z.date(),
        intervalMinute: z.number(),
        countIn: z.number().default(0),
        countOut: z.number().default(0),
        photoBase64: z.string().optional(),
        photoMimeType: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        let photoUrl: string | undefined;
        let photoKey: string | undefined;
        if (input.photoBase64) {
          const suffix = nanoid(8);
          const ext = input.photoMimeType === "image/png" ? "png" : "jpg";
          photoKey = `encuestas/pedestrian/${input.sessionId}/${suffix}.${ext}`;
          const buffer = Buffer.from(input.photoBase64, "base64");
          const uploaded = await storagePut(photoKey, buffer, input.photoMimeType ?? "image/jpeg");
          photoUrl = uploaded.url;
        }
        const { photoBase64, photoMimeType, ...rest } = input;
        const result = await createPedestrianInterval({ ...rest, photoUrl, photoKey });
        return { success: true, id: (result as any)?.insertId };
      }),

    updateInterval: encuestadorProcedure
      .input(z.object({
        id: z.number(),
        countIn: z.number().optional(),
        countOut: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updatePedestrianInterval(id, data);
        return { success: true };
      }),

    listSessions: adminOrRevisorProcedure
      .input(z.object({
        encuestadorId: z.number().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(({ input }) => getPedestrianSessions(input ?? {})),

    mySessions: encuestadorProcedure
      .query(({ ctx }) => getPedestrianSessions({ encuestadorId: ctx.user.id })),

    sessionDetail: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const session = await getPedestrianSessionById(input.id);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        const intervals = await getIntervalsBySession(input.id);
        return { ...session, intervals };
      }),
  }),

  // ─── Pedestrian Passes ──────────────────────────────────────────────────────────────────────────

  passes: router({
    add: encuestadorProcedure
      .input(z.object({
        surveyPoint: z.string(),           // nombre completo (ej: "01 Virgen de los Reyes")
        surveyPointCode: z.string().optional(), // solo código (ej: "01")
        directionId: z.number().optional(),
        directionLabel: z.string().optional(),
        flowOrigin: z.string().optional(),      // origen del flujo
        flowDestination: z.string().optional(), // destino del flujo
        count: z.number().min(1).max(999),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        gpsAccuracy: z.number().optional(),
        recordedAt: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return createPedestrianPass({
          encuestadorId: ctx.user.id,
          encuestadorName: ctx.user.name ?? undefined,
          encuestadorIdentifier: ctx.user.identifier ?? undefined,
          surveyPoint: input.surveyPoint,
          surveyPointCode: input.surveyPointCode ?? null,
          directionId: input.directionId ?? null,
          directionLabel: input.directionLabel ?? null,
          flowOrigin: input.flowOrigin ?? null,
          flowDestination: input.flowDestination ?? null,
          count: input.count,
          latitude: input.latitude ? String(input.latitude) : null,
          longitude: input.longitude ? String(input.longitude) : null,
          gpsAccuracy: input.gpsAccuracy ? String(input.gpsAccuracy) : null,
          recordedAt: input.recordedAt ?? new Date(),
        });
      }),

    list: adminOrRevisorProcedure
      .input(z.object({
        surveyPoint: z.string().optional(),
        encuestadorId: z.number().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        directionId: z.number().optional(),
      }).optional())
      .query(({ input }) => getPedestrianPasses(input ?? {})),

    stats: adminOrRevisorProcedure
      .input(z.object({
        surveyPoint: z.string().optional(),
        encuestadorId: z.number().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(({ input }) => getPedestrianPassStats(input ?? {})),
  }),


  // ─── Counting Sessions (sesiones cronometradas) ────────────────────────────

  countingSessions: router({
    start: encuestadorProcedure
      .input(z.object({
        surveyPointCode: z.string(),
        surveyPointName: z.string().optional(),
        subPointCode: z.string().optional(),
        subPointName: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        gpsAccuracy: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return createCountingSession({
          encuestadorId: ctx.user.id,
          encuestadorName: ctx.user.name ?? undefined,
          encuestadorIdentifier: ctx.user.identifier ?? undefined,
          surveyPointCode: input.surveyPointCode,
          surveyPointName: input.surveyPointName ?? null,
          subPointCode: input.subPointCode ?? null,
          subPointName: input.subPointName ?? null,
          startedAt: new Date(),
          totalPersons: 0,
          latitude: input.latitude ? String(input.latitude) : null,
          longitude: input.longitude ? String(input.longitude) : null,
          gpsAccuracy: input.gpsAccuracy ? String(input.gpsAccuracy) : null,
        });
      }),

    finish: encuestadorProcedure
      .input(z.object({
        id: z.number(),
        totalPersons: z.number().min(0),
      }))
      .mutation(async ({ input }) => {
        return finishCountingSession(input.id, {
          finishedAt: new Date(),
          totalPersons: input.totalPersons,
        });
      }),

    list: adminOrRevisorProcedure
      .input(z.object({
        surveyPointCode: z.string().optional(),
        encuestadorId: z.number().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(({ input }) => getCountingSessions(input ?? {})),
  }),

  // ─── Pedestrian Directions ────────────────────────────────────────────────────────────────────

  directions: router({
    byPoint: protectedProcedure
      .input(z.object({ surveyPoint: z.string() }))
      .query(({ input }) => getDirectionsByPoint(input.surveyPoint)),

    allPoints: protectedProcedure
      .query(() => getAllDirectionPoints()),

    create: adminProcedure
      .input(z.object({
        surveyPoint: z.string(),
        label: z.string(),
        description: z.string().optional(),
        order: z.number().optional(),
      }))
      .mutation(({ input }) => createPedestrianDirection(input)),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        label: z.string().optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
        order: z.number().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updatePedestrianDirection(id, data);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deletePedestrianDirection(input.id)),
  }),

  // ─── Export CSV ───────────────────────────────────────────────────────────────────────────────

  export: router({
    csvConteos: adminOrRevisorProcedure
      .input(z.object({
        surveyPoint: z.string().optional(),
        encuestadorId: z.number().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const passes = await getPedestrianPasses(input ?? {});
        const headers = [
          "ID", "Fecha", "Hora", "Tramo30min",
          "Punto_Nombre", "Punto_Codigo", "Sentido", "Origen_Codigo", "Destino_Codigo",
          "Encuestador", "Identificador",
          "Personas",
          "Latitud", "Longitud", "Precision_GPS_m",
        ];
        const getSlot30 = (dt: Date) => {
          const h = dt.getHours().toString().padStart(2, "0");
          const m = dt.getMinutes() < 30 ? "00" : "30";
          const endMin = dt.getMinutes() < 30 ? "30" : "00";
          const endH = dt.getMinutes() < 30 ? dt.getHours() : dt.getHours() + 1;
          return `${h}:${m}-${endH.toString().padStart(2, "0")}:${endMin}`;
        };
        const rows = passes.map((p) => {
          const dt = new Date(p.recordedAt);
          return [
            p.id,
            (() => { const tz = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }); const parts = tz.formatToParts(dt); const p = Object.fromEntries(parts.filter(x => x.type !== "literal").map(x => [x.type, x.value])); return `${p.day}/${p.month}/${p.year}`; })(),
            (() => { const tz = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }); const parts = tz.formatToParts(dt); const p = Object.fromEntries(parts.filter(x => x.type !== "literal").map(x => [x.type, x.value])); return `${p.hour}:${p.minute}:${p.second}`; })(),
            getSlot30(dt),
            p.surveyPoint,
            (p as any).surveyPointCode ?? "",
            p.directionLabel ?? "",
            (p as any).flowOrigin ?? "",
            (p as any).flowDestination ?? "",
            p.encuestadorName ?? "",
            p.encuestadorIdentifier ?? "",
            p.count,
            p.latitude ?? "",
            p.longitude ?? "",
            p.gpsAccuracy ?? "",
          ];
        });
        const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const fmtDate = (d: Date) => {
          const tz = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
          const parts = tz.formatToParts(d);
          const p = Object.fromEntries(parts.filter(x => x.type !== "literal").map(x => [x.type, x.value]));
          return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
        };
        const csvLines = [
          headers.map(escape).join(","),
          ...rows.map((row) => row.map(escape).join(",")),
        ];
        return { csv: csvLines.join("\n"), count: rows.length };
      }),
    csv: adminOrRevisorProcedure
      .input(z.object({
        encuestadorId: z.number().optional(),
        templateId: z.number().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        const responses = await getSurveyResponses(input);
        const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const fmtDate = (d: Date) => {
          const tz = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
          const parts = tz.formatToParts(d);
          const p = Object.fromEntries(parts.filter(x => x.type !== "literal").map(x => [x.type, x.value]));
          return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
        };
        // Cabeceras metadatos
        const metaHeaders = [
          "ID", "Tipo", "Encuestador", "CodEncuestador",
          "PuntoEncuesta", "FranjaHoraria", "VentanaMedia", "MinutoInicio", "MinutoFin",
          "Inicio", "Fin", "DuracionMin", "Idioma", "Estado", "SalidaAnticipada",
          "Latitud", "Longitud", "GPS_m",
        ];
        // Cabeceras visitantes (v_p01..v_p20)
        const vHeaders = Array.from({ length: 20 }, (_, i) => `V_P${String(i + 1).padStart(2, "0")}`);
        // Cabeceras residentes v6 (r_p01..r_p34 + r_p35 + r_p35a/b/c + r_p36 + r_p37 + seccion037)
        const rHeaders = [
          ...Array.from({ length: 34 }, (_, i) => `R_P${String(i + 1).padStart(2, "0")}`),
          "R_P35", "R_P35a", "R_P35b", "R_P35c", "R_P36", "R_P37", "SECCION037",
        ];
        const headers = [...metaHeaders, ...vHeaders, ...rHeaders];
        const rows = responses.map((r) => {
          const rAny = r as any;
          // Duración en minutos
          const durMin = (r.startedAt && r.finishedAt)
            ? Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 60000)
            : "";
          const meta = [
            r.id,
            rAny.templateType ?? "",
            r.encuestadorName ?? "",
            r.encuestadorIdentifier ?? "",
            r.surveyPoint ?? "",
            r.timeSlot ?? "",
            rAny.windowCode ?? "",
            rAny.minuteStart ?? "",
            rAny.minuteEnd ?? "",
            r.startedAt ? fmtDate(new Date(r.startedAt)) : "",
            r.finishedAt ? fmtDate(new Date(r.finishedAt)) : "",
            durMin,
            r.language,
            r.status,
            rAny.earlyExit ? "SI" : "NO",
            r.latitude ?? "",
            r.longitude ?? "",
            r.gpsAccuracy ?? "",
          ];
          // Columnas visitantes
          const vCols = Array.from({ length: 20 }, (_, i) => rAny[`v_p${String(i + 1).padStart(2, "0")}`] ?? "");
          // Columnas residentes v6
          const rCols = [
            ...Array.from({ length: 34 }, (_, i) => rAny[`r_p${String(i + 1).padStart(2, "0")}`] ?? ""),
            rAny.r_p35 ?? "", rAny.r_p35a ?? "", rAny.r_p35b ?? "", rAny.r_p35c ?? "", rAny.r_p36 ?? "", rAny.r_p37 ?? "",
            rAny.seccion037 === 1 || rAny.seccion037 === true ? "1" : (rAny.seccion037 === 2 ? "2" : ""),  // SECCION037: 1=Centro histórico, 2=Resto de Sevilla
          ];
          return [...meta, ...vCols, ...rCols];
        });
        const csvLines = [
          headers.map(escape).join(","),
          ...rows.map((row) => row.map(escape).join(",")),
        ];
        return { csv: csvLines.join("\n"), count: rows.length };
      }),
    csvFlat: adminOrRevisorProcedure
      .input(z.object({
        encuestadorId: z.number().optional(),
        surveyType: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        const rows = await getSurveyResponsesFlat(input);
        // Cabeceras metadatos
        const metaHeaders = [
          "ID", "Tipo", "Punto", "Franja", "Ventana", "MinutoInicio", "MinutoFin",
          "Encuestador", "CodEncuestador", "Inicio", "Fin", "Idioma", "Estado",
          "Lat", "Lon", "GPS_m", "SalidaAnticipada",
        ];
        // Cabeceras visitantes
        const vHeaders = Array.from({ length: 26 }, (_, i) => `V${String(i + 1).padStart(2, "0")}`);
        // Cabeceras residentes
        const rHeaders = [...Array.from({ length: 38 }, (_, i) => `R${String(i + 1).padStart(2, "0")}`), "SECCION037"];
        const headers = [...metaHeaders, ...vHeaders, ...rHeaders];
        const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const fmtDate = (d: Date) => {
          const tz = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
          const parts = tz.formatToParts(d);
          const p = Object.fromEntries(parts.filter(x => x.type !== "literal").map(x => [x.type, x.value]));
          return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
        };
        const csvRows = rows.map((r) => {
          const meta = [
            r.id, r.surveyType ?? "", r.surveyPoint ?? "", r.timeSlot ?? "",
            r.windowCode ?? "", r.minuteStart ?? "", r.minuteEnd ?? "",
            r.encuestadorName ?? "", r.encuestadorCode ?? "",
            r.startedAt ? fmtDate(new Date(r.startedAt)) : "",
            r.finishedAt ? fmtDate(new Date(r.finishedAt)) : "",
            r.language, r.status, r.latitude ?? "", r.longitude ?? "",
            r.gpsAccuracy ?? "", r.earlyExit ? "SI" : "NO",
          ];
          const vCols = Array.from({ length: 26 }, (_, i) => (r as any)[`v${String(i + 1).padStart(2, "0")}`] ?? "");
          const rCols = Array.from({ length: 38 }, (_, i) => (r as any)[`r${String(i + 1).padStart(2, "0")}`] ?? "");
          const s037 = (r as any).seccion037;
          const seccion037Col = s037 === 1 || s037 === true ? "1" : (s037 === 2 ? "2" : "");
          return [...meta, ...vCols, ...rCols, seccion037Col];
        });
        const csvLines = [headers.map(escape).join(","), ...csvRows.map((row) => row.map(escape).join(","))];
        return { csv: csvLines.join("\n"), count: rows.length };
      }),
  }),
  // ─── Survey Rejectionss ────────────────────────────────────────────────────────────────────────────────────
  rejections: router({
    add: encuestadorProcedure
      .input(z.object({
        surveyType: z.enum(["residentes", "visitantes"]),
        surveyPoint: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        gpsAccuracy: z.number().optional(),
        notes: z.string().optional(),
        rejectedAt: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return createSurveyRejection({
          encuestadorId: ctx.user.id,
          encuestadorName: ctx.user.name ?? undefined,
          encuestadorIdentifier: ctx.user.identifier ?? undefined,
          surveyType: input.surveyType,
          surveyPoint: input.surveyPoint ?? null,
          latitude: input.latitude ? String(input.latitude) : null,
          longitude: input.longitude ? String(input.longitude) : null,
          gpsAccuracy: input.gpsAccuracy ? String(input.gpsAccuracy) : null,
          notes: input.notes ?? null,
          rejectedAt: input.rejectedAt ?? new Date(),
        });
      }),
    list: adminOrRevisorProcedure
      .input(z.object({
        encuestadorId: z.number().optional(),
        surveyType: z.enum(["residentes", "visitantes"]).optional(),
        surveyPoint: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(({ input }) => getSurveyRejections(input ?? {})),
    stats: adminOrRevisorProcedure
      .input(z.object({
        encuestadorId: z.number().optional(),
        surveyType: z.enum(["residentes", "visitantes"]).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(({ input }) => getSurveyRejectionStats(input ?? {})),
    csvExport: adminOrRevisorProcedure
      .input(z.object({
        encuestadorId: z.number().optional(),
        surveyType: z.enum(["residentes", "visitantes"]).optional(),
        surveyPoint: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const rejs = await getSurveyRejections(input ?? {});
        const headers = ["ID", "Fecha", "Hora", "Tipo", "Punto", "Encuestador", "Identificador", "Latitud", "Longitud", "Precisión GPS (m)", "Notas"];
        const rows = rejs.map((r) => {
          const dt = new Date(r.rejectedAt);
          const fmtDateRej = (d: Date) => {
            const tz = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
            const parts = tz.formatToParts(d);
            const p = Object.fromEntries(parts.filter(x => x.type !== "literal").map(x => [x.type, x.value]));
            return { date: `${p.day}/${p.month}/${p.year}`, time: `${p.hour}:${p.minute}:${p.second}` };
          };
          const { date: rejDate, time: rejTime } = fmtDateRej(dt);
          return [
            r.id,
            rejDate,
            rejTime,
            r.surveyType,
            r.surveyPoint ?? "",
            r.encuestadorName ?? "",
            r.encuestadorIdentifier ?? "",
            r.latitude ?? "",
            r.longitude ?? "",
            r.gpsAccuracy ?? "",
            r.notes ?? "",
          ];
        });
        const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const csvLines = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))];
        return { csv: csvLines.join("\n"), count: rows.length };
      }),
  }),
  // ─── Export CSV Sesiones y Cierres ────────────────────────────────────────
  exportExtra: router({
    csvCountingSessions: adminOrRevisorProcedure
      .input(z.object({
        encuestadorId: z.number().optional(),
        surveyPointCode: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const sessions = await getCountingSessions(input ?? {});
        const fmtCS = (d: Date) => {
          const tz = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
          const parts = tz.formatToParts(d);
          const p = Object.fromEntries(parts.filter(x => x.type !== "literal").map(x => [x.type, x.value]));
          return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
        };
        const headers = ["ID", "Encuestador", "Identificador", "Punto", "Nombre Punto", "Subpunto", "Nombre Subpunto", "Inicio", "Fin", "Duración (min)", "Total Personas", "Latitud", "Longitud", "Precisión GPS (m)"];
        const rows = sessions.map((s) => {
          const start = new Date(s.startedAt);
          const end = s.finishedAt ? new Date(s.finishedAt) : null;
          const durMin = end ? Math.round((end.getTime() - start.getTime()) / 60000) : "";
          return [
            s.id,
            s.encuestadorName ?? "",
            s.encuestadorIdentifier ?? "",
            s.surveyPointCode,
            s.surveyPointName ?? "",
            s.subPointCode ?? "",
            s.subPointName ?? "",
            fmtCS(start),
            end ? fmtCS(end) : "",
            durMin,
            s.totalPersons,
            s.latitude ?? "",
            s.longitude ?? "",
            s.gpsAccuracy ?? "",
          ];
        });
        const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const csvLines = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))];
        return { csv: csvLines.join("\n"), count: sessions.length };
      }),
    // ─── CSV Cierres de Turno ──────────────────────────────────────────────────
    csvShiftClosures: adminOrRevisorProcedure
      .input(z.object({
        encuestadorId: z.number().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        let closures = await getAllShiftClosures();
        if (input?.encuestadorId) closures = closures.filter(c => c.encuestadorId === input.encuestadorId);
        if (input?.dateFrom) {
          const from = new Date(input.dateFrom);
          closures = closures.filter(c => new Date(c.closedAt) >= from);
        }
        if (input?.dateTo) {
          const to = new Date(input.dateTo + "T23:59:59");
          closures = closures.filter(c => new Date(c.closedAt) <= to);
        }
        const fmtCL = (d: Date) => {
          const tz = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
          const parts = tz.formatToParts(d);
          const p = Object.fromEntries(parts.filter(x => x.type !== "literal").map(x => [x.type, x.value]));
          return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
        };
        const headers = ["ID", "Encuestador", "Fecha/Hora Cierre", "Total Encuestas", "Total Conteos", "Total Rechazos", "Punto", "Tipo", "Valoración", "Incidencias"];
        const rows = closures.map((c) => [
          c.id,
          c.encuestadorName ?? "",
          fmtCL(new Date(c.closedAt)),
          c.totalEncuestas,
          c.totalConteos ?? 0,
          c.totalRechazos ?? 0,
          c.surveyPoint ?? "",
          c.surveyType ?? "",
          c.valoracion ?? "",
          c.incidencias ?? "",
        ]);
        const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const csvLines = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))];
        return { csv: csvLines.join("\n"), count: closures.length };
      }),
  }),
  // ─── Turnos ────────────────────────────────────────────────────────────────
  shifts: router({
    // Admin: ver todos los turnos
    getAll: adminProcedure.query(() => getAllShifts()),
    // Encuestador: ver mis turnos
    getMine: protectedProcedure.query(({ ctx }) => getShiftsByEncuestador(ctx.user.id)),
    // Admin: crear turno
    create: adminProcedure
      .input(z.object({
        encuestadorId: z.number(),
        shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        surveyPoint: z.string().optional(),
        surveyType: z.enum(["visitantes", "residentes", "conteo"]).optional(),
        notes: z.string().optional(),
      }))
      .mutation(({ input }) => createShift(input)),
    // Admin: actualizar turno
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        surveyPoint: z.string().optional(),
        surveyType: z.enum(["visitantes", "residentes", "conteo"]).optional(),
        notes: z.string().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateShift(id, data);
      }),
    // Admin: eliminar turno
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteShift(input.id)),
  }),

  // ─── Cierre de turno ────────────────────────────────────────────────────────────────
  shiftClosures: router({
    // Encuestador: registrar cierre de turno
    close: protectedProcedure
      .input(z.object({
        shiftId: z.number().optional(),
        totalEncuestas: z.number().min(0),
        totalConteos: z.number().min(0).optional(),
        totalRechazos: z.number().min(0).optional(),
        surveyPoint: z.string().optional(),
        surveyType: z.enum(["visitantes", "residentes", "conteo"]).optional(),
        incidencias: z.string().optional(),
        valoracion: z.number().min(1).max(5).optional(),
      }))
      .mutation(({ ctx, input }) =>
        createShiftClosure({
          encuestadorId: ctx.user.id,
          encuestadorName: ctx.user.name ?? undefined,
          closedAt: new Date(),
          ...input,
        })
      ),
    // Encuestador: ver mis cierres
    getMine: protectedProcedure.query(({ ctx }) =>
      getShiftClosuresByEncuestador(ctx.user.id)
    ),
    // Admin/Revisor: ver todos los cierres
    getAll: adminOrRevisorProcedure.query(() => getAllShiftClosures()),
    // Encuestador: resumen del día actual (encuestas, conteos, rechazos)
    todaySummary: protectedProcedure.query(async ({ ctx }) => {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
      const todayStr = today.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
      // Encuestas del día
      const allResponses = await getSurveyResponsesByEncuestador(ctx.user.id);
      const todayEncuestas = allResponses.filter((r) => {
        const dStr = new Date(r.startedAt).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
        return dStr === todayStr;
      });
      // Rechazos del día
      const allRejections = await getSurveyRejections({ encuestadorId: ctx.user.id, dateFrom: todayStr, dateTo: todayStr });
      // Conteos del día
      const allPasses = await getPedestrianPasses({ encuestadorId: ctx.user.id, dateFrom: todayStr, dateTo: todayStr });
      const totalConteos = allPasses.reduce((sum, p) => sum + (p.count ?? 1), 0);
      return {
        totalEncuestas: todayEncuestas.length,
        totalRechazos: allRejections.length,
        totalConteos,
      };
    }),
  }),

  // ─── Cuotas ────────────────────────────────────────────────────────────────
  quotas: router({
    /**
     * Devuelve el progreso actual de cuotas para visitantes y residentes.
     * Accesible por encuestadores, revisores y admins.
     */
    progress: protectedProcedure.query(async () => {
      // Obtener todas las respuestas completas
      const allResponses = await getSurveyResponses({ status: "completa" });

      // ─── VISITANTES ───────────────────────────────────────────────────────
      const visitantesResponses = allResponses.filter((r) => r.templateType === "visitantes");

      // Género visitantes
      const vGenero: Record<string, number> = { hombre: 0, mujer: 0, otro: 0 };
      // Procedencia visitantes
      const vProcedencia: Record<string, number> = { sevilla: 0, nacional: 0, extranjero: 0 };
      // Por punto
      const vPuntos: Record<string, number> = {};

      for (const r of visitantesResponses) {
        const rawAnswers = typeof r.answers === "string" ? JSON.parse(r.answers) : r.answers;
        const answers = (rawAnswers as Array<{ questionId: number; answer: any }>) ?? [];
        const getAnswer = (qId: number) => answers.find((a) => a.questionId === qId)?.answer;

        // Género
        const genero = getAnswer(VISITANTES_QUESTION_IDS.genero);
        if (genero === "hombre") vGenero.hombre++;
        else if (genero === "mujer") vGenero.mujer++;
        else vGenero.otro++;

        // Procedencia
        const pais = getAnswer(VISITANTES_QUESTION_IDS.pais) ?? "";
        const provinciaEsp = getAnswer(VISITANTES_QUESTION_IDS.paisEsp) ?? "";
        const proc = clasificarProcedencia(pais, provinciaEsp);
        vProcedencia[proc] = (vProcedencia[proc] ?? 0) + 1;

        // Punto
        const punto = r.surveyPoint ?? "Sin punto";
        vPuntos[punto] = (vPuntos[punto] ?? 0) + 1;
      }

      // ─── RESIDENTES ───────────────────────────────────────────────────────
      const residentesResponses = allResponses.filter((r) => r.templateType === "residentes");

      const rGenero: Record<string, number> = { hombre: 0, mujer: 0, otro: 0 };
      const rEdad: Record<string, number> = { "18_44": 0, "45_65": 0, "65_mas": 0 };
      const rVinculo: Record<string, number> = { con_vinculo: 0, sin_vinculo: 0 };

      for (const r of residentesResponses) {
        const rawAnswers = typeof r.answers === "string" ? JSON.parse(r.answers) : r.answers;
        const answers = (rawAnswers as Array<{ questionId: number; answer: any }>) ?? [];
        const getAnswer = (qId: number) => answers.find((a) => a.questionId === qId)?.answer;

        // Género
        const genero = getAnswer(RESIDENTES_QUESTION_IDS.genero);
        if (genero === "hombre") rGenero.hombre++;
        else if (genero === "mujer") rGenero.mujer++;
        else rGenero.otro++;

        // Edad
        const edad = getAnswer(RESIDENTES_QUESTION_IDS.edad);
        const edadGrupo = clasificarEdadResidente(edad ?? "");
        if (edadGrupo) rEdad[edadGrupo]++;

        // Vínculo laboral
        const vinculo = getAnswer(RESIDENTES_QUESTION_IDS.vinculo);
        if (tieneVinculoTurismo(vinculo ?? "")) rVinculo.con_vinculo++;
        else rVinculo.sin_vinculo++;
      }

      return {
        visitantes: {
          total: { current: visitantesResponses.length, target: VISITANTES_QUOTAS.total },
          genero: {
            hombre: { current: vGenero.hombre, target: VISITANTES_QUOTAS.genero.hombre.target, label: VISITANTES_QUOTAS.genero.hombre.label },
            mujer: { current: vGenero.mujer, target: VISITANTES_QUOTAS.genero.mujer.target, label: VISITANTES_QUOTAS.genero.mujer.label },
          },
          procedencia: {
            sevilla: { current: vProcedencia.sevilla, target: VISITANTES_QUOTAS.procedencia.sevilla.target, label: VISITANTES_QUOTAS.procedencia.sevilla.label },
            nacional: { current: vProcedencia.nacional, target: VISITANTES_QUOTAS.procedencia.nacional.target, label: VISITANTES_QUOTAS.procedencia.nacional.label },
            extranjero: { current: vProcedencia.extranjero, target: VISITANTES_QUOTAS.procedencia.extranjero.target, label: VISITANTES_QUOTAS.procedencia.extranjero.label },
          },
          puntos: Object.entries(VISITANTES_QUOTAS.puntos).map(([key, q]) => ({
            key,
            label: q.label,
            current: vPuntos[key] ?? 0,
            target: q.target,
          })),
        },
        residentes: {
          total: { current: residentesResponses.length, target: RESIDENTES_QUOTAS.total },
          genero: {
            hombre: { current: rGenero.hombre, target: RESIDENTES_QUOTAS.genero.hombre.target, label: RESIDENTES_QUOTAS.genero.hombre.label },
            mujer: { current: rGenero.mujer, target: RESIDENTES_QUOTAS.genero.mujer.target, label: RESIDENTES_QUOTAS.genero.mujer.label },
          },
          edad: {
            "18_44": { current: rEdad["18_44"], target: RESIDENTES_QUOTAS.edad["18_44"].target, label: RESIDENTES_QUOTAS.edad["18_44"].label },
            "45_65": { current: rEdad["45_65"], target: RESIDENTES_QUOTAS.edad["45_65"].target, label: RESIDENTES_QUOTAS.edad["45_65"].label },
            "65_mas": { current: rEdad["65_mas"], target: RESIDENTES_QUOTAS.edad["65_mas"].target, label: RESIDENTES_QUOTAS.edad["65_mas"].label },
          },
          vinculo: {
            con_vinculo: { current: rVinculo.con_vinculo, target: RESIDENTES_QUOTAS.vinculo.con_vinculo.target, label: RESIDENTES_QUOTAS.vinculo.con_vinculo.label },
            sin_vinculo: { current: rVinculo.sin_vinculo, target: RESIDENTES_QUOTAS.vinculo.sin_vinculo.target, label: RESIDENTES_QUOTAS.vinculo.sin_vinculo.label },
          },
        },
      };
    }),
  }),
});
export type AppRouter = typeof appRouter;
