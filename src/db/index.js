const { Kysely, PostgresDialect } = require('kysely');
const { Pool } = require('pg');
require('dotenv').config();

// Use an environment variable or default to a local test db
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/codegraphx_test';

const db = new Kysely({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString,
    }),
  }),
});

async function closeDb() {
  await db.destroy();
}

module.exports = { db, closeDb };
