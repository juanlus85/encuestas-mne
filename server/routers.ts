import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router, studyProcedure } from "./_core/trpc";
import {
  createPhoto,
  createPedestrianInterval,
  createPedestrianSession,
  createQuestion,
  createSurveyResponse,
  createSurveyTemplate,
  createUser,
  createStudy,
  createStudyUser,
  deletePhotosByResponse,
  deleteQuestion,
  deleteSurveyResponse,
  deleteSurveyAnswersBySurveyId,
  deleteSurveyResponseFlatBySurveyId,
  getActiveSurveyTemplates,
  getAllUsers,
  getDashboardStats,
  getEncuestadores,
  getFieldMetrics,
  getUserById,
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
  getStudies,
  getStudyById,
  getStudySettingsByStudyId,
  getStudyUsers,
  getUserStudyMemberships,
  getSurveyResponseById,
  getSurveyResponses,
  getSurveyResponsesByEncuestador,
  getSurveyTemplateById,
  getSurveyTemplates,
  replaceSurveyAnswers,
  replaceSurveyResponseFlat,
  updatePedestrianInterval,
  updatePedestrianSession,
  updateQuestion,
  updateStudy,
  updateSurveyResponse,
  updateSurveyTemplate,
  updateUser,
  updateStudyUser,
  upsertStudySettings,
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
import {
  createCountingPoint,
  createCountingSubPoint,
  deleteCountingPoint,
  deleteCountingSubPoint,
  listCountingPoints,
  updateCountingPoint,
  updateCountingSubPoint,
} from "./countingPointsStore";
import { getAppSettings, updateAppSettings } from "./appSettingsStore";
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
  const raw = String(val).trim();
  const key = raw.toLowerCase();
  return ANSWER_CODES[key] ?? raw;
}

type SurveyExportSchemaField = {
  key: string;
  label: string;
  defaultOn: boolean;
};

type SurveyExportSchemaGroup = {
  key: string;
  title: string;
  fields: SurveyExportSchemaField[];
};

const SURVEY_EXPORT_META_FIELDS: SurveyExportSchemaField[] = [
  { key: "ID", label: "ID de encuesta", defaultOn: true },
  { key: "Tipo", label: "Tipo de plantilla", defaultOn: true },
  { key: "Plantilla", label: "Nombre de plantilla", defaultOn: true },
  { key: "Encuestador", label: "Nombre del encuestador", defaultOn: true },
  { key: "CodEncuestador", label: "Código del encuestador", defaultOn: true },
  { key: "PuntoEncuesta", label: "Punto de encuesta", defaultOn: true },
  { key: "FranjaHoraria", label: "Franja horaria", defaultOn: true },
  { key: "VentanaMedia", label: "Ventana de 30 minutos", defaultOn: false },
  { key: "MinutoInicio", label: "Minuto de inicio", defaultOn: false },
  { key: "MinutoFin", label: "Minuto de fin", defaultOn: false },
  { key: "Inicio", label: "Fecha y hora de inicio", defaultOn: true },
  { key: "Fin", label: "Fecha y hora de fin", defaultOn: false },
  { key: "DuracionMin", label: "Duración en minutos", defaultOn: false },
  { key: "Idioma", label: "Idioma", defaultOn: false },
  { key: "Estado", label: "Estado", defaultOn: true },
  { key: "SalidaAnticipada", label: "Salida anticipada", defaultOn: true },
  { key: "Latitud", label: "Latitud GPS", defaultOn: false },
  { key: "Longitud", label: "Longitud GPS", defaultOn: false },
  { key: "GPS_m", label: "Precisión GPS (m)", defaultOn: false },
];

async function buildSurveyExportSchema(templateId?: number, studyId?: number): Promise<{
  metaFields: SurveyExportSchemaField[];
  groups: SurveyExportSchemaGroup[];
  questionFields: Array<{ key: string; label: string; templateId: number; questionId: number }>;
}> {
  const templateList = templateId
    ? [await getSurveyTemplateById(templateId, studyId)].filter((template): template is NonNullable<Awaited<ReturnType<typeof getSurveyTemplateById>>> => Boolean(template))
    : await getSurveyTemplates(studyId);

  const groups: SurveyExportSchemaGroup[] = [];
  const questionFields: Array<{ key: string; label: string; templateId: number; questionId: number }> = [];

  for (const template of templateList) {
    const questions = (await getQuestionsByTemplate(template.id, studyId))
      .slice()
      .sort((a, b) => a.order - b.order);

    const fields = questions.map((question) => {
      const key = `Q${question.id}`;
      const orderLabel = String(question.order).padStart(2, "0");
      const label = `${orderLabel} · ${question.text}`;
      questionFields.push({ key, label, templateId: template.id, questionId: question.id });
      return { key, label, defaultOn: true };
    });

    groups.push({
      key: `template-${template.id}`,
      title: `Preguntas · ${template.name}`,
      fields,
    });
  }

  return {
    metaFields: SURVEY_EXPORT_META_FIELDS,
    groups,
    questionFields,
  };
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
    me: protectedProcedure.query(async ({ ctx }) => {
      const memberships = ctx.user ? await getUserStudyMemberships(ctx.user.id) : [];
      const activeStudy = ctx.activeStudyId ? await getStudyById(ctx.activeStudyId) : null;
      return {
        ...ctx.user,
        activeStudyId: ctx.activeStudyId,
        activeStudy,
        studyMemberships: memberships,
      };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  studies: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.platformRole === "supervisor") {
        return getStudies();
      }

      const memberships = await getUserStudyMemberships(ctx.user.id);
      return memberships.map((row) => ({
        ...row.study,
        membership: row.membership,
      }));
    }),

    current: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.activeStudyId) return null;
      const study = await getStudyById(ctx.activeStudyId);
      if (!study) return null;
      const settings = await getStudySettingsByStudyId(study.id);
      const memberships = await getStudyUsers(study.id);
      return { study, settings, memberships, activeStudyId: ctx.activeStudyId };
    }),

    create: protectedProcedure
      .input(z.object({
        code: z.string().min(2).max(64),
        name: z.string().min(2).max(255),
        description: z.string().optional(),
        clientName: z.string().optional(),
        defaultLanguage: z.enum(["es", "en"]).default("en"),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.platformRole !== "supervisor") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Supervisor access required" });
        }

        await createStudy({
          code: input.code,
          name: input.name,
          description: input.description,
          clientName: input.clientName,
          defaultLanguage: input.defaultLanguage,
          createdBy: ctx.user.id,
        });

        const createdStudy = await getStudies().then((rows) => rows.find((row) => row.code === input.code));
        if (!createdStudy) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Study could not be created" });
        }

        await createStudyUser({
          studyId: createdStudy.id,
          userId: ctx.user.id,
          studyRole: "administrator",
          isActive: true,
        });

        const defaultSettings = await getAppSettings();
        await upsertStudySettings({
          studyId: createdStudy.id,
          projectName: createdStudy.name,
          exportProjectName: createdStudy.code,
          mapPrimaryPointCode: defaultSettings.mapPrimaryPointCode,
          surveyTargetTotal: defaultSettings.surveyTargetTotal,
          surveyTargetResidents: defaultSettings.surveyTargetResidents,
          surveyTargetVisitors: defaultSettings.surveyTargetVisitors,
          surveyWeeklyTargetTotal: defaultSettings.surveyWeeklyTargetTotal,
          surveyWeeklyTargetResidents: defaultSettings.surveyWeeklyTargetResidents,
          surveyWeeklyTargetVisitors: defaultSettings.surveyWeeklyTargetVisitors,
          quotasEnabled: defaultSettings.quotasEnabled,
          residentQuotaTotal: defaultSettings.residentQuotaTotal,
          visitorQuotaTotal: defaultSettings.visitorQuotaTotal,
          enabledCharts: defaultSettings.enabledCharts,
          openAiApiKey: defaultSettings.openAiApiKey,
        });

        return createdStudy;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: z.string().min(2).max(255).optional(),
        description: z.string().nullable().optional(),
        clientName: z.string().nullable().optional(),
        status: z.enum(["draft", "active", "paused", "archived"]).optional(),
        defaultLanguage: z.enum(["es", "en"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.platformRole !== "supervisor") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Supervisor access required" });
        }
        const { id, ...data } = input;
        await updateStudy(id, data);
        return { success: true } as const;
      }),

    setActive: protectedProcedure
      .input(z.object({ studyId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const memberships = await getUserStudyMemberships(ctx.user.id);
        if (!memberships.some((row) => row.study.id === input.studyId) && ctx.user.platformRole !== "supervisor") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Study access denied" });
        }
        ctx.res.cookie("activeStudyId", String(input.studyId), {
          httpOnly: false,
          sameSite: "lax",
          secure: false,
          path: "/",
        });
        return { success: true, activeStudyId: input.studyId } as const;
      }),

    assignUser: protectedProcedure
      .input(z.object({
        studyId: z.number().int().positive(),
        userId: z.number().int().positive(),
        studyRole: z.enum(["administrator", "interviewer", "reviewer"]),
        isActive: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.platformRole !== "supervisor") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Supervisor access required" });
        }

        const user = await getUserById(input.userId);
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        const isInterviewerAssignment = input.studyRole === "interviewer" || user.role === "encuestador";
        if (isInterviewerAssignment) {
          const memberships = await getUserStudyMemberships(input.userId);
          await Promise.all(
            memberships
              .filter((row) => row.membership.studyRole === "interviewer" && row.membership.studyId !== input.studyId && row.membership.isActive)
              .map((row) => updateStudyUser(row.membership.id, { isActive: false })),
          );
        }

        const existingAssignments = await getStudyUsers(input.studyId);
        const existingAssignment = [...existingAssignments].reverse().find((row) => row.userId === input.userId);
        if (existingAssignment) {
          await updateStudyUser(existingAssignment.id, {
            studyRole: input.studyRole,
            isActive: input.isActive,
          });
          return { success: true, reassigned: isInterviewerAssignment } as const;
        }

        await createStudyUser(input);
        return { success: true, reassigned: isInterviewerAssignment } as const;
      }),

    updateAssignment: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        studyRole: z.enum(["administrator", "interviewer", "reviewer"]).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.platformRole !== "supervisor") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Supervisor access required" });
        }
        const { id, ...data } = input;
        await updateStudyUser(id, data);
        return { success: true } as const;
      }),

    updateSettings: protectedProcedure
      .input(z.object({
        studyId: z.number().int().positive(),
        projectName: z.string().min(2),
        exportProjectName: z.string().min(2),
      }))
      .mutation(async ({ ctx, input }) => {
        const memberships = await getUserStudyMemberships(ctx.user.id);
        const canManage = ctx.user.platformRole === "supervisor"
          || memberships.some((row) => row.study.id === input.studyId && row.membership.studyRole === "administrator");
        if (!canManage) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Study administration required" });
        }
        await upsertStudySettings(input);
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
    list: studyProcedure.query(({ ctx }) => getSurveyTemplates(ctx.activeStudyId)),
    active: studyProcedure.query(async ({ ctx }) => {
      const all = await getActiveSurveyTemplates(ctx.activeStudyId);
      const assigned = (ctx.user as any).surveyTypeAssigned;
      if (ctx.user && ctx.user.role === "encuestador" && assigned && assigned !== "ambos") {
        return all.filter((t) => t.type === assigned);
      }
      return all;
    }),


    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const template = await getSurveyTemplateById(input.id, ctx.activeStudyId ?? undefined);
        if (!template) throw new TRPCError({ code: "NOT_FOUND" });
        const qs = await getQuestionsByTemplate(input.id, ctx.activeStudyId ?? undefined);
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
      .mutation(async ({ input, ctx }) => {
        await createSurveyTemplate({ ...input, studyId: ctx.activeStudyId ?? undefined } as any);
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
    byTemplate: studyProcedure
      .input(z.object({ templateId: z.number() }))
      .query(({ input, ctx }) => getQuestionsByTemplate(input.templateId, ctx.activeStudyId)),

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
      .mutation(async ({ input, ctx }) => {
        await createQuestion({ ...input, studyId: ctx.activeStudyId ?? undefined } as any);
        return { success: true };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        order: z.number().optional(),
        type: z.enum(["single_choice", "multiple_choice", "text", "scale", "yes_no", "number"]).optional(),
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
            studyId: ctx.activeStudyId ?? undefined,
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

    update: adminOrRevisorProcedure
      .input(z.object({
        id: z.number(),
        templateId: z.number(),
        surveyPoint: z.string().optional(),
        timeSlot: z.enum(["manana", "mediodia", "tarde", "noche", "fin_semana"]).optional(),
        windowCode: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        gpsAccuracy: z.number().optional(),
        startedAt: z.date().optional(),
        finishedAt: z.date().optional(),
        language: z.enum(["es", "en"]).default("es"),
        answers: z.array(z.object({ questionId: z.number(), answer: z.any() })),
        status: z.enum(["completa", "incompleta", "rechazada", "sustitucion"]).default("completa"),
        deviceInfo: z.string().optional(),
        earlyExit: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const existing = await getSurveyResponseById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        let flatCols: Record<string, string | null> = {};
        try {
          const tplQuestions = await getQuestionsByTemplate(input.templateId);
          const tpl = await getSurveyTemplateById(input.templateId);
          const sType = (tpl?.type ?? "visitantes") as "visitantes" | "residentes";
          const metaCount = sType === "visitantes" ? 6 : 4;
          const qMapById = new Map(tplQuestions.map((q) => [q.id, q]));
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
          const realQuestions = tplQuestions.filter((q) => !q.text.startsWith("META:"));
          for (const q of realQuestions) {
            const colIdx = q.order - metaCount;
            const rawVal = answerByOrder[q.order] ?? null;
            if (sType === "visitantes") {
              const colName = `v_p${String(colIdx).padStart(2, "0")}`;
              flatCols[colName] = encodeAnswer(rawVal);
            } else if (colIdx === 36) {
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
          if (sType === "residentes") {
            const viveCentro = flatCols["r_p02"] as string | null;
            if (viveCentro === "1" || viveCentro?.toLowerCase() === "si" || viveCentro?.toLowerCase() === "sí") {
              flatCols["seccion037"] = "1";
            } else if (viveCentro === "2" || viveCentro?.toLowerCase() === "no") {
              flatCols["seccion037"] = "2";
            }
          }
        } catch (err) {
          console.error("[responses.update] Error construyendo columnas planas:", err);
        }

        await updateSurveyResponse(input.id, {
          templateId: input.templateId,
          surveyPoint: input.surveyPoint,
          timeSlot: input.timeSlot,
          windowCode: input.windowCode,
          latitude: input.latitude?.toString(),
          longitude: input.longitude?.toString(),
          gpsAccuracy: input.gpsAccuracy?.toString(),
          startedAt: input.startedAt,
          finishedAt: input.finishedAt,
          language: input.language,
          answers: input.answers,
          status: input.status,
          deviceInfo: input.deviceInfo,
          earlyExit: input.earlyExit,
          ...flatCols,
        } as any);

        if (input.status === "completa") {
          try {
            const templateQuestions = await getQuestionsByTemplate(input.templateId);
            const qMap = new Map(templateQuestions.map((q) => [q.id, q]));
            const template = await getSurveyTemplateById(input.templateId);
            const surveyType = (template?.type ?? "visitantes") as "visitantes" | "residentes";
            const recordedAt = input.finishedAt ?? new Date();
            const answerRows = input.answers.map((a, idx) => {
              const q = qMap.get(a.questionId);
              const opts = (q?.options as Array<{ value: string; label: string; labelEn?: string }> | null) ?? [];
              const rawVal = a.answer;
              let answerValue: string;
              if (Array.isArray(rawVal)) answerValue = JSON.stringify(rawVal);
              else if (rawVal === null || rawVal === undefined) answerValue = "";
              else answerValue = String(rawVal);
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
              const prefix = surveyType === "visitantes" ? "V" : "R";
              const order = q?.order ?? idx + 1;
              const questionCode = `${prefix}${String(order).padStart(2, "0")}`;
              return {
                surveyId: input.id,
                questionCode,
                questionId: a.questionId,
                questionTextEs: q?.text ?? "",
                questionTextEn: q?.textEn ?? q?.text ?? "",
                answerValue,
                answerLabelEs: labelEs,
                answerLabelEn: labelEn,
                surveyType,
                surveyPoint: input.surveyPoint,
                encuestadorId: existing.encuestadorId,
                encuestadorName: existing.encuestadorName ?? "",
                encuestadorIdentifier: existing.encuestadorIdentifier ?? "",
                recordedAt,
              };
            });
            await replaceSurveyAnswers(input.id, answerRows as any);
          } catch (err) {
            console.error("[survey_answers] Error al reemplazar respuestas normalizadas:", err);
          }
          try {
            const template2 = await getSurveyTemplateById(input.templateId);
            const surveyType2 = (template2?.type ?? "visitantes") as "visitantes" | "residentes";
            const templateQuestions2 = await getQuestionsByTemplate(input.templateId);
            const realQuestions = templateQuestions2.filter((q) => !q.text.startsWith("META:"));
            const metaCount = surveyType2 === "visitantes" ? 6 : 4;
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
            const flatRow: Record<string, unknown> = {
              surveyId: input.id,
              surveyType: surveyType2,
              surveyPoint: input.surveyPoint,
              timeSlot: input.timeSlot,
              windowCode: input.windowCode,
              minuteStart: existing.minuteStart != null ? String(existing.minuteStart) : undefined,
              minuteEnd: existing.minuteEnd != null ? String(existing.minuteEnd) : undefined,
              encuestadorId: existing.encuestadorId,
              encuestadorName: existing.encuestadorName ?? "",
              encuestadorCode: existing.encuestadorIdentifier ?? "",
              startedAt: input.startedAt ?? existing.startedAt,
              finishedAt: input.finishedAt,
              latitude: input.latitude?.toString(),
              longitude: input.longitude?.toString(),
              gpsAccuracy: input.gpsAccuracy?.toString(),
              language: input.language,
              status: input.status,
              earlyExit: input.earlyExit ?? false,
            };
            const prefix2 = surveyType2 === "visitantes" ? "v" : "r";
            for (const q of realQuestions) {
              const colIdx = q.order - metaCount;
              const colName = `${prefix2}${String(colIdx).padStart(2, "0")}`;
              const rawAns = (answerByOrder[q.order] ?? null) as string | null;
              flatRow[colName] = encodeAnswer(rawAns);
            }
            if (surveyType2 === "residentes") {
              const viveCentro = flatRow["r02"] as string | null;
              if (viveCentro === "1" || viveCentro?.toLowerCase() === "si" || viveCentro?.toLowerCase() === "sí") {
                flatRow["seccion037"] = 1;
              } else if (viveCentro === "2" || viveCentro?.toLowerCase() === "no") {
                flatRow["seccion037"] = 2;
              }
            }
            await replaceSurveyResponseFlat(input.id, flatRow as any);
          } catch (err) {
            console.error("[survey_responses_flat] Error al reemplazar fila plana:", err);
          }
        } else {
          await replaceSurveyAnswers(input.id, []);
          await replaceSurveyResponseFlat(input.id, null);
        }

        return { success: true, id: input.id };
      }),

    delete: adminOrRevisorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deletePhotosByResponse(input.id);
        await deleteSurveyAnswersBySurveyId(input.id);
        await deleteSurveyResponseFlatBySurveyId(input.id);
        await deleteSurveyResponse(input.id);
        return { success: true };
      }),

     list: studyProcedure
      .input(z.object({
        encuestadorId: z.number().optional(),
        templateId: z.number().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        status: z.string().optional(),
      }).optional())
      .query(({ input, ctx }) => getSurveyResponses({ ...(input ?? {}), studyId: ctx.activeStudyId })),


    myList: encuestadorProcedure
      .query(({ ctx }) => getSurveyResponsesByEncuestador(ctx.user.id, ctx.activeStudyId ?? undefined)),

    byId: studyProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const response = await getSurveyResponseById(input.id, ctx.activeStudyId);
        if (!response) throw new TRPCError({ code: "NOT_FOUND" });
        const responsePhotos = await getPhotosByResponse(input.id, ctx.activeStudyId ?? undefined);
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
      .query(({ input, ctx }) => getFieldMetrics(input ? {
        studyId: ctx.activeStudyId ?? undefined,
        encuestadorId: input.encuestadorId,
        dateFrom: input.dateFrom ? new Date(input.dateFrom).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) : undefined,
        dateTo: input.dateTo ? new Date(input.dateTo).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) : undefined,
      } : { studyId: ctx.activeStudyId ?? undefined })),
  }),

  // ─── Dashboard ──────────────────────────────────────────────────────────────

  dashboard: router({
    stats: adminOrRevisorProcedure
      .input(z.object({
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        encuestadorId: z.number().optional(),
      }).optional())
      .query(({ input, ctx }) => getDashboardStats({ ...(input ?? {}), studyId: ctx.activeStudyId ?? undefined })),

    byDay: adminOrRevisorProcedure
      .input(z.object({ dateFrom: z.date().optional(), dateTo: z.date().optional() }).optional())
      .query(({ input, ctx }) => getResponsesByDay({ ...(input ?? {}), studyId: ctx.activeStudyId ?? undefined })),

    byEncuestador: adminOrRevisorProcedure
      .input(z.object({ dateFrom: z.date().optional(), dateTo: z.date().optional() }).optional())
      .query(({ input, ctx }) => getResponsesByEncuestador({ ...(input ?? {}), studyId: ctx.activeStudyId ?? undefined })),

    byTimeSlot: adminOrRevisorProcedure
      .input(z.object({ dateFrom: z.date().optional(), dateTo: z.date().optional() }).optional())
      .query(({ input, ctx }) => getResponsesByTimeSlot({ ...(input ?? {}), studyId: ctx.activeStudyId ?? undefined })),

    byStatus: adminOrRevisorProcedure
      .input(z.object({ dateFrom: z.date().optional(), dateTo: z.date().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const { getDb } = await import('./db');
        const { surveyResponses } = await import('../drizzle/schema');
        const { sql, and, eq, gte, lte } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) return [];
        const conditions = [];
        if (ctx.activeStudyId) conditions.push(eq(surveyResponses.studyId, ctx.activeStudyId));
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
      .query(({ input, ctx }) => getGpsLocations({ ...(input ?? {}), studyId: ctx.activeStudyId ?? undefined })),
    latestLocations: adminOrRevisorProcedure
      .query(({ ctx }) => getLatestEncuestadorLocations(ctx.activeStudyId ?? undefined)),

    // ── Estadísticas detalladas de visitantes ──────────────────────────────
    visitantesStats: adminOrRevisorProcedure
      .input(z.object({ dateFrom: z.date().optional(), dateTo: z.date().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const responses = await getSurveyResponses({
          studyId: ctx.activeStudyId ?? undefined,
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
      .query(async ({ input, ctx }) => {
        const responses = await getSurveyResponses({
          studyId: ctx.activeStudyId ?? undefined,
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

        // ── Lookup dinámico de questionIds por texto de pregunta ──────────────
        // Buscar el template de residentes activo y cargar sus preguntas
        const { getDb } = await import('./db');
        const { questions: questionsTable, surveyTemplates: templatesTable } = await import('../drizzle/schema');
        const { and: andOp, eq: eqOp, like } = await import('drizzle-orm');
        const db = await getDb();

        // Mapa: prefijo de texto → questionId (se rellena dinámicamente)
        const qMap: Record<string, number> = {};
        if (db) {
          // Buscar templateId de residentes
          const tmplRows = await db.select().from(templatesTable)
            .where(
              ctx.activeStudyId
                ? andOp(eqOp(templatesTable.type, 'residentes'), eqOp(templatesTable.studyId, ctx.activeStudyId))
                : eqOp(templatesTable.type, 'residentes')
            ).limit(1);
          if (tmplRows.length > 0) {
            const tmplId = tmplRows[0].id;
            const qRows = await db.select().from(questionsTable)
              .where(eqOp(questionsTable.templateId, tmplId));
            for (const q of qRows) {
              const t = q.text ?? '';
              // Mapear por prefijo de pregunta (P4, P5, P3, P1.0, P2, P6.01..P6.15, P7a..P7f, P8, P9, P10, P11, P12)
              const prefixes = [
                'P4.', 'P5.', 'P3.', 'P1.0.', 'P2.', 'P1.1.', 'P1.2.', 'P1.3.',
                'P6.01', 'P6.02', 'P6.03', 'P6.04', 'P6.05', 'P6.06', 'P6.07',
                'P6.08', 'P6.09', 'P6.10', 'P6.11', 'P6.12', 'P6.13', 'P6.14', 'P6.15',
                'P7a.', 'P7b.', 'P7c.', 'P7d.', 'P7e.', 'P7f.',
                'P8.', 'P9.', 'P10.', 'P11.', 'P12.',
              ];
              for (const pfx of prefixes) {
                if (t.startsWith(pfx)) { qMap[pfx] = q.id; break; }
              }
              // También mapear P1 sin punto (P1. ¿Es residente...)
              if (t.startsWith('P1. ') || t.startsWith('P1.¿')) qMap['P1.'] = q.id;
            }
          }
        }

        // Helper para obtener qId por prefijo
        const qId = (pfx: string) => qMap[pfx] ?? -1;

        const genero: string[] = [];
        const edad: string[] = [];
        const vinculo: string[] = [];
        const territorio: string[] = [];
        const satisfItems: Record<string, number[]> = {};
        const frecItems: Record<string, string[]> = {};
        const comportamiento: string[] = [];
        const problemas: string[] = [];
        const impactoItems: Record<string, number[]> = {};

        // Labels de satisfacción P6.01..P6.15 (por prefijo)
        const satisfPrefixes: [string, string][] = [
          ['P6.01', 'Economía local'], ['P6.02', 'Congestión'], ['P6.03', 'Nuevos inversores'],
          ['P6.04', 'Precio vivienda'], ['P6.05', 'Calidad de vida'], ['P6.06', 'Desplazamiento vecinos'],
          ['P6.07', 'Prestigio ciudad'], ['P6.08', 'Pérdida identidad'], ['P6.09', 'Conservación monumentos'],
          ['P6.10', 'Tráfico'], ['P6.11', 'Opciones ocio'], ['P6.12', 'Mejora servicios'],
          ['P6.13', 'Consumo recursos'], ['P6.14', 'Contaminación'], ['P6.15', 'Tolerancia'],
        ];
        // Labels de frecuencia P7a..P7f
        const frecPrefixes: [string, string][] = [
          ['P7a.', 'Comercios proximidad'], ['P7b.', 'Acomp. escolar'], ['P7c.', 'Ocio comunitario'],
          ['P7d.', 'Trayectos trabajo'], ['P7e.', 'Transporte público'], ['P7f.', 'A pie/bicicleta'],
        ];
        // Labels de impacto P10..P12
        const impactoPrefixes: [string, string][] = [
          ['P10.', 'Cambio uso espacio'], ['P11.', 'Impacto personal'], ['P12.', 'Impacto comunidad'],
        ];

        for (const r of res) {
          const raw = typeof r.answers === "string" ? JSON.parse(r.answers) : r.answers;
          const ans = (raw as any[]) ?? [];

          const g = getA(ans, qId('P4.'));
          if (g) genero.push(g);
          const e = getA(ans, qId('P5.'));
          if (e) edad.push(e);
          const v = getA(ans, qId('P3.'));
          if (v) vinculo.push(v);
          const tc = getA(ans, qId('P1.0.'));
          if (tc) territorio.push(tc === "si" || tc === "1" ? "Centro histórico" : "Resto Sevilla");

          // Satisfacción P6.01..P6.15
          for (const [pfx, label] of satisfPrefixes) {
            const id = qId(pfx);
            if (id < 0) continue;
            const val = Number(getA(ans, id));
            if (!isNaN(val) && val > 0 && val <= 5) {
              if (!satisfItems[label]) satisfItems[label] = [];
              satisfItems[label].push(val);
            }
          }

          // Frecuencia P7a..P7f
          for (const [pfx, label] of frecPrefixes) {
            const id = qId(pfx);
            if (id < 0) continue;
            const val = getA(ans, id);
            if (val) {
              if (!frecItems[label]) frecItems[label] = [];
              frecItems[label].push(val);
            }
          }

          // Comportamiento P8
          const comp = getA(ans, qId('P8.'));
          if (comp) comportamiento.push(comp);

          // Problemas P9 (múltiple)
          const prob = getA(ans, qId('P9.'));
          if (prob) {
            let arr: string[] = [];
            try { arr = Array.isArray(prob) ? prob : JSON.parse(prob); } catch { arr = [prob]; }
            problemas.push(...arr);
          }

          // Impacto P10..P12
          for (const [pfx, label] of impactoPrefixes) {
            const id = qId(pfx);
            if (id < 0) continue;
            const val = Number(getA(ans, id));
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
          dificultad_caminar: "Dif. caminar", inseguridad_vial: "Inseg. vial",
          ruido: "Ruido", cambios_rutas: "Cambio rutas",
          dificultad_acceso: "Dif. acceso", perdida_identidad: "Pérdida identidad",
          ninguna: "Ninguna",
        };
        const EDAD_LABELS: Record<string, string> = {
          "18_29": "18-29", "30_44": "30-44", "45_64": "45-64", "65_75": "65-75", "76_mas": ">75",
        };
        const VINCULO_LABELS: Record<string, string> = {
          si_yo: "Sí, yo", si_otro: "Sí, familiar", no: "No",
        };

        const relabel = (arr: string[], labels: Record<string, string>) =>
          count(arr).map((d) => ({ ...d, name: labels[d.name] ?? d.name }));

        // Centro histórico: contar encuestas donde P1.0 = 'si' o P1.1 tiene valor
        const centroHistorico = res.filter((r) => {
          const raw = typeof r.answers === "string" ? JSON.parse(r.answers) : r.answers;
          const ans = (raw as any[]) ?? [];
          const tc = getA(ans, qId('P1.0.'));
          return tc === 'si' || tc === '1' || tc === true;
        }).length;

        // Vínculo turístico: P3 !== 'no'
        const conVinculo = res.filter((r) => {
          const raw = typeof r.answers === "string" ? JSON.parse(r.answers) : r.answers;
          const ans = (raw as any[]) ?? [];
          const v2 = getA(ans, qId('P3.'));
          return v2 && v2 !== 'no';
        }).length;

        // Adaptan comportamiento: P8 !== 'no'
        const adaptanComp = res.filter((r) => {
          const raw = typeof r.answers === "string" ? JSON.parse(r.answers) : r.answers;
          const ans = (raw as any[]) ?? [];
          const c2 = getA(ans, qId('P8.'));
          return c2 && c2 !== 'no';
        }).length;

        return {
          total: res.length,
          centroHistorico,
          conVinculo,
          adaptanComp,
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
      .query(async ({ input, ctx }) => {
        const { getDb } = await import('./db');
        const { pedestrianPasses, countingSessions } = await import('../drizzle/schema');
        const { sql, and, eq, gte, lte } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) return { total: 0, byPunto: [], byTramo: [], bySentido: [], sessions: [] };

        const passConditions: any[] = [];
        if (ctx.activeStudyId) passConditions.push(eq(pedestrianPasses.studyId, ctx.activeStudyId));
        if (input?.dateFrom) passConditions.push(gte(pedestrianPasses.recordedAt, input.dateFrom));
        if (input?.dateTo) passConditions.push(lte(pedestrianPasses.recordedAt, input.dateTo));
        const where = passConditions.length > 0 ? and(...passConditions) : undefined;

        // Total y por punto principal (agrupado SOLO por surveyPointCode)
        const byPuntoRows = await db
          .select({
            puntoCode: pedestrianPasses.surveyPointCode,
            total: sql<number>`sum(${pedestrianPasses.count})`,
            registros: sql<number>`count(*)`
          })
          .from(pedestrianPasses)
          .where(where)
          .groupBy(pedestrianPasses.surveyPointCode);

        // Consolidar: inicializar todos los puntos configurados en el proyecto y acumular los reales
        const configuredPoints = await listCountingPoints(ctx.activeStudyId ?? undefined);
        const puntoMap = new Map<string, { code: string; name: string; value: number; registros: number }>();
        for (const p of configuredPoints) {
          puntoMap.set(p.code, { code: p.code, name: p.fullName, value: 0, registros: 0 });
        }
        for (const r of byPuntoRows) {
          const code = (r.puntoCode ?? "").trim();
          if (!code) continue;
          const existing = puntoMap.get(code);
          if (existing) {
            existing.value += Number(r.total ?? 0);
            existing.registros += Number(r.registros ?? 0);
          } else {
            puntoMap.set(code, { code, name: code, value: Number(r.total ?? 0), registros: Number(r.registros ?? 0) });
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
        const sessionConditions: any[] = [];
        if (ctx.activeStudyId) sessionConditions.push(eq(countingSessions.studyId, ctx.activeStudyId));
        if (input?.dateFrom) sessionConditions.push(gte(countingSessions.startedAt, input.dateFrom));
        if (input?.dateTo) sessionConditions.push(lte(countingSessions.startedAt, input.dateTo));
        const sessionRows = await db.select().from(countingSessions)
          .where(sessionConditions.length > 0 ? and(...sessionConditions) : undefined);

        const allPuntos = Array.from(puntoMap.values());
        const totalPersons = allPuntos.reduce((acc, r) => acc + r.value, 0);

        return {
          total: totalPersons,
          byPunto: allPuntos.sort((a, b) => a.code.localeCompare(b.code)).map(({ code: _code, ...point }) => point),
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
          studyId: ctx.activeStudyId ?? null,
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
      .query(({ input, ctx }) => getPedestrianSessions({ ...(input ?? {}), studyId: ctx.activeStudyId ?? undefined })),

    mySessions: encuestadorProcedure
      .query(({ ctx }) => getPedestrianSessions({ encuestadorId: ctx.user.id, studyId: ctx.activeStudyId ?? undefined })),

    sessionDetail: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const session = await getPedestrianSessionById(input.id, ctx.activeStudyId ?? undefined);
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
          studyId: ctx.activeStudyId ?? null,
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
      .query(({ input, ctx }) => getPedestrianPasses({ ...(input ?? {}), studyId: ctx.activeStudyId ?? undefined })),

    stats: adminOrRevisorProcedure
      .input(z.object({
        surveyPoint: z.string().optional(),
        encuestadorId: z.number().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(({ input, ctx }) => getPedestrianPassStats({ ...(input ?? {}), studyId: ctx.activeStudyId ?? undefined })),
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
          studyId: ctx.activeStudyId ?? null,
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
      .query(({ input, ctx }) => getCountingSessions({ ...(input ?? {}), studyId: ctx.activeStudyId ?? undefined })),
  }),

  // ─── Counting Points ─────────────────────────────────────────────────────────────────────────

  appSettings: router({
    get: protectedProcedure.query(({ ctx }) => getAppSettings(ctx.activeStudyId ?? undefined)),

    update: adminProcedure
      .input(z.object({
        projectName: z.string().trim().min(1).optional(),
        exportProjectName: z.string().trim().min(1).optional(),
        mapPrimaryPointCode: z.string().regex(/^\d{2}$/).nullable().optional(),
        surveyTargetTotal: z.number().int().min(0).optional(),
        surveyTargetResidents: z.number().int().min(0).optional(),
        surveyTargetVisitors: z.number().int().min(0).optional(),
        surveyWeeklyTargetTotal: z.number().int().min(0).optional(),
        surveyWeeklyTargetResidents: z.number().int().min(0).optional(),
        surveyWeeklyTargetVisitors: z.number().int().min(0).optional(),
        quotasEnabled: z.boolean().optional(),
        residentQuotaTotal: z.number().int().min(0).optional(),
        visitorQuotaTotal: z.number().int().min(0).optional(),
        enabledCharts: z.array(z.string().trim().min(1)).optional(),
        openAiApiKey: z.string().optional(),
      }))
      .mutation(({ input, ctx }) => updateAppSettings(input, ctx.activeStudyId ?? undefined)),
  }),

  countingPoints: router({
    list: protectedProcedure.query(({ ctx }) => listCountingPoints(ctx.activeStudyId ?? undefined)),

    createPoint: adminProcedure
      .input(z.object({
        code: z.string().regex(/^\d{2}$/).optional(),
        name: z.string().min(1),
      }))
      .mutation(({ input, ctx }) => {
        if (!ctx.activeStudyId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Active study required" });
        }
        return createCountingPoint(ctx.activeStudyId, input);
      }),

    updatePoint: adminProcedure
      .input(z.object({
        code: z.string().regex(/^\d{2}$/),
        name: z.string().min(1),
      }))
      .mutation(({ input, ctx }) => {
        if (!ctx.activeStudyId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Active study required" });
        }
        return updateCountingPoint(ctx.activeStudyId, input);
      }),

    deletePoint: adminProcedure
      .input(z.object({ code: z.string().regex(/^\d{2}$/) }))
      .mutation(({ input, ctx }) => {
        if (!ctx.activeStudyId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Active study required" });
        }
        return deleteCountingPoint(ctx.activeStudyId, input);
      }),

    createSubPoint: adminProcedure
      .input(z.object({
        pointCode: z.string().regex(/^\d{2}$/),
        code: z.string().regex(/^\d{2}\.\d{2}$/).optional(),
        name: z.string().min(1),
      }))
      .mutation(({ input, ctx }) => {
        if (!ctx.activeStudyId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Active study required" });
        }
        return createCountingSubPoint(ctx.activeStudyId, input);
      }),

    updateSubPoint: adminProcedure
      .input(z.object({
        pointCode: z.string().regex(/^\d{2}$/),
        code: z.string().regex(/^\d{2}\.\d{2}$/),
        name: z.string().min(1),
      }))
      .mutation(({ input, ctx }) => {
        if (!ctx.activeStudyId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Active study required" });
        }
        return updateCountingSubPoint(ctx.activeStudyId, input);
      }),

    deleteSubPoint: adminProcedure
      .input(z.object({
        pointCode: z.string().regex(/^\d{2}$/),
        code: z.string().regex(/^\d{2}\.\d{2}$/),
      }))
      .mutation(({ input, ctx }) => {
        if (!ctx.activeStudyId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Active study required" });
        }
        return deleteCountingSubPoint(ctx.activeStudyId, input);
      }),
  }),

  // ─── Pedestrian Directions ────────────────────────────────────────────────────────────────────

  directions: router({
    byPoint: protectedProcedure
      .input(z.object({ surveyPoint: z.string() }))
      .query(({ input, ctx }) => getDirectionsByPoint(input.surveyPoint, ctx.activeStudyId ?? undefined)),

    allPoints: protectedProcedure
      .query(({ ctx }) => getAllDirectionPoints(ctx.activeStudyId ?? undefined)),

    create: adminProcedure
      .input(z.object({
        surveyPoint: z.string(),
        label: z.string(),
        description: z.string().optional(),
        order: z.number().optional(),
      }))
      .mutation(({ input, ctx }) => createPedestrianDirection({ ...input, studyId: ctx.activeStudyId ?? undefined })),

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
      .query(async ({ input, ctx }) => {
        const passes = await getPedestrianPasses({ ...(input ?? {}), studyId: ctx.activeStudyId ?? undefined });
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
    csvSchema: adminOrRevisorProcedure
      .input(z.object({
        templateId: z.number().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const schema = await buildSurveyExportSchema(input?.templateId, ctx.activeStudyId ?? undefined);
        return {
          metaFields: schema.metaFields,
          groups: schema.groups,
        };
      }),
    csv: adminOrRevisorProcedure
      .input(z.object({
        encuestadorId: z.number().optional(),
        templateId: z.number().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const responses = await getSurveyResponses({ ...(input ?? {}), studyId: ctx.activeStudyId ?? undefined });
        const schema = await buildSurveyExportSchema(input?.templateId, ctx.activeStudyId ?? undefined);
        const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const fmtDate = (d: Date) => {
          const tz = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
          const parts = tz.formatToParts(d);
          const p = Object.fromEntries(parts.filter(x => x.type !== "literal").map(x => [x.type, x.value]));
          return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
        };
        const formatAnswer = (value: unknown): string => {
          if (value === null || value === undefined) return "";
          if (Array.isArray(value)) {
            return value.map((item) => {
              if (item && typeof item === "object") {
                const record = item as Record<string, unknown>;
                return String(record.label ?? record.value ?? JSON.stringify(item));
              }
              return String(item);
            }).join(" | ");
          }
          if (typeof value === "object") {
            const record = value as Record<string, unknown>;
            return String(record.label ?? record.value ?? JSON.stringify(value));
          }
          return String(value);
        };

        const metaHeaders = schema.metaFields.map((field) => field.key);
        const questionHeaders = schema.questionFields.map((field) => field.key);
        const headers = [...metaHeaders, ...questionHeaders];

        const rows = responses.map((r) => {
          const rawAnswers = typeof r.answers === "string"
            ? (() => { try { return JSON.parse(r.answers); } catch { return []; } })()
            : (Array.isArray(r.answers) ? r.answers : []);
          const answerMap = new Map<number, unknown>(
            (rawAnswers as Array<{ questionId: number; answer: unknown }>).map((answer) => [Number(answer.questionId), answer.answer]),
          );
          const durMin = (r.startedAt && r.finishedAt)
            ? Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 60000)
            : "";
          const templateName = schema.groups.find((group) => group.key === `template-${r.templateId}`)?.title.replace(/^Preguntas · /, "") ?? "";
          const meta = [
            r.id,
            (r as any).templateType ?? "",
            templateName,
            r.encuestadorName ?? "",
            r.encuestadorIdentifier ?? "",
            r.surveyPoint ?? "",
            r.timeSlot ?? "",
            (r as any).windowCode ?? "",
            (r as any).minuteStart ?? "",
            (r as any).minuteEnd ?? "",
            r.startedAt ? fmtDate(new Date(r.startedAt)) : "",
            r.finishedAt ? fmtDate(new Date(r.finishedAt)) : "",
            durMin,
            r.language,
            r.status,
            (r as any).earlyExit ? "SI" : "NO",
            r.latitude ?? "",
            r.longitude ?? "",
            r.gpsAccuracy ?? "",
          ];
          const dynamicCols = schema.questionFields.map((field) => formatAnswer(answerMap.get(field.questionId)));
          return [...meta, ...dynamicCols];
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
      .query(async ({ input, ctx }) => {
        const rows = await getSurveyResponsesFlat({ ...(input ?? {}), studyId: ctx.activeStudyId ?? undefined });
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
      .query(async ({ input, ctx }) => {
        let closures = await getAllShiftClosures(ctx.activeStudyId ?? undefined);
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
    getAll: adminProcedure.query(({ ctx }) => getAllShifts(ctx.activeStudyId ?? undefined)),
    // Encuestador: ver mis turnos
    getMine: protectedProcedure.query(({ ctx }) => getShiftsByEncuestador(ctx.user.id, ctx.activeStudyId ?? undefined)),
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
      .mutation(({ input, ctx }) => createShift({ ...input, studyId: ctx.activeStudyId ?? null })),
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
          studyId: ctx.activeStudyId ?? null,
          encuestadorId: ctx.user.id,
          encuestadorName: ctx.user.name ?? undefined,
          closedAt: new Date(),
          ...input,
        })
      ),
    // Encuestador: ver mis cierres
    getMine: protectedProcedure.query(({ ctx }) =>
      getShiftClosuresByEncuestador(ctx.user.id, ctx.activeStudyId ?? undefined)
    ),
    // Admin/Revisor: ver todos los cierres
    getAll: adminOrRevisorProcedure.query(({ ctx }) => getAllShiftClosures(ctx.activeStudyId ?? undefined)),
    // Encuestador: resumen del día actual (encuestas, conteos, rechazos)
    todaySummary: protectedProcedure.query(async ({ ctx }) => {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
      const todayStr = today.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
      // Encuestas del día
      const allResponses = await getSurveyResponsesByEncuestador(ctx.user.id, ctx.activeStudyId ?? undefined);
      const todayEncuestas = allResponses.filter((r) => {
        const dStr = new Date(r.startedAt).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
        return dStr === todayStr;
      });
      // Rechazos del día
      const allRejections = await getSurveyRejections({ encuestadorId: ctx.user.id, dateFrom: todayStr, dateTo: todayStr, studyId: ctx.activeStudyId ?? undefined });
      // Conteos del día
      const allPasses = await getPedestrianPasses({ encuestadorId: ctx.user.id, dateFrom: todayStr, dateTo: todayStr, studyId: ctx.activeStudyId ?? undefined });
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
    progress: protectedProcedure.query(async ({ ctx }) => {
      const settings = await getAppSettings(ctx.activeStudyId ?? undefined);
      // Obtener todas las respuestas completas
      const allResponses = await getSurveyResponses({ studyId: ctx.activeStudyId ?? undefined, status: "completa" });

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
          enabled: settings.quotasEnabled,
          total: { current: visitantesResponses.length, target: settings.visitorQuotaTotal },
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
          enabled: settings.quotasEnabled,
          total: { current: residentesResponses.length, target: settings.residentQuotaTotal },
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
