import fs from "node:fs/promises";
import path from "node:path";

export interface AppSettings {
  mapPrimaryPointCode: string | null;
}

const STORE_PATH = path.resolve(import.meta.dirname, "..", "data", "app-settings.json");

const DEFAULT_SETTINGS: AppSettings = {
  mapPrimaryPointCode: "01",
};

async function ensureStore() {
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2));
  }
}

export async function getAppSettings(): Promise<AppSettings> {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  const parsed = JSON.parse(raw) as Partial<AppSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    mapPrimaryPointCode: parsed.mapPrimaryPointCode ?? DEFAULT_SETTINGS.mapPrimaryPointCode,
  };
}

export async function updateAppSettings(input: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const next: AppSettings = {
    ...current,
    ...input,
    mapPrimaryPointCode: input.mapPrimaryPointCode === undefined ? current.mapPrimaryPointCode : input.mapPrimaryPointCode,
  };

  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2));
  return next;
}
