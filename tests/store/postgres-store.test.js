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

  test('updateFile dedups blobs and correctly handles SCD2 invalidation', async () => {
    const commitId1 = await store.addCommit(repoId, 'hash-file-1', 'msg');
    const commitId2 = await store.addCommit(repoId, 'hash-file-2', 'msg2');

    // Add a file
    const fileId1 = await store.updateFile(repoId, commitId1, '/app.js', 'content-hash-A', 'javascript');
    expect(fileId1).toBeDefined();

    // Update same file with new hash in new commit
    const fileId2 = await store.updateFile(repoId, commitId2, '/app.js', 'content-hash-B', 'javascript');
    expect(fileId2).not.toBe(fileId1);

    // Check that old file is closed
    const oldFile = await db.selectFrom('files').where('id', '=', fileId1).selectAll().executeTakeFirst();
    expect(oldFile.valid_to_commit_id).toBe(commitId2);

    // Check that new file is open
    const newFile = await db.selectFrom('files').where('id', '=', fileId2).selectAll().executeTakeFirst();
    expect(newFile.valid_from_commit_id).toBe(commitId2);
    expect(newFile.valid_to_commit_id).toBeNull();
  });

  test('updateSymbols handles invalidation and creation correctly', async () => {
    const commitId1 = await store.addCommit(repoId, 'sym-1', 'msg');
    const commitId2 = await store.addCommit(repoId, 'sym-2', 'msg2');
    const fileId = await store.updateFile(repoId, commitId1, '/syms.js', 'hashX', 'javascript');

    const initialSymbols = [{
      qualified_name: 'funcA',
      name: 'funcA',
      kind: 'function',
      symbol_hash: 'hashA1',
      start_line: 1, end_line: 5, start_column: 1, end_column: 10
    }];

    await store.updateSymbols(repoId, commitId1, fileId, initialSymbols);

    // Assert symbol exists and is open
    let activeSymbols = await db.selectFrom('symbols').where('repository_id', '=', repoId).where('valid_to_commit_id', 'is', null).selectAll().execute();
    expect(activeSymbols).toHaveLength(1);
    expect(activeSymbols[0].symbol_hash).toBe('hashA1');

    // Update symbol: hash changes (simulating code edit inside funcA)
    const modifiedSymbols = [{
      qualified_name: 'funcA',
      name: 'funcA',
      kind: 'function',
      symbol_hash: 'hashA2',
      start_line: 1, end_line: 6, start_column: 1, end_column: 10
    }];

    await store.updateSymbols(repoId, commitId2, fileId, modifiedSymbols);

    activeSymbols = await db.selectFrom('symbols').where('repository_id', '=', repoId).where('valid_to_commit_id', 'is', null).selectAll().execute();
    expect(activeSymbols).toHaveLength(1);
    expect(activeSymbols[0].symbol_hash).toBe('hashA2');

    const oldSymbols = await db.selectFrom('symbols').where('repository_id', '=', repoId).where('valid_to_commit_id', 'is not', null).selectAll().execute();
    expect(oldSymbols).toHaveLength(1);
    expect(oldSymbols[0].symbol_hash).toBe('hashA1');
    expect(oldSymbols[0].valid_to_commit_id).toBe(commitId2);
  });
});
