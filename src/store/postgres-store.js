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

  async getFilesAtCommit(repositoryId, commitId) {
    // Note: To properly support historical queries when commits are UUIDs, 
    // we would need timestamps or topological ordering. For MVP where we pass the exact boundary, 
    // we assume the query looks for records valid from <= this commit's timestamp.
    // However, since commits might not be easily ordered by UUID alone, we can do a simplified
    // lookup by fetching the commit's timestamp and comparing.
    const commit = await this.db.selectFrom('commits').selectAll().where('id', '=', commitId).executeTakeFirstOrThrow();

    return await this.db.selectFrom('files as f')
      .innerJoin('commits as c_from', 'f.valid_from_commit_id', 'c_from.id')
      .leftJoin('commits as c_to', 'f.valid_to_commit_id', 'c_to.id')
      .selectAll('f')
      .where('f.repository_id', '=', repositoryId)
      .where('c_from.timestamp', '<=', commit.timestamp)
      .where((eb) => eb.or([
        eb('c_to.id', 'is', null),
        eb('c_to.timestamp', '>', commit.timestamp)
      ]))
      .execute();
  }
}

module.exports = { PostgresGraphStore };
