// src/db/migrations/001_initial_schema.js
const { sql } = require('kysely');

async function up(db) {
  // 1. Orchestration & Repositories
  await db.schema.createTable('repositories')
    .addColumn('id', 'varchar(36)', col => col.primaryKey())
    .addColumn('name', 'varchar', col => col.notNull())
    .addColumn('path', 'varchar', col => col.notNull())
    .addColumn('created_at', 'varchar', col => col.notNull())
    .addColumn('updated_at', 'varchar', col => col.notNull())
    .execute();

  await db.schema.createTable('commits')
    .addColumn('id', 'varchar(36)', col => col.primaryKey())
    .addColumn('hash', 'varchar', col => col.notNull().unique())
    .addColumn('repository_id', 'varchar(36)', col => col.references('repositories.id').onDelete('cascade').notNull())
    .addColumn('author', 'varchar')
    .addColumn('timestamp', 'varchar', col => col.notNull())
    .addColumn('message', 'text')
    .addColumn('branch', 'varchar')
    .addColumn('summary', 'text')
    .execute();

  await db.schema.createTable('index_jobs')
    .addColumn('id', 'varchar(36)', col => col.primaryKey())
    .addColumn('repository_id', 'varchar(36)', col => col.references('repositories.id').onDelete('cascade').notNull())
    .addColumn('commit_id', 'varchar(36)', col => col.references('commits.id').onDelete('cascade').notNull())
    .addColumn('stage', 'varchar', col => col.notNull())
    .addColumn('status', 'varchar', col => col.notNull())
    .addColumn('started_at', 'varchar', col => col.notNull())
    .addColumn('completed_at', 'varchar')
    .addColumn('error', 'text')
    .addColumn('metrics', 'text')
    .execute();

  // 2. File & Blob Storage
  await db.schema.createTable('file_blobs')
    .addColumn('content_hash', 'varchar', col => col.primaryKey())
    .addColumn('storage_type', 'varchar', col => col.notNull())
    .addColumn('content_pointer', 'varchar')
    .addColumn('size_bytes', 'integer')
    .execute();

  await db.schema.createTable('files')
    .addColumn('id', 'varchar(36)', col => col.primaryKey())
    .addColumn('repository_id', 'varchar(36)', col => col.references('repositories.id').onDelete('cascade').notNull())
    .addColumn('path', 'varchar', col => col.notNull())
    .addColumn('content_hash', 'varchar', col => col.references('file_blobs.content_hash').onDelete('cascade').notNull())
    .addColumn('language', 'varchar')
    .addColumn('valid_from_commit_id', 'varchar(36)', col => col.references('commits.id').onDelete('cascade').notNull())
    .addColumn('valid_to_commit_id', 'varchar(36)', col => col.references('commits.id').onDelete('cascade'))
    .execute();

  // 3. Semantic Graph Entities
  await db.schema.createTable('symbols')
    .addColumn('id', 'varchar(36)', col => col.primaryKey())
    .addColumn('repository_id', 'varchar(36)', col => col.references('repositories.id').onDelete('cascade').notNull())
    .addColumn('file_id', 'varchar(36)', col => col.references('files.id').onDelete('cascade').notNull())
    .addColumn('parent_symbol_id', 'varchar(36)', col => col.references('symbols.id').onDelete('cascade'))
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
    .addColumn('valid_from_commit_id', 'varchar(36)', col => col.references('commits.id').onDelete('cascade').notNull())
    .addColumn('valid_to_commit_id', 'varchar(36)', col => col.references('commits.id').onDelete('cascade'))
    .execute();

  await db.schema.createTable('edges')
    .addColumn('id', 'varchar(36)', col => col.primaryKey())
    .addColumn('repository_id', 'varchar(36)', col => col.references('repositories.id').onDelete('cascade').notNull())
    .addColumn('from_symbol_id', 'varchar(36)', col => col.references('symbols.id').onDelete('cascade').notNull())
    .addColumn('to_symbol_id', 'varchar(36)', col => col.references('symbols.id').onDelete('cascade').notNull())
    .addColumn('type', 'varchar', col => col.notNull())
    .addColumn('confidence', 'real', col => col.notNull())
    .addColumn('discovered_by', 'varchar', col => col.notNull())
    .addColumn('metadata', 'text')
    .addColumn('edge_hash', 'varchar', col => col.notNull())
    .addColumn('valid_from_commit_id', 'varchar(36)', col => col.references('commits.id').onDelete('cascade').notNull())
    .addColumn('valid_to_commit_id', 'varchar(36)', col => col.references('commits.id').onDelete('cascade'))
    .execute();

  // 4. Auxiliary Intelligence
  await db.schema.createTable('embeddings')
    .addColumn('id', 'varchar(36)', col => col.primaryKey())
    .addColumn('entity_type', 'varchar', col => col.notNull())
    .addColumn('entity_id', 'varchar(36)', col => col.notNull())
    .addColumn('embedding_model', 'varchar', col => col.notNull())
    .addColumn('vector', 'text') 
    .addColumn('created_at', 'varchar', col => col.notNull())
    .execute();

  await db.schema.createTable('dependencies')
    .addColumn('id', 'varchar(36)', col => col.primaryKey())
    .addColumn('repository_id', 'varchar(36)', col => col.references('repositories.id').onDelete('cascade').notNull())
    .addColumn('package_name', 'varchar', col => col.notNull())
    .addColumn('version', 'varchar')
    .addColumn('ecosystem', 'varchar', col => col.notNull())
    .addColumn('imported_by_files', 'text')
    .execute();

  await db.schema.createTable('unresolved_symbols')
    .addColumn('id', 'varchar(36)', col => col.primaryKey())
    .addColumn('repository_id', 'varchar(36)', col => col.references('repositories.id').onDelete('cascade').notNull())
    .addColumn('file_id', 'varchar(36)', col => col.references('files.id').onDelete('cascade').notNull())
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
