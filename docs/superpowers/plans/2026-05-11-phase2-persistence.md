# Phase 2 Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the PostgreSQL database layer for CodeGraphX to transition from flat JSON files to a scalable, SCD Type 2 relational architecture.

**Architecture:** We use Kysely for type-safe query building and schema migrations, coupled with raw `pg` for the connection pool. The storage approach isolates raw source code into `file_blobs` and tracks structural graph changes (Files, Symbols, Edges) across commits using `valid_from_commit_id` and `valid_to_commit_id`.

**Tech Stack:** Node.js, PostgreSQL, Kysely, pg

---

### Task 1: Package Installation & DB Configuration

**Files:**
- Modify: `package.json`
- Create: `src/db/index.js`
- Create: `tests/db/connection.test.js`

- [ ] **Step 1: Install dependencies**

Run: `npm install kysely pg dotenv`
Run: `npm install -D @types/pg`

- [ ] **Step 2: Write failing test for DB connection**

```javascript
// tests/db/connection.test.js
const { db, closeDb } = require('../../src/db');

describe('Database Connection', () => {
  afterAll(async () => {
    await closeDb();
  });

  test('can execute a simple query', async () => {
    const result = await db.executeQuery({
      sql: 'SELECT 1 as "connected"',
      parameters: []
    });
    expect(result.rows[0].connected).toBe(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test tests/db/connection.test.js`
Expected: FAIL (Cannot find module '../../src/db')

- [ ] **Step 4: Write minimal implementation**

```javascript
// src/db/index.js
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test tests/db/connection.test.js`
*(Note: Requires a local postgres running. If it fails due to no DB, please ensure a local test db `codegraphx_test` exists.)*
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/db/index.js tests/db/connection.test.js
git commit -m "chore: setup Kysely and PostgreSQL connection pool"
```

### Task 2: Initial Schema Migration

**Files:**
- Create: `src/db/migrations/001_initial_schema.js`
- Create: `src/db/migrator.js`
- Create: `tests/db/migrations.test.js`

- [ ] **Step 1: Write failing test for migrations**

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/db/migrations.test.js`
Expected: FAIL (Cannot find module '../../src/db/migrator')

- [ ] **Step 3: Write migrator utility**

```javascript
// src/db/migrator.js
const path = require('path');
const fs = require('fs').promises;
const { Migrator, FileMigrationProvider } = require('kysely/migration');
const { db } = require('./index');

async function runMigrations() {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  });

  return await migrator.migrateToLatest();
}

module.exports = { runMigrations };
```

- [ ] **Step 4: Write migration script**

```javascript
// src/db/migrations/001_initial_schema.js
const { sql } = require('kysely');

async function up(db) {
  // 1. Orchestration & Repositories
  await db.schema.createTable('repositories')
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'varchar', col => col.notNull())
    .addColumn('path', 'varchar', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`now()`).notNull())
    .addColumn('updated_at', 'timestamp', col => col.defaultTo(sql`now()`).notNull())
    .execute();

  await db.schema.createTable('commits')
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('hash', 'varchar', col => col.notNull().unique())
    .addColumn('repository_id', 'uuid', col => col.references('repositories.id').onDelete('cascade').notNull())
    .addColumn('author', 'varchar')
    .addColumn('timestamp', 'timestamp', col => col.defaultTo(sql`now()`).notNull())
    .addColumn('message', 'text')
    .addColumn('branch', 'varchar')
    .addColumn('summary', 'text')
    .execute();

  await db.schema.createTable('index_jobs')
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('repository_id', 'uuid', col => col.references('repositories.id').onDelete('cascade').notNull())
    .addColumn('commit_id', 'uuid', col => col.references('commits.id').onDelete('cascade').notNull())
    .addColumn('stage', 'varchar', col => col.notNull())
    .addColumn('status', 'varchar', col => col.notNull())
    .addColumn('started_at', 'timestamp', col => col.defaultTo(sql`now()`).notNull())
    .addColumn('completed_at', 'timestamp')
    .addColumn('error', 'text')
    .addColumn('metrics', 'jsonb')
    .execute();

  // 2. File & Blob Storage
  await db.schema.createTable('file_blobs')
    .addColumn('content_hash', 'varchar', col => col.primaryKey())
    .addColumn('storage_type', 'varchar', col => col.notNull())
    .addColumn('content_pointer', 'varchar')
    .addColumn('size_bytes', 'integer')
    .execute();

  await db.schema.createTable('files')
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('repository_id', 'uuid', col => col.references('repositories.id').onDelete('cascade').notNull())
    .addColumn('path', 'varchar', col => col.notNull())
    .addColumn('content_hash', 'varchar', col => col.references('file_blobs.content_hash').onDelete('cascade').notNull())
    .addColumn('language', 'varchar')
    .addColumn('valid_from_commit_id', 'uuid', col => col.references('commits.id').onDelete('cascade').notNull())
    .addColumn('valid_to_commit_id', 'uuid', col => col.references('commits.id').onDelete('cascade'))
    .execute();

  // 3. Semantic Graph Entities
  await db.schema.createTable('symbols')
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('repository_id', 'uuid', col => col.references('repositories.id').onDelete('cascade').notNull())
    .addColumn('file_id', 'uuid', col => col.references('files.id').onDelete('cascade').notNull())
    .addColumn('parent_symbol_id', 'uuid', col => col.references('symbols.id').onDelete('cascade'))
    .addColumn('qualified_name', 'varchar', col => col.notNull())
    .addColumn('name', 'varchar', col => col.notNull())
    .addColumn('kind', 'varchar', col => col.notNull())
    .addColumn('signature', 'text')
    .addColumn('visibility', 'varchar')
    .addColumn('is_exported', 'boolean')
    .addColumn('language', 'varchar')
    .addColumn('docstring', 'text')
    .addColumn('symbol_hash', 'varchar', col => col.notNull())
    .addColumn('start_line', 'integer')
    .addColumn('end_line', 'integer')
    .addColumn('start_column', 'integer')
    .addColumn('end_column', 'integer')
    .addColumn('parser_version', 'varchar')
    .addColumn('extractor_version', 'varchar')
    .addColumn('valid_from_commit_id', 'uuid', col => col.references('commits.id').onDelete('cascade').notNull())
    .addColumn('valid_to_commit_id', 'uuid', col => col.references('commits.id').onDelete('cascade'))
    .execute();

  await db.schema.createTable('edges')
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('repository_id', 'uuid', col => col.references('repositories.id').onDelete('cascade').notNull())
    .addColumn('from_symbol_id', 'uuid', col => col.references('symbols.id').onDelete('cascade').notNull())
    .addColumn('to_symbol_id', 'uuid', col => col.references('symbols.id').onDelete('cascade').notNull())
    .addColumn('type', 'varchar', col => col.notNull())
    .addColumn('confidence', 'real', col => col.notNull())
    .addColumn('discovered_by', 'varchar', col => col.notNull())
    .addColumn('metadata', 'jsonb')
    .addColumn('edge_hash', 'varchar', col => col.notNull())
    .addColumn('valid_from_commit_id', 'uuid', col => col.references('commits.id').onDelete('cascade').notNull())
    .addColumn('valid_to_commit_id', 'uuid', col => col.references('commits.id').onDelete('cascade'))
    .execute();

  // 4. Auxiliary Intelligence
  await db.schema.createTable('embeddings')
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('entity_type', 'varchar', col => col.notNull())
    .addColumn('entity_id', 'uuid', col => col.notNull())
    .addColumn('embedding_model', 'varchar', col => col.notNull())
    .addColumn('vector', 'jsonb') // Fallback to jsonb for MVP if pgvector extension is not guaranteed present
    .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`now()`).notNull())
    .execute();

  await db.schema.createTable('dependencies')
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('repository_id', 'uuid', col => col.references('repositories.id').onDelete('cascade').notNull())
    .addColumn('package_name', 'varchar', col => col.notNull())
    .addColumn('version', 'varchar')
    .addColumn('ecosystem', 'varchar', col => col.notNull())
    .addColumn('imported_by_files', 'jsonb')
    .execute();

  await db.schema.createTable('unresolved_symbols')
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('repository_id', 'uuid', col => col.references('repositories.id').onDelete('cascade').notNull())
    .addColumn('file_id', 'uuid', col => col.references('files.id').onDelete('cascade').notNull())
    .addColumn('symbol_name', 'varchar', col => col.notNull())
    .addColumn('context', 'text')
    .addColumn('attempted_resolution', 'varchar')
    .execute();

  // Indexes
  await db.schema.createIndex('symbols_repo_qualified_name_idx').on('symbols').columns(['repository_id', 'qualified_name']).execute();
  await db.schema.createIndex('symbols_file_id_idx').on('symbols').column('file_id').execute();
  await db.schema.createIndex('symbols_hash_idx').on('symbols').column('symbol_hash').execute();
  await db.schema.createIndex('edges_from_symbol_id_idx').on('edges').column('from_symbol_id').execute();
  await db.schema.createIndex('edges_to_symbol_id_idx').on('edges').column('to_symbol_id').execute();
  await db.schema.createIndex('edges_type_idx').on('edges').column('type').execute();
  await db.schema.createIndex('files_repo_path_idx').on('files').columns(['repository_id', 'path']).execute();
}

async function down(db) {
  const tables = [
    'unresolved_symbols', 'dependencies', 'embeddings', 'edges', 'symbols',
    'files', 'file_blobs', 'index_jobs', 'commits', 'repositories'
  ];
  for (const table of tables) {
    await db.schema.dropTable(table).ifExists().execute();
  }
}

module.exports = { up, down };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test tests/db/migrations.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/db/migrator.js src/db/migrations/001_initial_schema.js tests/db/migrations.test.js
git commit -m "feat(db): implement initial Kysely migration for persistence layer"
```

### Task 3: Postgres Store Foundation

**Files:**
- Create: `src/store/postgres-store.js`
- Create: `tests/store/postgres-store.test.js`

- [ ] **Step 1: Write failing test**

```javascript
// tests/store/postgres-store.test.js
const { db, closeDb } = require('../../src/db');
const { runMigrations } = require('../../src/db/migrator');
const { PostgresGraphStore } = require('../../src/store/postgres-store');
const { sql } = require('kysely');

describe('PostgresGraphStore', () => {
  let store;
  let repoId;

  beforeAll(async () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/store/postgres-store.test.js`
Expected: FAIL (Cannot find PostgresGraphStore)

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/store/postgres-store.js
class PostgresGraphStore {
  constructor(db) {
    this.db = db;
  }

  async addCommit(repositoryId, hash, message, author = 'System', branch = 'main') {
    const row = await this.db.insertInto('commits')
      .values({
        repository_id: repositoryId,
        hash,
        message,
        author,
        branch
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    
    return row.id;
  }
}

module.exports = { PostgresGraphStore };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/store/postgres-store.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/postgres-store.js tests/store/postgres-store.test.js
git commit -m "feat(store): add PostgresGraphStore skeleton and addCommit"
```

---
*Note: Due to the complexity of the full graph sync (SCD Type 2 invalidation), subsequent tasks covering `updateFile` with symbols, blobs, and edges invalidation should be tackled as independent sub-projects extending `PostgresGraphStore` after this foundational plan is executed.*
