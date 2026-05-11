// tests/db/migrations.test.js
const { db, closeDb } = require('../../src/db');
const { runMigrations } = require('../../src/db/migrator');
const { sql } = require('kysely');

describe('Database Migrations', () => {
  beforeAll(async () => {
    // Drop all tables before test if they exist to start clean
    await sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`.execute(db);
  });

  afterAll(async () => {
    await closeDb();
  });

  test('runs migrations to latest and creates tables', async () => {
    const { error, results } = await runMigrations();
    expect(error).toBeUndefined();
    expect(results).toBeDefined();
    
    // Check if repositories table exists
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `.execute(db);
    
    const tableNames = tables.rows.map(r => r.table_name);
    expect(tableNames).toContain('repositories');
    expect(tableNames).toContain('symbols');
    expect(tableNames).toContain('edges');
  });
});
