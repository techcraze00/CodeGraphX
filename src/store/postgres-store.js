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

  async updateFile(repositoryId, currentCommitId, path, contentHash, language) {
    return await this.db.transaction().execute(async (trx) => {
      // 1. Ensure file blob exists
      await trx.insertInto('file_blobs')
        .values({
          content_hash: contentHash,
          storage_type: 'local_fs' // default
        })
        .onConflict((oc) => oc.column('content_hash').doNothing())
        .execute();

      // 2. Look for open file record
      const activeFile = await trx.selectFrom('files')
        .selectAll()
        .where('repository_id', '=', repositoryId)
        .where('path', '=', path)
        .where('valid_to_commit_id', 'is', null)
        .executeTakeFirst();

      if (activeFile && activeFile.content_hash === contentHash) {
        return activeFile.id; // Unchanged
      }

      // 3. Invalidate old file
      if (activeFile) {
        await trx.updateTable('files')
          .set({ valid_to_commit_id: currentCommitId })
          .where('id', '=', activeFile.id)
          .execute();
      }

      // 4. Insert new file record
      const newFile = await trx.insertInto('files')
        .values({
          repository_id: repositoryId,
          path,
          content_hash: contentHash,
          language,
          valid_from_commit_id: currentCommitId
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      return newFile.id;
    });
  }

}

module.exports = { PostgresGraphStore };
