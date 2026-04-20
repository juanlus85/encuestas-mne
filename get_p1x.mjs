import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.query(`
  SELECT id, \`order\`, text, type, isRequired
  FROM questions 
  WHERE templateId = 90001 
  AND text LIKE 'P1%'
  ORDER BY \`order\`
`);

rows.forEach(r => {
  console.log(`${r.id} | order:${r.order} | type:${r.type} | req:${r.isRequired} | ${r.text}`);
});

await conn.end();
