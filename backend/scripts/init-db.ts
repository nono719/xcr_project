import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import 'dotenv/config';

async function main() {
  const sqlPath = path.resolve(__dirname, 'init-db.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    multipleStatements: true,
  });
  console.log('Connected. Executing init-db.sql ...');
  await conn.query(sql);
  console.log('Done.');
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
