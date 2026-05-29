const { Kysely, PostgresDialect } = require('kysely');
const { Pool } = require('pg');
const { PostgresGraphStore } = require('../store/postgres-store');
const { getVerificationEvidence } = require('../verifier');
const { scanCommit } = require('../git/commit-scanner');
const { detectDrift } = require('./drift-detector');

class IntelligenceSDK {
  constructor(config = {}) {
    const dbUri = config.dbUri || process.env.DATABASE_URL;
    
    if (!dbUri) {
      throw new Error('IntelligenceSDK requires a dbUri or DATABASE_URL environment variable');
    }

    this.db = new Kysely({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString: dbUri,
        }),
      }),
    });

    this.pgStore = new PostgresGraphStore(this.db);
  }

  async getVerificationEvidence(repositoryId, commitId, taskDescription) {
    return await getVerificationEvidence(this.pgStore, repositoryId, commitId, taskDescription);
  }

  async scanCommit(projectRoot, repositoryId, branch = 'HEAD') {
    return await scanCommit(projectRoot, this.pgStore, repositoryId, branch);
  }

  async traceImpact(repositoryId, symbolId, direction = 'downstream', maxDepth = 5) {
    return await this.pgStore.traceImpact(repositoryId, symbolId, direction, maxDepth);
  }

  async detectDrift(repositoryId, symbolId, symbolName, rules) {
    return await detectDrift(this, repositoryId, symbolId, symbolName, rules);
  }

  async destroy() {
    await this.db.destroy();
  }
}

module.exports = { IntelligenceSDK };
