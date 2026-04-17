/**
 * Cuotas del proyecto IATUR - Barrio de Santa Cruz 2026
 * Basadas en el diseño muestral del proyecto.
 */

// ─── VISITANTES ───────────────────────────────────────────────────────────────
// N = 450 encuestas totales

export const VISITANTES_QUOTAS = {
  total: 450,

  // Por género
  genero: {
    hombre: { target: 225, label: "Hombres" },
    mujer: { target: 225, label: "Mujeres" },
  },

  // Por procedencia
  procedencia: {
    sevilla: { target: 45, label: "Provincia de Sevilla" },
    nacional: { target: 203, label: "Nacionales (resto España)" },
    extranjero: { target: 202, label: "Extranjeros" },
  },

  // Por punto de encuesta (90 por punto)
  puntos: {
    "01 Virgen de los Reyes": { target: 90, label: "01 Virgen de los Reyes" },
    "02 Mateos Gago": { target: 90, label: "02 Mateos Gago" },
    "03 Patio de Banderas": { target: 90, label: "03 Patio de Banderas" },
    "04 Agua / Vida": { target: 90, label: "04 Agua / Vida" },
    "05 Plaza Alfaro": { target: 90, label: "05 Plaza Alfaro" },
  },
} as const;

// ─── RESIDENTES ───────────────────────────────────────────────────────────────
// N = 300 encuestas totales
// Ampliado a todos los sevillanos (no solo barrio)

export const RESIDENTES_QUOTAS = {
  total: 300,

  // Por género
  genero: {
    mujer: { target: 162, label: "Mujeres" },
    hombre: { target: 138, label: "Hombres" },
  },

  // Por grupos de edad
  edad: {
    "18_44": { target: 95, label: "18–44 años", values: ["18_29", "30_44"] },
    "45_65": { target: 101, label: "45–65 años", values: ["45_64"] },
    "65_mas": { target: 104, label: "+65 años", values: ["65_75", "76_mas"] },
  },

  // Por vínculo laboral con turismo
  vinculo: {
    con_vinculo: { target: 90, label: "Con vínculo laboral turístico (30%)" },
    sin_vinculo: { target: 210, label: "Sin vínculo laboral turístico (70%)" },
  },

  // Por territorio (nuevo: residentes del centro histórico vs. resto de Sevilla)
  territorio: {
    centro_historico: { target: 210, label: "Residentes del centro histórico", code: 1 },
    resto_sevilla: { target: 90, label: "Resto de Sevilla", code: 2 },
  },
} as const;

// ─── IDs de preguntas clave ───────────────────────────────────────────────────
// Visitantes (templateId 60001)
export const VISITANTES_QUESTION_IDS = {
  pais: 60007,       // P1. ¿Cuál es su país de residencia? (España/Otro)
  paisEsp: 60008,    // P1b. Si España → ¿Provincia/Ciudad?
  edad: 60011,       // P4. ¿Cuál es su rango de edad?
  genero: 60012,     // P4b. Género
};

// Residentes (templateId 60002)
export const RESIDENTES_QUESTION_IDS = {
  viveCentro: 60029,  // P1. ¿Vive en el centro histórico? (si=1, no=2)
  calle: 60031,       // P1.1 ¿En qué calle? (solo si vive en centro histórico)
  trabajaCentro: 60030, // P1.2 ¿Trabaja en el centro histórico? (si=1, no=2)
  vinculo: 60034,    // P3. ¿Percibe beneficios económicos del sector turístico?
  genero: 60035,     // P4. Género
  edad: 60036,       // P5. Edad
};

// ─── Helpers de clasificación ─────────────────────────────────────────────────

/**
 * Clasifica la procedencia de un visitante según su respuesta a P1 y P1b.
 * - "sevilla": país=España y provincia=Sevilla
 * - "nacional": país=España y provincia≠Sevilla
 * - "extranjero": país≠España
 */
export function clasificarProcedencia(pais: string, provinciaEsp?: string): "sevilla" | "nacional" | "extranjero" {
  if (pais !== "espana") return "extranjero";
  const prov = (provinciaEsp ?? "").toLowerCase();
  if (prov.includes("sevilla")) return "sevilla";
  return "nacional";
}

/**
 * Clasifica la edad de un residente en el grupo de cuota.
 */
export function clasificarEdadResidente(edadValue: string): "18_44" | "45_65" | "65_mas" | null {
  if (["18_29", "30_44"].includes(edadValue)) return "18_44";
  if (["45_64"].includes(edadValue)) return "45_65";
  if (["65_75", "76_mas"].includes(edadValue)) return "65_mas";
  return null;
}

/**
 * Determina si un residente tiene vínculo laboral con turismo.
 */
export function tieneVinculoTurismo(vinculoValue: string): boolean {
  return vinculoValue === "si_yo" || vinculoValue === "si_otro";
}

/**
 * Clasifica el territorio de un residente.
 * - "centro_historico": vive en el centro histórico (código 1)
 * - "resto_sevilla": vive en el resto de Sevilla (código 2)
 * Acepta tanto el valor de texto ("si"/"no") como el código numérico ("1"/"2").
 */
export function clasificarTerritorioResidente(viveCentroValue: string): "centro_historico" | "resto_sevilla" | null {
  const v = viveCentroValue?.toLowerCase?.()?.trim?.() ?? "";
  if (v === "1" || v === "si" || v === "sí") return "centro_historico";
  if (v === "2" || v === "no") return "resto_sevilla";
  return null;
}
