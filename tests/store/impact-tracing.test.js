const { db, closeDb, dialectType } = require('../../src/db');
const { runMigrations } = require('../../src/db/migrator');
const { SqlGraphStore } = require('../../src/store/sql-store');
const { sql } = require('kysely');

describe('Impact Tracing', () => {
  let store;
  let repoId;

  beforeAll(async () => {
    if (dialectType === 'postgres') {
      await sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`.execute(db);
    } else {
      const tables = ['unresolved_symbols', 'dependencies', 'embeddings', 'edges', 'symbols', 'files', 'file_blobs', 'index_jobs', 'commits', 'repositories', 'kysely_migration', 'kysely_migration_lock'];
      for (const table of tables) {
        await db.schema.dropTable(table).ifExists().execute();
      }
    }
    await runMigrations();
    store = new SqlGraphStore(db);
    const repo = await db.insertInto('repositories')
      .values({ 
        id: require('crypto').randomUUID(),
        name: 'impact-repo', 
        path: '/test',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .returning('id').executeTakeFirstOrThrow();
    repoId = repo.id;
  });

  afterAll(async () => {
    await closeDb();
  });

  test('traceImpact finds downstream dependencies (A -> B -> C)', async () => {
    const c1 = await store.addCommit(repoId, 'h1', 'Initial');
    const f1 = await store.updateFile(repoId, c1, '/app.js', 'hA', 'javascript');
    
    await store.updateSymbols(repoId, c1, f1, [
      { qualified_name: 'A', name: 'A', kind: 'function', symbol_hash: 'hA', start_line: 1, end_line: 1 },
      { qualified_name: 'B', name: 'B', kind: 'function', symbol_hash: 'hB', start_line: 2, end_line: 2 },
      { qualified_name: 'C', name: 'C', kind: 'function', symbol_hash: 'hC', start_line: 3, end_line: 3 }
    ]);

    const syms = await db.selectFrom('symbols').where('repository_id', '=', repoId).selectAll().execute();
    const idA = syms.find(s => s.name === 'A').id;
    const idB = syms.find(s => s.name === 'B').id;
    const idC = syms.find(s => s.name === 'C').id;

    // A -> B -> C
    await store.updateEdges(repoId, c1, [
      { from_symbol_id: idA, to_symbol_id: idB, type: 'CALLS', confidence: 1.0, discovered_by: 'AST', edge_hash: 'e1' },
      { from_symbol_id: idB, to_symbol_id: idC, type: 'CALLS', confidence: 1.0, discovered_by: 'AST', edge_hash: 'e2' }
    ]);

    const impact = await store.traceImpact(repoId, idA, 'downstream');
    const names = impact.map(s => s.name);
    
    expect(names).toContain('B');
    expect(names).toContain('C');
    expect(impact[0].path).toBe('/app.js');
  });
});
