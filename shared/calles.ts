/**
 * Catálogo de calles para la pregunta P1.1 de la encuesta de residentes.
 * 
 * - "barrio_turistico": calles del barrio turístico → seccion037 = true
 * - "otras_calles": otras calles del barrio → seccion037 = false
 */

export interface CalleItem {
  nombre: string;
  grupo: "barrio_turistico" | "otras_calles";
  seccion037: boolean;
}

/** Calles del barrio turístico (seccion037 = true) — orden alfabético */
const CALLES_BARRIO_TURISTICO: string[] = [
  "Agua",
  "Calle Romero Murube",
  "Cano y Cueto",
  "Cruces",
  "Doncellas",
  "Fabiola",
  "Gloria",
  "Jamerdana",
  "Juderia",
  "Justino de Neve",
  "López de Rueda",
  "Mariscal",
  "Mesón del Moro",
  "Mezquita",
  "Pasaje de Andreu",
  "Pasaje de Vila",
  "Paseo de Catalina de Ribera",
  "Patio de Banderas",
  "Pimienta",
  "Plaza Alfaro",
  "Plaza de la Alianza",
  "Plaza de los Venerables",
  "Plaza de Refinadores",
  "Plaza de Santa Cruz",
  "Plaza del Triunfo",
  "Plaza Dña Elvira",
  "Plaza Virgen de los Reyes",
  "Plata de Santa Marta",
  "Plazuela Marqués de Vega Inclán",
  "Reinoso",
  "Rodrigo Caro",
  "Susona",
  "Vida",
  "Ximenez de Enciso",
];

/** Otras calles del barrio (seccion037 = false) — orden alfabético */
const CALLES_OTRAS: string[] = [
  "Alemanes",
  "Almirante Lobo",
  "Alvarez Quintero",
  "Argote de Molina",
  "Avda Constitución",
  "Cabo Noval",
  "Dean Miranda",
  "Don Remondo",
  "Florentin",
  "Fray Ceferino",
  "Habana",
  "Hernando Colón",
  "Joaquin Hazañas",
  "Mariana de Pineda",
  "Matienzo",
  "Paseo de Cristina",
  "Placentines",
  "San Fernando",
  "San Gregorio",
  "San Nicolas",
  "Santander Paseo de las Delicias",
  "Santo Tomás",
];

/** Catálogo completo con metadatos */
export const CALLES: CalleItem[] = [
  ...CALLES_BARRIO_TURISTICO.map((nombre) => ({
    nombre,
    grupo: "barrio_turistico" as const,
    seccion037: true,
  })),
  ...CALLES_OTRAS.map((nombre) => ({
    nombre,
    grupo: "otras_calles" as const,
    seccion037: false,
  })),
];

/** Devuelve el flag seccion037 para una calle dada (false si no se encuentra) */
export function getSeccion037(nombreCalle: string): boolean {
  const calle = CALLES.find(
    (c) => c.nombre.toLowerCase().trim() === nombreCalle.toLowerCase().trim()
  );
  return calle?.seccion037 ?? false;
}

/** Lista de nombres de calles del barrio turístico (para el desplegable) */
export const NOMBRES_BARRIO_TURISTICO = CALLES_BARRIO_TURISTICO;

/** Lista de nombres de otras calles (para el desplegable) */
export const NOMBRES_OTRAS_CALLES = CALLES_OTRAS;
