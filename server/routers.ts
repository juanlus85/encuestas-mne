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
        timeSlot: z.enum(["manana", "tarde", "noche", "fin_semana"]).optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        gpsAccuracy: z.number().optional(),
        startedAt: z.date(),
        finishedAt: z.date().optional(),
        language: z.enum(["es", "en"]).default("es"),
        answers: z.array(z.object({ questionId: z.number(), answer: z.any() })),
        status: z.enum(["completa", "incompleta", "rechazada", "sustitucion"]).default("completa"),
        deviceInfo: z.string().optional(),
        earlyExit: z.boolean().optional(),
        windowCode: z.string().optional(),
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
              // v_p01..v_p20
              const colName = `v_p${String(colIdx).padStart(2, "0")}`;
              flatCols[colName] = rawVal;
            } else {
              // r_p01..r_p34 (normales) + r_p35a/b/c (múltiple, order 37 = colIdx 33)
              if (colIdx === 33) {
                // P13 múltiple: r_p35a, r_p35b, r_p35c
                let vals: string[] = [];
                try { vals = rawVal ? JSON.parse(rawVal) : []; } catch { vals = rawVal ? [rawVal] : []; }
                flatCols["r_p35a"] = vals[0] ?? null;
                flatCols["r_p35b"] = vals[1] ?? null;
                flatCols["r_p35c"] = vals[2] ?? null;
              } else {
                const colName = `r_p${String(colIdx).padStart(2, "0")}`;
                flatCols[colName] = rawVal;
              }
            }
          }
        } catch (err) {
          console.error("[responses.submit] Error construyendo columnas planas:", err);
        }

        const result = await createSurveyResponse({
          ...input,
          ...flatCols,
          encuestadorId: ctx.user.id,
          encuestadorName: ctx.user.name ?? "",
          encuestadorIdentifier: ctx.user.identifier ?? "",
          latitude: input.latitude?.toString(),
          longitude: input.longitude?.toString(),
          gpsAccuracy: input.gpsAccuracy?.toString(),
          answers: input.answers,
          finishedAt: input.finishedAt ?? new Date(),
        });
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
            const recordedAt = input.finishedAt ?? new Date();
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
              startedAt: input.startedAt,
              finishedAt: input.finishedAt ?? new Date(),
              latitude: input.latitude?.toString(),
              longitude: input.longitude?.toString(),
              gpsAccuracy: input.gpsAccuracy?.toString(),
              language: input.language,
              status: input.status,
              earlyExit: input.earlyExit ?? false,
            };
            // Mapear respuestas a columnas vXX / rXX
            const prefix2 = surveyType2 === "visitantes" ? "v" : "r";
            for (const q of realQuestions) {
              const colIdx = q.order - metaCount; // 1-based index of real question
              const colName = `${prefix2}${String(colIdx).padStart(2, "0")}`;
              flatRow[colName] = answerByOrder[q.order] ?? null;
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
        timeSlot: z.enum(["manana", "tarde", "noche", "fin_semana"]).optional(),
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
        dateFrom: input.dateFrom?.toISOString().split('T')[0],
        dateTo: input.dateTo?.toISOString().split('T')[0],
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
  }),
  // ─── Conteo Peatonall ───────────────────────────────────────────────────────────────────────────────

  pedestrian: router({
    createSession: encuestadorProcedure
      .input(z.object({
        surveyPoint: z.string().min(1),
        timeSlot: z.enum(["manana", "tarde", "noche", "fin_semana"]).optional(),
        date: z.string(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        gpsAccuracy: z.number().optional(),
        startedAt: z.date(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await createPedestrianSession({
          ...input,
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
          "Punto de Conteo", "Sentido",
          "Encuestador", "Identificador",
          "Personas",
          "Latitud", "Longitud", "Precisión GPS (m)",
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
            dt.toLocaleDateString("es-ES"),
            dt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            getSlot30(dt),
            p.surveyPoint,
            p.directionLabel ?? "",
            p.encuestadorName ?? "",
            p.encuestadorIdentifier ?? "",
            p.count,
            p.latitude ?? "",
            p.longitude ?? "",
            p.gpsAccuracy ?? "",
          ];
        });
        const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
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
        // Cabeceras metadatos
        const metaHeaders = [
          "ID", "Tipo", "Encuestador", "CodEncuestador",
          "PuntoEncuesta", "FranjaHoraria", "VentanaMedia", "MinutoInicio", "MinutoFin",
          "Inicio", "Fin", "DuracionMin", "Idioma", "Estado", "SalidaAnticipada",
          "Latitud", "Longitud", "GPS_m",
        ];
        // Cabeceras visitantes (v_p01..v_p20)
        const vHeaders = Array.from({ length: 20 }, (_, i) => `V_P${String(i + 1).padStart(2, "0")}`);
        // Cabeceras residentes (r_p01..r_p34 + r_p35a/b/c + r_p36)
        const rHeaders = [
          ...Array.from({ length: 34 }, (_, i) => `R_P${String(i + 1).padStart(2, "0")}`),
          "R_P35a", "R_P35b", "R_P35c", "R_P36",
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
            r.startedAt?.toISOString() ?? "",
            r.finishedAt?.toISOString() ?? "",
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
          // Columnas residentes
          const rCols = [
            ...Array.from({ length: 34 }, (_, i) => rAny[`r_p${String(i + 1).padStart(2, "0")}`] ?? ""),
            rAny.r_p35a ?? "", rAny.r_p35b ?? "", rAny.r_p35c ?? "", rAny.r_p36 ?? "",
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
        const rHeaders = Array.from({ length: 38 }, (_, i) => `R${String(i + 1).padStart(2, "0")}`);
        const headers = [...metaHeaders, ...vHeaders, ...rHeaders];
        const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const csvRows = rows.map((r) => {
          const meta = [
            r.id, r.surveyType ?? "", r.surveyPoint ?? "", r.timeSlot ?? "",
            r.windowCode ?? "", r.minuteStart ?? "", r.minuteEnd ?? "",
            r.encuestadorName ?? "", r.encuestadorCode ?? "",
            r.startedAt?.toISOString() ?? "", r.finishedAt?.toISOString() ?? "",
            r.language, r.status, r.latitude ?? "", r.longitude ?? "",
            r.gpsAccuracy ?? "", r.earlyExit ? "SI" : "NO",
          ];
          const vCols = Array.from({ length: 26 }, (_, i) => (r as any)[`v${String(i + 1).padStart(2, "0")}`] ?? "");
          const rCols = Array.from({ length: 38 }, (_, i) => (r as any)[`r${String(i + 1).padStart(2, "0")}`] ?? "");
          return [...meta, ...vCols, ...rCols];
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
          return [
            r.id,
            dt.toLocaleDateString("es-ES"),
            dt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
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
