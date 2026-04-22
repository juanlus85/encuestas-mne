import { promises as fs } from "node:fs";
import path from "node:path";
import { getStudySettingsByStudyId, upsertStudySettings } from "./db";

export interface AppSettings {
  projectName: string;
  exportProjectName: string;
  mapPrimaryPointCode: string | null;
  surveyTargetTotal: number;
  surveyTargetResidents: number;
  surveyTargetVisitors: number;
  surveyWeeklyTargetTotal: number;
  surveyWeeklyTargetResidents: number;
  surveyWeeklyTargetVisitors: number;
  quotasEnabled: boolean;
  residentQuotaTotal: number;
  visitorQuotaTotal: number;
  enabledCharts: string[];
  openAiApiKey: string;
}

const STORE_PATH = path.resolve(import.meta.dirname, "..", "data", "app-settings.json");

const DEFAULT_ENABLED_CHARTS = [
  "overview",
  "survey_targets",
  "survey_by_type",
  "survey_by_point",
  "survey_by_interviewer",
  "survey_by_day",
  "rejections_overview",
  "rejections_by_type",
];

const DEFAULT_SETTINGS: AppSettings = {
  projectName: "Survexia",
  exportProjectName: "survexia",
  mapPrimaryPointCode: "01",
  surveyTargetTotal: 750,
  surveyTargetResidents: 300,
  surveyTargetVisitors: 450,
  surveyWeeklyTargetTotal: 0,
  surveyWeeklyTargetResidents: 0,
  surveyWeeklyTargetVisitors: 0,
  quotasEnabled: true,
  residentQuotaTotal: 300,
  visitorQuotaTotal: 450,
  enabledCharts: DEFAULT_ENABLED_CHARTS,
  openAiApiKey: "",
};

function normalizeTarget(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.round(parsed);
}

function normalizeText(value: unknown, fallback: string, options: { lowercase?: boolean } = {}) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return options.lowercase ? trimmed.toLowerCase() : trimmed;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function normalizeCharts(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return [...fallback];
  const sanitized = value
    .filter((chartId): chartId is string => typeof chartId === "string")
    .map((chartId) => chartId.trim())
    .filter(Boolean);

  return sanitized.length > 0 ? Array.from(new Set(sanitized)) : [...fallback];
}

function normalizeSettings(input: Partial<AppSettings>): AppSettings {
  return {
    projectName: normalizeText(input.projectName, DEFAULT_SETTINGS.projectName),
    exportProjectName: normalizeText(input.exportProjectName, DEFAULT_SETTINGS.exportProjectName, { lowercase: true }),
    mapPrimaryPointCode: input.mapPrimaryPointCode ?? DEFAULT_SETTINGS.mapPrimaryPointCode,
    surveyTargetTotal: normalizeTarget(input.surveyTargetTotal, DEFAULT_SETTINGS.surveyTargetTotal),
    surveyTargetResidents: normalizeTarget(input.surveyTargetResidents, DEFAULT_SETTINGS.surveyTargetResidents),
    surveyTargetVisitors: normalizeTarget(input.surveyTargetVisitors, DEFAULT_SETTINGS.surveyTargetVisitors),
    surveyWeeklyTargetTotal: normalizeTarget(input.surveyWeeklyTargetTotal, DEFAULT_SETTINGS.surveyWeeklyTargetTotal),
    surveyWeeklyTargetResidents: normalizeTarget(input.surveyWeeklyTargetResidents, DEFAULT_SETTINGS.surveyWeeklyTargetResidents),
    surveyWeeklyTargetVisitors: normalizeTarget(input.surveyWeeklyTargetVisitors, DEFAULT_SETTINGS.surveyWeeklyTargetVisitors),
    quotasEnabled: normalizeBoolean(input.quotasEnabled, DEFAULT_SETTINGS.quotasEnabled),
    residentQuotaTotal: normalizeTarget(input.residentQuotaTotal, DEFAULT_SETTINGS.residentQuotaTotal),
    visitorQuotaTotal: normalizeTarget(input.visitorQuotaTotal, DEFAULT_SETTINGS.visitorQuotaTotal),
    enabledCharts: normalizeCharts(input.enabledCharts, DEFAULT_SETTINGS.enabledCharts),
    openAiApiKey: typeof input.openAiApiKey === "string" ? input.openAiApiKey : DEFAULT_SETTINGS.openAiApiKey,
  };
}

async function ensureStore() {
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2));
  }
}

async function getLegacyAppSettings(): Promise<AppSettings> {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  const parsed = JSON.parse(raw) as Partial<AppSettings>;
  return normalizeSettings({
    ...DEFAULT_SETTINGS,
    ...parsed,
  });
}

export async function getAppSettings(studyId?: number): Promise<AppSettings> {
  const legacySettings = await getLegacyAppSettings();
  if (!studyId) {
    return legacySettings;
  }

  const studySettings = await getStudySettingsByStudyId(studyId);
  if (!studySettings) {
    return legacySettings;
  }

  return normalizeSettings({
    ...legacySettings,
    projectName: studySettings.projectName,
    exportProjectName: studySettings.exportProjectName,
    mapPrimaryPointCode: studySettings.mapPrimaryPointCode,
    surveyTargetTotal: studySettings.surveyTargetTotal,
    surveyTargetResidents: studySettings.surveyTargetResidents,
    surveyTargetVisitors: studySettings.surveyTargetVisitors,
    surveyWeeklyTargetTotal: studySettings.surveyWeeklyTargetTotal,
    surveyWeeklyTargetResidents: studySettings.surveyWeeklyTargetResidents,
    surveyWeeklyTargetVisitors: studySettings.surveyWeeklyTargetVisitors,
    quotasEnabled: studySettings.quotasEnabled,
    residentQuotaTotal: studySettings.residentQuotaTotal,
    visitorQuotaTotal: studySettings.visitorQuotaTotal,
    enabledCharts: Array.isArray(studySettings.enabledCharts) ? studySettings.enabledCharts as string[] : legacySettings.enabledCharts,
    openAiApiKey: studySettings.openAiApiKey ?? legacySettings.openAiApiKey,
  });
}

export async function updateAppSettings(input: Partial<AppSettings>, studyId?: number): Promise<AppSettings> {
  if (!studyId) {
    const current = await getLegacyAppSettings();
    const next = normalizeSettings({
      ...current,
      ...input,
    });

    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2));
    return next;
  }

  const current = await getAppSettings(studyId);
  const next = normalizeSettings({
    ...current,
    ...input,
  });

  await upsertStudySettings({
    studyId,
    projectName: next.projectName,
    exportProjectName: next.exportProjectName,
    mapPrimaryPointCode: next.mapPrimaryPointCode,
    surveyTargetTotal: next.surveyTargetTotal,
    surveyTargetResidents: next.surveyTargetResidents,
    surveyTargetVisitors: next.surveyTargetVisitors,
    surveyWeeklyTargetTotal: next.surveyWeeklyTargetTotal,
    surveyWeeklyTargetResidents: next.surveyWeeklyTargetResidents,
    surveyWeeklyTargetVisitors: next.surveyWeeklyTargetVisitors,
    quotasEnabled: next.quotasEnabled,
    residentQuotaTotal: next.residentQuotaTotal,
    visitorQuotaTotal: next.visitorQuotaTotal,
    enabledCharts: next.enabledCharts,
    openAiApiKey: next.openAiApiKey,
  });

  return next;
}
