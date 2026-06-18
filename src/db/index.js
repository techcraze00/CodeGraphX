const { Kysely, PostgresDialect, SqliteDialect } = require('kysely');
const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dialectType = process.env.DB_DIALECT || 'sqlite';

let dialect;

if (dialectType === 'postgres') {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/codegraphx_test';
  dialect = new PostgresDialect({
    pool: new Pool({
      connectionString,
    }),
  });
} else {
  const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), '.codegraphx.db');
  dialect = new SqliteDialect({
    database: new Database(dbPath),
  });
}

const db = new Kysely({
  dialect,
});

async function closeDb() {
  await db.destroy();
}

module.exports = { db, closeDb, dialectType };
