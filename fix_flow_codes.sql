-- ─────────────────────────────────────────────────────────────────────────────
-- Corrección de flowOrigin y flowDestination en pedestrian_passes
-- 
-- Problema: los valores guardados son nombres completos como "02 Mateos Gago"
-- en lugar de solo el código "02", o "02.02 Abades" en lugar de "02.02".
--
-- Solución: extraer el prefijo numérico antes del primer espacio.
-- El patrón es siempre: "NN nombre" o "NN.NN nombre"
--
-- SUBSTRING_INDEX(campo, ' ', 1) extrae todo lo que hay antes del primer espacio.
-- ─────────────────────────────────────────────────────────────────────────────

-- Ver cuántos registros tienen flowOrigin con nombre completo (contiene espacio)
SELECT COUNT(*) AS registros_a_corregir
FROM pedestrian_passes
WHERE flowOrigin IS NOT NULL
  AND flowOrigin LIKE '% %';

-- Ver los valores distintos antes de corregir
SELECT DISTINCT flowOrigin, SUBSTRING_INDEX(flowOrigin, ' ', 1) AS codigo_extraido
FROM pedestrian_passes
WHERE flowOrigin IS NOT NULL AND flowOrigin LIKE '% %'
ORDER BY flowOrigin;

SELECT DISTINCT flowDestination, SUBSTRING_INDEX(flowDestination, ' ', 1) AS codigo_extraido
FROM pedestrian_passes
WHERE flowDestination IS NOT NULL AND flowDestination LIKE '% %'
ORDER BY flowDestination;

-- ─── CORRECCIÓN ───────────────────────────────────────────────────────────────
-- Ejecutar solo si los valores de arriba son correctos

UPDATE pedestrian_passes
SET flowOrigin = SUBSTRING_INDEX(flowOrigin, ' ', 1)
WHERE flowOrigin IS NOT NULL
  AND flowOrigin LIKE '% %';

UPDATE pedestrian_passes
SET flowDestination = SUBSTRING_INDEX(flowDestination, ' ', 1)
WHERE flowDestination IS NOT NULL
  AND flowDestination LIKE '% %';

-- Verificar resultado
SELECT DISTINCT flowOrigin, flowDestination
FROM pedestrian_passes
WHERE flowOrigin IS NOT NULL OR flowDestination IS NOT NULL
ORDER BY flowOrigin, flowDestination;
