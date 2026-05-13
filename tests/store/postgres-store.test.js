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

  test('can retrieve graph state at a specific commit using SCD2 logic', async () => {
    const commit1Id = await store.addCommit(repoId, 'commit1', 'First commit');
    const commit2Id = await store.addCommit(repoId, 'commit2', 'Second commit');

    // Force distinct timestamps
    await db.updateTable('commits').set({ timestamp: new Date(Date.now() - 10000) }).where('id', '=', commit1Id).execute();
    await db.updateTable('commits').set({ timestamp: new Date() }).where('id', '=', commit2Id).execute();

    // Insert mock file, valid from commit1, valid to commit2 (closed)
    await db.insertInto('file_blobs').values({ content_hash: 'hash1', storage_type: 'local' }).execute();
    await db.insertInto('files').values({
      repository_id: repoId,
      path: '/index.js',
      content_hash: 'hash1',
      valid_from_commit_id: commit1Id,
      valid_to_commit_id: commit2Id
    }).execute();

    // Insert mock file, valid from commit2, open
    await db.insertInto('file_blobs').values({ content_hash: 'hash2', storage_type: 'local' }).execute();
    await db.insertInto('files').values({
      repository_id: repoId,
      path: '/index.js',
      content_hash: 'hash2',
      valid_from_commit_id: commit2Id,
      valid_to_commit_id: null
    }).execute();

    const filesAtCommit1 = await store.getFilesAtCommit(repoId, commit1Id);
    expect(filesAtCommit1).toHaveLength(1);
    expect(filesAtCommit1[0].content_hash).toBe('hash1');

    const filesAtCommit2 = await store.getFilesAtCommit(repoId, commit2Id);
    expect(filesAtCommit2).toHaveLength(1);
    expect(filesAtCommit2[0].content_hash).toBe('hash2');
  });
});
