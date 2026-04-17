/**
 * Puntos de conteo y subpuntos definitivos del proyecto IATUR - Barrio de Santa Cruz 2026
 * Basados en el PowerPoint de conteos (conteos-Copia.pptx).
 *
 * Estructura:
 *  - Cada punto principal tiene un código (ej: "01") y un nombre.
 *  - Cada subpunto tiene un código compuesto (ej: "01.01") y un nombre.
 *  - Los flujos son bidireccionales: punto principal ↔ cada subpunto.
 *
 * Puntos y subpuntos extraídos del PPTX:
 *  01. Virgen de los Reyes → 01.01 Alemanes, 01.02 D.Remondo, 01.03 Mateos Gago, 01.04 Plaza Triunfo  (8 flujos)
 *  02. Mateos Gago         → 02.01 Rodrigo Caro, 02.02 Abades, 02.03 Ángeles, 02.04 Mesón del Moro, 02.05 Fabiola   (10 flujos)
 *  03. Patio de Banderas   → 03.01 Plaza del Triunfo, 03.02 Judería                                   (4 flujos)
 *  04. Agua / Vida         → 04.01 Vida, 04.02 Callejón Susona, 04.03 Pimienta, 04.04 Justino de Neve (8 flujos)
 *  05. Plaza de Alfaro     → 05.01 López de Rueda, 05.02 Plaza Sta. Cruz, 05.03 Antonio el Bailarín, 05.04 Agua (8 flujos)
 */

export interface SurveySubPoint {
  code: string;     // ej: "01.01"
  name: string;     // ej: "Alemanes"
  fullName: string; // ej: "01.01 Alemanes"
}

export interface SurveyPoint {
  code: string;       // ej: "01"
  name: string;       // ej: "Virgen de los Reyes"
  fullName: string;   // ej: "01 Virgen de los Reyes"
  subPoints: SurveySubPoint[];
}

export const SURVEY_POINTS: SurveyPoint[] = [
  {
    code: "01",
    name: "Virgen de los Reyes",
    fullName: "01 Virgen de los Reyes",
    subPoints: [
      { code: "01.01", name: "Alemanes",      fullName: "01.01 Alemanes" },
      { code: "01.02", name: "D. Remondo",    fullName: "01.02 D. Remondo" },
      { code: "01.03", name: "Mateos Gago",   fullName: "01.03 Mateos Gago" },
      { code: "01.04", name: "Plaza Triunfo", fullName: "01.04 Plaza Triunfo" },
    ],
  },
  {
    code: "02",
    name: "Mateos Gago",
    fullName: "02 Mateos Gago",
    subPoints: [
      { code: "02.01", name: "Rodrigo Caro",  fullName: "02.01 Rodrigo Caro" },
      { code: "02.02", name: "Abades",         fullName: "02.02 Abades" },
      { code: "02.03", name: "Ángeles",        fullName: "02.03 Ángeles" },
      { code: "02.04", name: "Mesón del Moro", fullName: "02.04 Mesón del Moro" },
      { code: "02.05", name: "Fabiola",         fullName: "02.05 Fabiola" },
    ],
  },
  {
    code: "03",
    name: "Patio de Banderas",
    fullName: "03 Patio de Banderas",
    subPoints: [
      { code: "03.01", name: "Plaza del Triunfo", fullName: "03.01 Plaza del Triunfo" },
      { code: "03.02", name: "Judería",            fullName: "03.02 Judería" },
    ],
  },
  {
    code: "04",
    name: "Agua / Vida",
    fullName: "04 Agua / Vida",
    subPoints: [
      { code: "04.01", name: "Vida",             fullName: "04.01 Vida" },
      { code: "04.02", name: "Callejón Susona",  fullName: "04.02 Callejón Susona" },
      { code: "04.03", name: "Pimienta",         fullName: "04.03 Pimienta" },
      { code: "04.04", name: "Justino de Neve",  fullName: "04.04 Justino de Neve" },
    ],
  },
  {
    code: "05",
    name: "Plaza de Alfaro",
    fullName: "05 Plaza de Alfaro",
    subPoints: [
      { code: "05.01", name: "López de Rueda",       fullName: "05.01 López de Rueda" },
      { code: "05.02", name: "Plaza Sta. Cruz",       fullName: "05.02 Plaza Sta. Cruz" },
      { code: "05.03", name: "Antonio el Bailarín",  fullName: "05.03 Antonio el Bailarín" },
      { code: "05.04", name: "Agua",                  fullName: "05.04 Agua" },
    ],
  },
];

/** Lista plana de nombres de puntos principales (para compatibilidad con código anterior) */
export const SURVEY_POINT_NAMES: string[] = SURVEY_POINTS.map((p) => p.fullName);

/** Obtiene un punto por su código */
export function getSurveyPointByCode(code: string): SurveyPoint | undefined {
  return SURVEY_POINTS.find((p) => p.code === code);
}

/** Obtiene un punto por su nombre completo */
export function getSurveyPointByName(name: string): SurveyPoint | undefined {
  return SURVEY_POINTS.find((p) => p.fullName === name || p.name === name);
}

/**
 * Genera los flujos bidireccionales para un punto de conteo.
 * Cada flujo es: "PUNTO_PRINCIPAL → SUBPUNTO" y "SUBPUNTO → PUNTO_PRINCIPAL"
 * Resultado: 2 flujos por subpunto (ej: 4 subpuntos → 8 flujos)
 */
export function getFlowsForPoint(point: SurveyPoint): { label: string; from: string; to: string; fromCode: string; toCode: string }[] {
  const flows: { label: string; from: string; to: string; fromCode: string; toCode: string }[] = [];
  for (const sub of point.subPoints) {
    flows.push({
      label: `${point.fullName} → ${sub.fullName}`,
      from: point.fullName,
      to: sub.fullName,
      fromCode: point.code,
      toCode: sub.code,
    });
    flows.push({
      label: `${sub.fullName} → ${point.fullName}`,
      from: sub.fullName,
      to: point.fullName,
      fromCode: sub.code,
      toCode: point.code,
    });
  }
  return flows;
}

/**
 * Genera TODOS los flujos de todos los puntos
 */
export function getAllFlows(): { label: string; from: string; to: string; pointCode: string }[] {
  const all: { label: string; from: string; to: string; pointCode: string }[] = [];
  for (const point of SURVEY_POINTS) {
    for (const flow of getFlowsForPoint(point)) {
      all.push({ ...flow, pointCode: point.code });
    }
  }
  return all;
}
