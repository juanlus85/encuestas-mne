import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is not configured');
  process.exit(1);
}

const TEST_ADMIN = {
  openId: 'local-admin',
  name: 'Survexia Admin',
  email: 'admin@organizus.es',
  loginMethod: 'manual',
  role: 'admin',
  username: 'admin',
  password: 'Survexia2026!',
  identifier: 'ADM-01',
  surveyTypeAssigned: 'ambos',
  isActive: 1,
};

const conn = await mysql.createConnection(databaseUrl);

try {
  const [tables] = await conn.query('SHOW TABLES');
  console.log('Connected to database. Table count:', tables.length);

  const [existingUsers] = await conn.query(
    'SELECT id, openId, name, role, username, isActive FROM users ORDER BY id LIMIT 20'
  );
  console.log('Existing users:', existingUsers);

  const passwordHash = await bcrypt.hash(TEST_ADMIN.password, 10);

  await conn.query(
    `INSERT INTO users (
      openId, name, email, loginMethod, role, username, passwordHash,
      identifier, surveyTypeAssigned, isActive, createdAt, updatedAt, lastSignedIn
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      email = VALUES(email),
      loginMethod = VALUES(loginMethod),
      role = VALUES(role),
      username = VALUES(username),
      passwordHash = VALUES(passwordHash),
      identifier = VALUES(identifier),
      surveyTypeAssigned = VALUES(surveyTypeAssigned),
      isActive = VALUES(isActive),
      updatedAt = NOW(),
      lastSignedIn = NOW()`,
    [
      TEST_ADMIN.openId,
      TEST_ADMIN.name,
      TEST_ADMIN.email,
      TEST_ADMIN.loginMethod,
      TEST_ADMIN.role,
      TEST_ADMIN.username,
      passwordHash,
      TEST_ADMIN.identifier,
      TEST_ADMIN.surveyTypeAssigned,
      TEST_ADMIN.isActive,
    ]
  );

  const [adminRows] = await conn.query(
    'SELECT id, openId, name, role, username, isActive FROM users WHERE username = ?',
    [TEST_ADMIN.username]
  );

  console.log('Ensured admin user:', adminRows[0]);
  console.log('Test credentials:');
  console.log(`  username: ${TEST_ADMIN.username}`);
  console.log(`  password: ${TEST_ADMIN.password}`);
} finally {
  await conn.end();
}
