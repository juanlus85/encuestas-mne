import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Simular exactamente lo que hace el endpoint
const [byPuntoRows] = await conn.execute(
  'SELECT surveyPointCode, SUM(`count`) as total, COUNT(*) as registros FROM pedestrian_passes GROUP BY surveyPointCode'
);
console.log('byPuntoRows (desde BD):', JSON.stringify(byPuntoRows, null, 2));

// Simular el puntoMap
const SURVEY_POINTS = [
  { code: '01', fullName: '01 Virgen de los Reyes' },
  { code: '02', fullName: '02 Mateos Gago' },
  { code: '03', fullName: '03 Patio de Banderas' },
  { code: '04', fullName: '04 Agua / Vida' },
  { code: '05', fullName: '05 Plaza de Alfaro' },
  { code: '06', fullName: '06 Plaza Refinadores' },
  { code: '07', fullName: '07 Sta. Mª la Blanca' },
  { code: '08', fullName: '08 Ximenez de Enciso' },
  { code: '09', fullName: '09 Pl. Venerables' },
];

const puntoMap = new Map();
for (const p of SURVEY_POINTS) {
  puntoMap.set(p.code, { name: p.fullName, value: 0, registros: 0 });
}
for (const r of byPuntoRows) {
  const code = (r.surveyPointCode ?? '').trim();
  if (!code) continue;
  const existing = puntoMap.get(code);
  if (existing) {
    existing.value += Number(r.total ?? 0);
    existing.registros += Number(r.registros ?? 0);
  } else {
    puntoMap.set(code, { name: code, value: Number(r.total ?? 0), registros: Number(r.registros ?? 0) });
  }
}

const allPuntos = Array.from(puntoMap.values()).sort((a, b) => a.name.localeCompare(b.name));
const total = allPuntos.reduce((acc, r) => acc + r.value, 0);
console.log('\nbyPunto (lo que devuelve el endpoint):', JSON.stringify(allPuntos, null, 2));
console.log('\nTotal personas:', total);

await conn.end();
