const { Kysely, PostgresDialect, SqliteDialect } = require('kysely');
const { Pool } = require('pg');
const Database = require('better-sqlite3');
const { SqlGraphStore } = require('../store/sql-store');
const { getVerificationEvidence } = require('../verifier');
const { scanCommit } = require('../git/commit-scanner');
const { detectDrift } = require('./drift-detector');

class IntelligenceSDK {
  constructor(config = {}) {
    const dbUri = config.dbUri || process.env.DATABASE_URL;
    const dialectType = config.dialect || process.env.DB_DIALECT || 'sqlite';
    
    let dialect;
    if (dialectType === 'postgres') {
      if (!dbUri) throw new Error('IntelligenceSDK requires a dbUri or DATABASE_URL for Postgres');
      dialect = new PostgresDialect({
        pool: new Pool({
          connectionString: dbUri,
        }),
      });
    } else {
      const dbPath = dbUri || '.codegraphx.db';
      dialect = new SqliteDialect({
        database: new Database(dbPath),
      });
    }

    this.db = new Kysely({ dialect });
    this.sqlStore = new SqlGraphStore(this.db);
  }

  async getVerificationEvidence(repositoryId, commitId, taskDescription) {
    return await getVerificationEvidence(this.sqlStore, repositoryId, commitId, taskDescription);
  }

  async scanCommit(projectRoot, repositoryId, branch = 'HEAD') {
    return await scanCommit(projectRoot, this.sqlStore, repositoryId, branch);
  }

  async traceImpact(repositoryId, symbolId, direction = 'downstream', maxDepth = 5) {
    return await this.sqlStore.traceImpact(repositoryId, symbolId, direction, maxDepth);
  }

  async detectDrift(repositoryId, symbolId, symbolName, rules) {
    return await detectDrift(this, repositoryId, symbolId, symbolName, rules);
  }

  async destroy() {
    await this.db.destroy();
  }
}

module.exports = { IntelligenceSDK };
