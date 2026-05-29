// tests/db/migrations.test.js
const { db, closeDb, dialectType } = require('../../src/db');
const { runMigrations } = require('../../src/db/migrator');
const { sql } = require('kysely');

describe('Database Migrations', () => {
  beforeAll(async () => {
    // Start clean
    if (dialectType === 'postgres') {
      await sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`.execute(db);
    } else {
      // For SQLite, we just drop all tables if they exist
      const tables = ['unresolved_symbols', 'dependencies', 'embeddings', 'edges', 'symbols', 'files', 'file_blobs', 'index_jobs', 'commits', 'repositories', 'kysely_migration', 'kysely_migration_lock'];
      for (const table of tables) {
        await db.schema.dropTable(table).ifExists().execute();
      }
    }
  });

  afterAll(async () => {
    await closeDb();
  });

  test('runs migrations to latest and creates tables', async () => {
    const { error, results } = await runMigrations();
    expect(error).toBeUndefined();
    expect(results).toBeDefined();
    
    // Check if repositories table exists in a dialect-agnostic way
    let tableNames = [];
    if (dialectType === 'postgres') {
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `.execute(db);
      tableNames = tables.rows.map(r => r.table_name);
    } else {
      const tables = await sql`
        SELECT name as table_name FROM sqlite_master WHERE type='table'
      `.execute(db);
      tableNames = tables.rows.map(r => r.table_name);
    }
    
    expect(tableNames).toContain('repositories');
    expect(tableNames).toContain('symbols');
    expect(tableNames).toContain('edges');
  });
});
