const DEFAULT_MAP_CENTER = { lat: 37.3861, lng: -5.9915 };

function extractPointCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{2})/);
  return match?.[1] ?? null;
}

export function resolveConfiguredMapCenter<T extends { latitude?: string | number | null; longitude?: string | number | null; surveyPoint?: string | null; surveyPointCode?: string | null }>(
  items: T[],
  preferredPointCode?: string | null,
  fallback = DEFAULT_MAP_CENTER,
) {
  const validItems = items.filter((item) => item.latitude != null && item.longitude != null);
  if (validItems.length === 0) return fallback;

  const matchingItems = preferredPointCode
    ? validItems.filter((item) => {
        const codeFromField = extractPointCode(item.surveyPointCode ?? null);
        const codeFromLabel = extractPointCode(item.surveyPoint ?? null);
        return codeFromField === preferredPointCode || codeFromLabel === preferredPointCode;
      })
    : [];

  const source = matchingItems.length > 0 ? matchingItems : validItems;

  const total = source.reduce(
    (acc, item) => ({
      lat: acc.lat + Number(item.latitude),
      lng: acc.lng + Number(item.longitude),
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: total.lat / source.length,
    lng: total.lng / source.length,
  };
}

export { DEFAULT_MAP_CENTER };
