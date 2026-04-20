-- =============================================================
-- ACTUALIZACIÓN TEMPLATE RESIDENTES (templateId = 60002) EN VPS
-- v2 - sin columna updatedAt
-- Fecha: 19/04/2026
-- =============================================================

START TRANSACTION;

-- PASO 1: Desplazar todos los orders >= 6 hacia arriba para hacer hueco
UPDATE questions SET `order` = `order` + 4
WHERE templateId = 60002 AND `order` >= 6
ORDER BY `order` DESC;

-- PASO 2: Actualizar P1 (id 60031) con el texto correcto
UPDATE questions SET
  text = 'P1. ¿Es residente de Sevilla capital? (Si NO → fin de encuesta)',
  type = 'yes_no',
  isRequired = 1
WHERE id = 60031;

-- PASO 3: Actualizar P1.1 (id 60032) con el texto correcto y order 7
UPDATE questions SET
  `order` = 7,
  text = 'P1.1. ¿En qué calle del centro histórico reside? (Seleccione del listado)',
  type = 'text',
  isRequired = 0
WHERE id = 60032;

-- PASO 4: Insertar P1.0 (¿Vive en el centro histórico?) en order 6
INSERT INTO questions (templateId, `order`, text, type, options, isRequired, createdAt)
VALUES (
  60002,
  6,
  'P1.0. ¿Vive en el centro histórico?',
  'yes_no',
  NULL,
  1,
  NOW()
);

-- PASO 5: Insertar P1.2 (campo texto libre para calle no listada) en order 8
INSERT INTO questions (templateId, `order`, text, type, options, isRequired, createdAt)
VALUES (
  60002,
  8,
  'P1.2. ¿En qué calle?',
  'text',
  NULL,
  0,
  NOW()
);

-- PASO 6: Insertar P1.3 (¿Trabaja en el centro histórico?) en order 9
INSERT INTO questions (templateId, `order`, text, type, options, isRequired, createdAt)
VALUES (
  60002,
  9,
  'P1.3. ¿Trabaja en el centro histórico?',
  'yes_no',
  NULL,
  1,
  NOW()
);

-- VERIFICACIÓN: Ver las primeras 12 preguntas del template para confirmar
SELECT id, `order`, text, type, isRequired
FROM questions
WHERE templateId = 60002
ORDER BY `order`
LIMIT 12;

COMMIT;
