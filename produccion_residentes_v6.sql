-- ============================================================
-- MIGRACIÓN PRODUCCIÓN: Encuesta Residentes v6
-- Cambios:
--   1. P1 cambia de "¿Reside habitualmente?" a "¿Vive en el centro histórico?"
--   2. P1.1 mantiene el desplegable de calles (solo si P1=Sí)
--   3. Nueva P1.2 "¿Trabaja en el centro histórico?" (order 7)
--   4. Desplazar orders 7→8, 8→9, ... para hacer hueco a P1.2
--   5. Cuotas: centro histórico 210, resto Sevilla 90
--   6. seccion037: cambiar de boolean a int (1=centro histórico, 2=resto)
-- ============================================================

-- PASO 1: Actualizar el campo seccion037 de boolean a int en producción
ALTER TABLE `survey_responses`
  MODIFY COLUMN `seccion037` int DEFAULT 0;

ALTER TABLE `survey_responses_flat`
  MODIFY COLUMN `seccion037` int DEFAULT 0;

-- PASO 2: Obtener el templateId de la encuesta de residentes
-- (Ejecuta primero este SELECT para obtener el ID y usarlo en los pasos siguientes)
SELECT id, name, type FROM survey_templates WHERE type = 'residentes';

-- PASO 3: Desplazar orders 7 en adelante para hacer hueco a P1.2
-- Sustituye {TEMPLATE_ID} por el ID obtenido en el paso anterior
UPDATE questions
  SET `order` = `order` + 1
  WHERE templateId = {TEMPLATE_ID}
    AND `order` >= 7
  ORDER BY `order` DESC;

-- PASO 4: Actualizar P1 (order 5) — cambiar texto
UPDATE questions
  SET text = 'P1. ¿Vive en el centro histórico de Sevilla? (Si NO → continúa con P1.2)',
      textEn = 'P1. Do you live in the historic centre of Seville? (If NO → continue with P1.2)',
      options = '[{"value":"si","label":"Sí / Yes"},{"value":"no","label":"No"}]'
  WHERE templateId = {TEMPLATE_ID} AND `order` = 5;

-- PASO 5: Actualizar P1.1 (order 6) — mantener desplegable de calles
UPDATE questions
  SET text = 'P1.1. ¿En qué calle reside? (Solo si vive en el centro histórico)',
      textEn = 'P1.1. Which street do you live on? (Only if you live in the historic centre)'
  WHERE templateId = {TEMPLATE_ID} AND `order` = 6;

-- PASO 6: Insertar nueva P1.2 (order 7) — ¿Trabaja en el centro histórico?
INSERT INTO questions (templateId, `order`, type, text, textEn, options, isRequired, requiresPhoto)
VALUES (
  {TEMPLATE_ID},
  7,
  'yes_no',
  'P1.2. ¿Trabaja en el centro histórico de Sevilla?',
  'P1.2. Do you work in the historic centre of Seville?',
  '[{"value":"si","label":"Sí / Yes"},{"value":"no","label":"No"}]',
  1,
  0
);

-- PASO 7: Actualizar cuotas en survey_templates
UPDATE survey_templates
  SET description = 'Cuota: 210 residentes centro histórico + 90 resto de Sevilla = 300 total',
      targetCount = 300
  WHERE id = {TEMPLATE_ID};

-- PASO 8: Verificar el resultado
SELECT `order`, type, text FROM questions
  WHERE templateId = {TEMPLATE_ID}
  ORDER BY `order`
  LIMIT 12;
