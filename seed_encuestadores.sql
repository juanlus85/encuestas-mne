-- ============================================================
-- SEED: Encuestadores y Turnos — Encuestas Sevilla FeelingLAND
-- Generado: 2026-04-11
-- Contraseña por defecto para todos: Iatur2026!
-- ============================================================
-- RESUMEN DE ENCUESTADORES:
--   ENC-01  ElenaT    → Elena de la Torre Monge         → residentes
--   ENC-02  Rocio     → Rocío Blanco Guzmán             → visitantes
--   ENC-03  ElenaG    → Elena González                  → residentes
--   ENC-04  Paula     → María Paula Caballero Pérez     → visitantes
--   ENC-05  Estefany  → Estefany Grenier Agula          → visitantes
--   ENC-06  Fran      → Francisco Javier Pedreño Serrano → ambos (sustituto)
-- ============================================================

-- ─── 1. USUARIOS ─────────────────────────────────────────────────────────────
-- openId debe ser único; usamos un valor local fijo para cada encuestador.
-- Si ya existen usuarios con ese openId, se actualizan sus datos.

INSERT INTO users (openId, name, loginMethod, role, username, passwordHash, identifier, surveyTypeAssigned, isActive)
VALUES
  -- ENC-01: Elena de la Torre Monge → solo residentes
  ('local-enc-01', 'Elena de la Torre Monge',           'local', 'encuestador',
   'ElenaT',    '$2b$12$0XQCmghZOlrchB20VD62OOmtCuglTMWMecdfqseihELH7MGUEvVwm',
   'ENC-01', 'residentes', true),

  -- ENC-02: Rocío Blanco Guzmán → solo visitantes
  ('local-enc-02', 'Rocío Blanco Guzmán',               'local', 'encuestador',
   'Rocio',     '$2b$12$2YRYd63wQoqrd/MFmsXzFufk/aHY8Mu3CJtjnetxJNml9aQUNX5gK',
   'ENC-02', 'visitantes', true),

  -- ENC-03: Elena González → solo residentes
  ('local-enc-03', 'Elena González',                    'local', 'encuestador',
   'ElenaG',    '$2b$12$fT0zI3NeKwywcnErQU27euZ9LaCHuWxkX6ohEE5DIyLt8WW.pJoKu',
   'ENC-03', 'residentes', true),

  -- ENC-04: María Paula Caballero Pérez → solo visitantes
  ('local-enc-04', 'María Paula Caballero Pérez',       'local', 'encuestador',
   'Paula',     '$2b$12$GzCTTQSdgV1F4.Opu11Nu.KCZlo/tpERzsh/noaMxJPky0tXfW4fu',
   'ENC-04', 'visitantes', true),

  -- ENC-05: Estefany Grenier Agula → solo visitantes
  ('local-enc-05', 'Estefany Grenier Agula',            'local', 'encuestador',
   'Estefany',  '$2b$12$LZ8R3UWoF7KfoHDRf9o5mu7Qn3S/XCweOV.aW5AM2kPtZGxOspK1O',
   'ENC-05', 'visitantes', true),

  -- ENC-06: Francisco Javier Pedreño Serrano → ambos (sustituto puntual)
  ('local-enc-06', 'Francisco Javier Pedreño Serrano',  'local', 'encuestador',
   'Fran',      '$2b$12$T.7IphLx5XUxJCQqDxpLneDG.B2p6KZhrHmjCEs78E8KFyFAnAdBm',
   'ENC-06', 'ambos', true)

ON DUPLICATE KEY UPDATE
  name               = VALUES(name),
  username           = VALUES(username),
  passwordHash       = VALUES(passwordHash),
  identifier         = VALUES(identifier),
  surveyTypeAssigned = VALUES(surveyTypeAssigned),
  isActive           = true;


-- ─── 2. TURNOS ───────────────────────────────────────────────────────────────
-- Columnas: (encuestadorId, shiftDate, startTime, endTime, surveyPoint, surveyType, notes)
-- Puntos tal como aparecen en la app:
--   "02 Mateos Gago"         "03 Agua/Vida"
--   "04 Plaza Alfaro"        "01 Virgen de los Reyes"
--   "05 Patio de Banderas"

-- ── SEMANA 1 ──────────────────────────────────────────────────────────────────

-- 16/04/2026 Jueves 09:30-12:00
INSERT INTO shifts (encuestadorId, shiftDate, startTime, endTime, surveyPoint, surveyType, notes) VALUES
  ((SELECT id FROM users WHERE username='ElenaT'),    '2026-04-16','09:30','12:00','02 Mateos Gago',         'residentes', NULL),
  ((SELECT id FROM users WHERE username='Rocio'),     '2026-04-16','09:30','12:00','03 Agua/Vida',           'visitantes', NULL),
  ((SELECT id FROM users WHERE username='ElenaG'),    '2026-04-16','09:30','12:00','04 Plaza Alfaro',        'residentes', NULL),
  ((SELECT id FROM users WHERE username='Paula'),     '2026-04-16','09:30','12:00','01 Virgen de los Reyes', 'visitantes', NULL),
  ((SELECT id FROM users WHERE username='Estefany'),  '2026-04-16','09:30','12:00','05 Patio de Banderas',   'visitantes', NULL);

-- 19/04/2026 Domingo 12:00-14:30
INSERT INTO shifts (encuestadorId, shiftDate, startTime, endTime, surveyPoint, surveyType, notes) VALUES
  ((SELECT id FROM users WHERE username='ElenaT'),    '2026-04-19','12:00','14:30','05 Patio de Banderas',   'residentes', NULL),
  ((SELECT id FROM users WHERE username='Rocio'),     '2026-04-19','12:00','14:30','02 Mateos Gago',         'visitantes', NULL),
  ((SELECT id FROM users WHERE username='ElenaG'),    '2026-04-19','12:00','14:30','01 Virgen de los Reyes', 'residentes', NULL),
  ((SELECT id FROM users WHERE username='Paula'),     '2026-04-19','12:00','14:30','04 Plaza Alfaro',        'visitantes', NULL),
  ((SELECT id FROM users WHERE username='Estefany'),  '2026-04-19','12:00','14:30','03 Agua/Vida',           'visitantes', NULL);

-- ── SEMANA 3 ──────────────────────────────────────────────────────────────────

-- 27/04/2026 Lunes 16:00-18:30
INSERT INTO shifts (encuestadorId, shiftDate, startTime, endTime, surveyPoint, surveyType, notes) VALUES
  ((SELECT id FROM users WHERE username='ElenaT'),    '2026-04-27','16:00','18:30','02 Mateos Gago',         'residentes', NULL),
  ((SELECT id FROM users WHERE username='Rocio'),     '2026-04-27','16:00','18:30','03 Agua/Vida',           'visitantes', NULL),
  ((SELECT id FROM users WHERE username='ElenaG'),    '2026-04-27','16:00','18:30','04 Plaza Alfaro',        'residentes', NULL),
  ((SELECT id FROM users WHERE username='Paula'),     '2026-04-27','16:00','18:30','01 Virgen de los Reyes', 'visitantes', NULL),
  ((SELECT id FROM users WHERE username='Estefany'),  '2026-04-27','16:00','18:30','05 Patio de Banderas',   'visitantes', NULL);

-- 29/04/2026 Miércoles 12:00-14:30
INSERT INTO shifts (encuestadorId, shiftDate, startTime, endTime, surveyPoint, surveyType, notes) VALUES
  ((SELECT id FROM users WHERE username='ElenaT'),    '2026-04-29','12:00','14:30','05 Patio de Banderas',   'residentes', NULL),
  ((SELECT id FROM users WHERE username='Rocio'),     '2026-04-29','12:00','14:30','02 Mateos Gago',         'visitantes', NULL),
  ((SELECT id FROM users WHERE username='ElenaG'),    '2026-04-29','12:00','14:30','01 Virgen de los Reyes', 'residentes', NULL),
  ((SELECT id FROM users WHERE username='Paula'),     '2026-04-29','12:00','14:30','04 Plaza Alfaro',        'visitantes', NULL),
  ((SELECT id FROM users WHERE username='Estefany'),  '2026-04-29','12:00','14:30','03 Agua/Vida',           'visitantes', NULL);

-- 02/05/2026 Sábado 18:30-21:00
INSERT INTO shifts (encuestadorId, shiftDate, startTime, endTime, surveyPoint, surveyType, notes) VALUES
  ((SELECT id FROM users WHERE username='ElenaT'),    '2026-05-02','18:30','21:00','02 Mateos Gago',         'residentes', NULL),
  ((SELECT id FROM users WHERE username='Rocio'),     '2026-05-02','18:30','21:00','03 Agua/Vida',           'visitantes', NULL),
  ((SELECT id FROM users WHERE username='ElenaG'),    '2026-05-02','18:30','21:00','04 Plaza Alfaro',        'residentes', NULL),
  ((SELECT id FROM users WHERE username='Paula'),     '2026-05-02','18:30','21:00','01 Virgen de los Reyes', 'visitantes', NULL),
  ((SELECT id FROM users WHERE username='Estefany'),  '2026-05-02','18:30','21:00','05 Patio de Banderas',   'visitantes', NULL);

-- ── SEMANA 4 ──────────────────────────────────────────────────────────────────

-- 05/05/2026 Martes 16:00-18:30
INSERT INTO shifts (encuestadorId, shiftDate, startTime, endTime, surveyPoint, surveyType, notes) VALUES
  ((SELECT id FROM users WHERE username='ElenaT'),    '2026-05-05','16:00','18:30','05 Patio de Banderas',   'residentes', NULL),
  ((SELECT id FROM users WHERE username='Rocio'),     '2026-05-05','16:00','18:30','02 Mateos Gago',         'visitantes', NULL),
  ((SELECT id FROM users WHERE username='ElenaG'),    '2026-05-05','16:00','18:30','01 Virgen de los Reyes', 'residentes', NULL),
  ((SELECT id FROM users WHERE username='Paula'),     '2026-05-05','16:00','18:30','04 Plaza Alfaro',        'visitantes', NULL),
  ((SELECT id FROM users WHERE username='Estefany'),  '2026-05-05','16:00','18:30','03 Agua/Vida',           'visitantes', NULL);

-- 08/05/2026 Viernes 18:30-21:00
INSERT INTO shifts (encuestadorId, shiftDate, startTime, endTime, surveyPoint, surveyType, notes) VALUES
  ((SELECT id FROM users WHERE username='ElenaT'),    '2026-05-08','18:30','21:00','02 Mateos Gago',         'residentes', NULL),
  ((SELECT id FROM users WHERE username='Rocio'),     '2026-05-08','18:30','21:00','03 Agua/Vida',           'visitantes', NULL),
  ((SELECT id FROM users WHERE username='ElenaG'),    '2026-05-08','18:30','21:00','04 Plaza Alfaro',        'residentes', NULL),
  ((SELECT id FROM users WHERE username='Paula'),     '2026-05-08','18:30','21:00','01 Virgen de los Reyes', 'visitantes', NULL),
  ((SELECT id FROM users WHERE username='Estefany'),  '2026-05-08','18:30','21:00','05 Patio de Banderas',   'visitantes', NULL);

-- ── SEMANA 5 ──────────────────────────────────────────────────────────────────

-- 11/05/2026 Lunes 09:30-12:00
-- Técnico 4 (Paula) sustituida por Francisco Javier Pedreño Serrano en Plaza Alfaro
INSERT INTO shifts (encuestadorId, shiftDate, startTime, endTime, surveyPoint, surveyType, notes) VALUES
  ((SELECT id FROM users WHERE username='ElenaT'),    '2026-05-11','09:30','12:00','05 Patio de Banderas',   'residentes', NULL),
  ((SELECT id FROM users WHERE username='Rocio'),     '2026-05-11','09:30','12:00','02 Mateos Gago',         'visitantes', NULL),
  ((SELECT id FROM users WHERE username='ElenaG'),    '2026-05-11','09:30','12:00','01 Virgen de los Reyes', 'residentes', NULL),
  ((SELECT id FROM users WHERE username='Fran'),      '2026-05-11','09:30','12:00','04 Plaza Alfaro',        'visitantes', 'Sustitución de Paula'),
  ((SELECT id FROM users WHERE username='Estefany'),  '2026-05-11','09:30','12:00','03 Agua/Vida',           'visitantes', NULL);

-- 14/05/2026 Jueves 18:30-21:00
INSERT INTO shifts (encuestadorId, shiftDate, startTime, endTime, surveyPoint, surveyType, notes) VALUES
  ((SELECT id FROM users WHERE username='ElenaT'),    '2026-05-14','18:30','21:00','02 Mateos Gago',         'residentes', NULL),
  ((SELECT id FROM users WHERE username='Rocio'),     '2026-05-14','18:30','21:00','03 Agua/Vida',           'visitantes', NULL),
  ((SELECT id FROM users WHERE username='ElenaG'),    '2026-05-14','18:30','21:00','04 Plaza Alfaro',        'residentes', NULL),
  ((SELECT id FROM users WHERE username='Paula'),     '2026-05-14','18:30','21:00','01 Virgen de los Reyes', 'visitantes', NULL),
  ((SELECT id FROM users WHERE username='Estefany'),  '2026-05-14','18:30','21:00','05 Patio de Banderas',   'visitantes', NULL);

-- ── SEMANA 6 ──────────────────────────────────────────────────────────────────

-- 19/05/2026 Martes 12:00-14:30
INSERT INTO shifts (encuestadorId, shiftDate, startTime, endTime, surveyPoint, surveyType, notes) VALUES
  ((SELECT id FROM users WHERE username='ElenaT'),    '2026-05-19','12:00','14:30','05 Patio de Banderas',   'residentes', NULL),
  ((SELECT id FROM users WHERE username='Rocio'),     '2026-05-19','12:00','14:30','02 Mateos Gago',         'visitantes', NULL),
  ((SELECT id FROM users WHERE username='ElenaG'),    '2026-05-19','12:00','14:30','01 Virgen de los Reyes', 'residentes', NULL),
  ((SELECT id FROM users WHERE username='Paula'),     '2026-05-19','12:00','14:30','04 Plaza Alfaro',        'visitantes', NULL),
  ((SELECT id FROM users WHERE username='Estefany'),  '2026-05-19','12:00','14:30','03 Agua/Vida',           'visitantes', NULL);

-- 24/05/2026 Domingo 09:30-12:00
-- Técnico 3 (ElenaG) sustituida por Francisco Javier Pedreño Serrano en Plaza Alfaro
INSERT INTO shifts (encuestadorId, shiftDate, startTime, endTime, surveyPoint, surveyType, notes) VALUES
  ((SELECT id FROM users WHERE username='ElenaT'),    '2026-05-24','09:30','12:00','02 Mateos Gago',         'residentes', NULL),
  ((SELECT id FROM users WHERE username='Rocio'),     '2026-05-24','09:30','12:00','03 Agua/Vida',           'visitantes', NULL),
  ((SELECT id FROM users WHERE username='Fran'),      '2026-05-24','09:30','12:00','04 Plaza Alfaro',        'residentes', 'Sustitución de ElenaG'),
  ((SELECT id FROM users WHERE username='Paula'),     '2026-05-24','09:30','12:00','01 Virgen de los Reyes', 'visitantes', NULL),
  ((SELECT id FROM users WHERE username='Estefany'),  '2026-05-24','09:30','12:00','05 Patio de Banderas',   'visitantes', NULL);

-- ── SEMANA 7 ──────────────────────────────────────────────────────────────────

-- 27/05/2026 Miércoles 16:00-18:30
INSERT INTO shifts (encuestadorId, shiftDate, startTime, endTime, surveyPoint, surveyType, notes) VALUES
  ((SELECT id FROM users WHERE username='ElenaT'),    '2026-05-27','16:00','18:30','05 Patio de Banderas',   'residentes', NULL),
  ((SELECT id FROM users WHERE username='Rocio'),     '2026-05-27','16:00','18:30','02 Mateos Gago',         'visitantes', NULL),
  ((SELECT id FROM users WHERE username='ElenaG'),    '2026-05-27','16:00','18:30','01 Virgen de los Reyes', 'residentes', NULL),
  ((SELECT id FROM users WHERE username='Paula'),     '2026-05-27','16:00','18:30','04 Plaza Alfaro',        'visitantes', NULL),
  ((SELECT id FROM users WHERE username='Estefany'),  '2026-05-27','16:00','18:30','03 Agua/Vida',           'visitantes', NULL);

-- 29/05/2026 Viernes 12:00-14:30
INSERT INTO shifts (encuestadorId, shiftDate, startTime, endTime, surveyPoint, surveyType, notes) VALUES
  ((SELECT id FROM users WHERE username='ElenaT'),    '2026-05-29','12:00','14:30','02 Mateos Gago',         'residentes', NULL),
  ((SELECT id FROM users WHERE username='Rocio'),     '2026-05-29','12:00','14:30','03 Agua/Vida',           'visitantes', NULL),
  ((SELECT id FROM users WHERE username='ElenaG'),    '2026-05-29','12:00','14:30','04 Plaza Alfaro',        'residentes', NULL),
  ((SELECT id FROM users WHERE username='Paula'),     '2026-05-29','12:00','14:30','01 Virgen de los Reyes', 'visitantes', NULL),
  ((SELECT id FROM users WHERE username='Estefany'),  '2026-05-29','12:00','14:30','05 Patio de Banderas',   'visitantes', NULL);

-- ── SEMANA 8 ──────────────────────────────────────────────────────────────────

-- 01/06/2026 Lunes 18:30-21:00
INSERT INTO shifts (encuestadorId, shiftDate, startTime, endTime, surveyPoint, surveyType, notes) VALUES
  ((SELECT id FROM users WHERE username='ElenaT'),    '2026-06-01','18:30','21:00','05 Patio de Banderas',   'residentes', NULL),
  ((SELECT id FROM users WHERE username='Rocio'),     '2026-06-01','18:30','21:00','02 Mateos Gago',         'visitantes', NULL),
  ((SELECT id FROM users WHERE username='ElenaG'),    '2026-06-01','18:30','21:00','01 Virgen de los Reyes', 'residentes', NULL),
  ((SELECT id FROM users WHERE username='Paula'),     '2026-06-01','18:30','21:00','04 Plaza Alfaro',        'visitantes', NULL),
  ((SELECT id FROM users WHERE username='Estefany'),  '2026-06-01','18:30','21:00','03 Agua/Vida',           'visitantes', NULL);

-- 06/06/2026 Sábado 09:30-12:00
INSERT INTO shifts (encuestadorId, shiftDate, startTime, endTime, surveyPoint, surveyType, notes) VALUES
  ((SELECT id FROM users WHERE username='ElenaT'),    '2026-06-06','09:30','12:00','02 Mateos Gago',         'residentes', NULL),
  ((SELECT id FROM users WHERE username='Rocio'),     '2026-06-06','09:30','12:00','03 Agua/Vida',           'visitantes', NULL),
  ((SELECT id FROM users WHERE username='ElenaG'),    '2026-06-06','09:30','12:00','04 Plaza Alfaro',        'residentes', NULL),
  ((SELECT id FROM users WHERE username='Paula'),     '2026-06-06','09:30','12:00','01 Virgen de los Reyes', 'visitantes', NULL),
  ((SELECT id FROM users WHERE username='Estefany'),  '2026-06-06','09:30','12:00','05 Patio de Banderas',   'visitantes', NULL);

-- ─── FIN DEL SCRIPT ───────────────────────────────────────────────────────────
-- Contraseña por defecto para todos: Iatur2026!
-- Se recomienda cambiar las contraseñas tras el primer acceso desde el panel de Usuarios.
