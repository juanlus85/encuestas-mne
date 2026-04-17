import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Datos exactos de la imagen del error
const answers = [
  {questionId:90005,answer:'si'},{questionId:90006,answer:'si'},{questionId:90007,answer:'Cruces'},
  {questionId:90009,answer:'si'},{questionId:90010,answer:'1_5'},{questionId:90011,answer:'si_yo'},
  {questionId:90012,answer:'hombre'},{questionId:90013,answer:'30_44'},{questionId:90014,answer:'si_yo'},
  {questionId:90015,answer:'ns'},{questionId:90016,answer:'1'},{questionId:90017,answer:'ns'},
  {questionId:90018,answer:'3'},{questionId:90019,answer:'ns'},{questionId:90020,answer:'4'},
  {questionId:90021,answer:'ns'},{questionId:90022,answer:'5'},{questionId:90023,answer:'ns'},
  {questionId:90024,answer:'1'},{questionId:90025,answer:'ns'},{questionId:90026,answer:'2'},
  {questionId:90027,answer:'ns'},{questionId:90028,answer:'ns'},{questionId:90029,answer:'varias_semana'},
  {questionId:90030,answer:'1_semana'},{questionId:90031,answer:'menos_1_semana'},{questionId:90032,answer:'varias_semana'},
  {questionId:90033,answer:'diario'},{questionId:90034,answer:'menos_1_semana'},
  {questionId:90035,answer:'reducido_uso'},{questionId:90036,answer:['dificultad_caminar','cambios_rutas']},
  {questionId:90037,answer:'1'},{questionId:90038,answer:'3'},{questionId:90039,answer:'5'},
  {questionId:90040,answer:['zonas_peatonales','senalizacion']}
];

// Obtener las preguntas del template
const [qs] = await conn.execute('SELECT id, `order`, type, text FROM questions WHERE templateId = 90001 ORDER BY `order`');
const qMap = new Map(qs.map(q => [q.id, q]));

const metaCount = 4;
const answerByOrder = {};
for (const a of answers) {
  const q = qMap.get(a.questionId);
  if (!q) { console.log('Question not found:', a.questionId); continue; }
  const rawVal = a.answer;
  let strVal = Array.isArray(rawVal) ? JSON.stringify(rawVal) : (rawVal === null || rawVal === undefined ? '' : String(rawVal));
  answerByOrder[q.order] = strVal;
}

const flatCols = {};
const realQs = qs.filter(q => !q.text.startsWith('META:'));
for (const q of realQs) {
  const colIdx = q.order - metaCount;
  const rawVal = answerByOrder[q.order] ?? null;
  if (colIdx === 36) {
    let vals = [];
    try { vals = rawVal ? JSON.parse(rawVal) : []; } catch { vals = rawVal ? [rawVal] : []; }
    flatCols['r_p35a'] = vals[0] ?? null;
    flatCols['r_p35b'] = vals[1] ?? null;
    flatCols['r_p35c'] = vals[2] ?? null;
  } else {
    const colName = 'r_p' + String(colIdx).padStart(2, '0');
    flatCols[colName] = rawVal;
  }
}

console.log('flatCols:', JSON.stringify(flatCols, null, 2));
console.log('\nColumnas generadas:', Object.keys(flatCols).sort().join(', '));
console.log('\nTotal columnas:', Object.keys(flatCols).length);

// Verificar si hay columnas que no existen en la BD
const [bdCols] = await conn.execute('SHOW COLUMNS FROM survey_responses');
const bdColNames = new Set(bdCols.map(c => c.Field));
const unknownCols = Object.keys(flatCols).filter(c => !bdColNames.has(c));
console.log('\nColumnas desconocidas en BD:', unknownCols.length > 0 ? unknownCols.join(', ') : 'ninguna');

// Intentar el INSERT real
try {
  const insertData = {
    templateId: 90001,
    encuestadorId: 1,
    encuestadorName: 'Test',
    encuestadorIdentifier: 'T_DIAG_99',
    deviceInfo: '{}',
    surveyPoint: '02',
    timeSlot: 'noche',
    latitude: '37.35',
    longitude: '-6.03',
    gpsAccuracy: '5',
    language: 'es',
    answers: JSON.stringify(answers),
    windowCode: 'V2',
    minuteStart: 1,
    minuteEnd: 1,
    earlyExit: 0,
    status: 'completa',
    ...flatCols,
  };
  
  const cols = Object.keys(insertData);
  const vals = Object.values(insertData);
  const placeholders = cols.map(() => '?').join(', ');
  const colList = cols.map(c => '`' + c + '`').join(', ');
  
  await conn.execute(`INSERT INTO survey_responses (${colList}) VALUES (${placeholders})`, vals);
  console.log('\nINSERT OK!');
  await conn.execute('DELETE FROM survey_responses WHERE encuestadorIdentifier = ?', ['T_DIAG_99']);
} catch(e) {
  console.error('\nINSERT ERROR:', {
    message: e.message,
    code: e.code,
    errno: e.errno,
    sqlState: e.sqlState,
    sqlMessage: e.sqlMessage,
    sql: e.sql?.substring(0, 300),
  });
}

await conn.end();
