// tests/store/postgres-store.test.js
const { db, closeDb } = require('../../src/db');
const { runMigrations } = require('../../src/db/migrator');
const { PostgresGraphStore } = require('../../src/store/postgres-store');
const { sql } = require('kysely');

describe('PostgresGraphStore', () => {
  let store;
  let repoId;

  beforeAll(async () => {
    // Start fresh
    await sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`.execute(db);
    await runMigrations();
    store = new PostgresGraphStore(db);
    
    // Setup base repo
    const repo = await db.insertInto('repositories')
      .values({ name: 'test-repo', path: '/test' })
      .returning('id').executeTakeFirstOrThrow();
    repoId = repo.id;
  });

  afterAll(async () => {
    await closeDb();
  });

  test('can insert a new commit and retrieve its ID', async () => {
    const commitId = await store.addCommit(repoId, 'abc123hash', 'Initial commit');
    expect(commitId).toBeDefined();

    const commit = await db.selectFrom('commits').selectAll().where('id', '=', commitId).executeTakeFirst();
    expect(commit.hash).toBe('abc123hash');
  });
});
