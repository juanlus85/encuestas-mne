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
} from "./db";
import { hashPassword } from "./_core/localAuth";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

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
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await createSurveyResponse({
          ...input,
          encuestadorId: ctx.user.id,
          encuestadorName: ctx.user.name ?? "",
          encuestadorIdentifier: ctx.user.identifier ?? "",
          latitude: input.latitude?.toString(),
          longitude: input.longitude?.toString(),
          gpsAccuracy: input.gpsAccuracy?.toString(),
          answers: input.answers,
          finishedAt: input.finishedAt ?? new Date(),
        });
        return { success: true, id: result?.insertId };
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
        return { ...response, photos: responsePhotos };
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
  }),

  // ─── Conteo Peatonal ───────────────────────────────────────────────────────────────────────────────

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
        surveyPoint: z.string(),
        directionId: z.number().optional(),
        directionLabel: z.string().optional(),
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
          directionId: input.directionId ?? null,
          directionLabel: input.directionLabel ?? null,
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
    csv: adminOrRevisorProcedure
      .input(z.object({
        encuestadorId: z.number().optional(),
        templateId: z.number().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        const responses = await getSurveyResponses(input);
        // Helper: calcular tramo de media hora a partir de la hora de inicio
        const getHalfHourSlot = (dt: Date | null | undefined): string => {
          if (!dt) return "";
          const h = dt.getHours().toString().padStart(2, "0");
          const m = dt.getMinutes() < 30 ? "00" : "30";
          const endMin = dt.getMinutes() < 30 ? "30" : "00";
          const endH = dt.getMinutes() < 30 ? dt.getHours() : dt.getHours() + 1;
          return `${h}:${m}-${endH.toString().padStart(2, "0")}:${endMin}`;
        };
        const headers = [
          "ID", "Plantilla", "Tipo", "Encuestador", "Identificador", "Dispositivo",
          "Punto Encuesta", "Franja", "Tramo30min", "Latitud", "Longitud", "Precisión GPS (m)",
          "Inicio", "Fin", "Idioma", "Estado", "Respuestas"
        ];
        const rows = responses.map((r) => [
          r.id,
          r.templateId,
          (r as any).templateType ?? "",
          r.encuestadorName ?? "",
          r.encuestadorIdentifier ?? "",
          r.deviceInfo ?? "",
          r.surveyPoint ?? "",
          r.timeSlot ?? "",
          getHalfHourSlot(r.startedAt),
          r.latitude ?? "",
          r.longitude ?? "",
          r.gpsAccuracy ?? "",
          r.startedAt?.toISOString() ?? "",
          r.finishedAt?.toISOString() ?? "",
          r.language,
          r.status,
          JSON.stringify(r.answers),
        ]);
        // Build CSV string
        const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const csvLines = [
          headers.map(escape).join(","),
          ...rows.map((row) => row.map(escape).join(",")),
        ];
        return { csv: csvLines.join("\n"), count: rows.length };
      }),
  }),
});

export type AppRouter = typeof appRouter;
