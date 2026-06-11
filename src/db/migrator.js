// src/db/migrator.js
const path = require('path');
const fs = require('fs').promises;
const { Migrator, FileMigrationProvider } = require('kysely');
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
