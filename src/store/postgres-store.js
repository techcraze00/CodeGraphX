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

  async updateSymbols(repositoryId, currentCommitId, fileId, newSymbols) {
    return await this.db.transaction().execute(async (trx) => {
      // Get currently active symbols for this file
      const activeSymbols = await trx.selectFrom('symbols')
        .selectAll()
        .where('file_id', '=', fileId)
        .where('valid_to_commit_id', 'is', null)
        .execute();

      const newSymbolsMap = new Map(newSymbols.map(s => [s.qualified_name, s]));
      const activeSymbolsMap = new Map(activeSymbols.map(s => [s.qualified_name, s]));

      const symbolsToClose = [];
      const symbolsToInsert = [];

      // 1. Identify which old symbols to close
      for (const oldSym of activeSymbols) {
        const newSym = newSymbolsMap.get(oldSym.qualified_name);
        if (!newSym || newSym.symbol_hash !== oldSym.symbol_hash) {
          symbolsToClose.push(oldSym.id);
        }
      }

      // 2. Close them
      if (symbolsToClose.length > 0) {
        await trx.updateTable('symbols')
          .set({ valid_to_commit_id: currentCommitId })
          .where('id', 'in', symbolsToClose)
          .execute();

        // ** NEW: Also close affected edges **
        await trx.updateTable('edges')
          .set({ valid_to_commit_id: currentCommitId })
          .where((eb) => eb.or([
            eb('from_symbol_id', 'in', symbolsToClose),
            eb('to_symbol_id', 'in', symbolsToClose)
          ]))
          .where('valid_to_commit_id', 'is', null)
          .execute();
      }

      // 3. Identify which new symbols to insert
      for (const newSym of newSymbols) {
        const oldSym = activeSymbolsMap.get(newSym.qualified_name);
        if (!oldSym || oldSym.symbol_hash !== newSym.symbol_hash) {
          symbolsToInsert.push({
            repository_id: repositoryId,
            file_id: fileId,
            valid_from_commit_id: currentCommitId,
            ...newSym
          });
        }
      }

      if (symbolsToInsert.length > 0) {
        await trx.insertInto('symbols').values(symbolsToInsert).execute();
      }
    });
  }

  async updateEdges(repositoryId, currentCommitId, newEdges) {
    if (newEdges.length === 0) return;
    
    const edgesToInsert = newEdges.map(e => ({
      repository_id: repositoryId,
      valid_from_commit_id: currentCommitId,
      ...e
    }));

    await this.db.insertInto('edges').values(edgesToInsert).execute();
  }
}

module.exports = { PostgresGraphStore };
