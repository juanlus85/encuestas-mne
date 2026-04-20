import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.query(`
  SELECT id, \`order\`, text, type, options, isRequired
  FROM questions 
  WHERE templateId = 90001 
  ORDER BY \`order\`
`);

const nonMeta = rows.filter(r => !r.text.startsWith('META'));
nonMeta.slice(0, 8).forEach(r => {
  console.log(`id:${r.id} | order:${r.order} | type:${r.type} | req:${r.isRequired}`);
  console.log(`text: ${r.text.substring(0, 100)}`);
  if (r.options) {
    const opts = JSON.parse(r.options);
    console.log(`opts count: ${opts.length} | first: ${JSON.stringify(opts[0])} | last: ${JSON.stringify(opts[opts.length-1])}`);
  }
  console.log('---');
});

// Exportar opciones completas de P1.1 para el SQL
const p11 = nonMeta.find(r => r.text.includes('P1.1'));
if (p11 && p11.options) {
  console.log('\n=== P1.1 OPTIONS JSON (completo) ===');
  console.log(p11.options);
}

await conn.end();
