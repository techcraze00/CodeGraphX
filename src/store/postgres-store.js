class PostgresGraphStore {
  constructor(db) {
    this.db = db;
  }

  async addCommit(repositoryId, hash, message, author = 'System', branch = 'main') {
    const existing = await this.db.selectFrom('commits')
      .selectAll()
      .where('hash', '=', hash)
      .where('repository_id', '=', repositoryId)
      .executeTakeFirst();
      
    if (existing) return existing.id;

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

  async getSymbolsInFile(repositoryId, commitId, path) {
    const commit = await this.db.selectFrom('commits').selectAll().where('id', '=', commitId).executeTakeFirstOrThrow();

    return await this.db.selectFrom('symbols as s')
      .innerJoin('files as f', 's.file_id', 'f.id')
      .innerJoin('commits as c_from', 's.valid_from_commit_id', 'c_from.id')
      .leftJoin('commits as c_to', 's.valid_to_commit_id', 'c_to.id')
      .selectAll('s')
      .where('s.repository_id', '=', repositoryId)
      .where('f.path', '=', path)
      .where('c_from.timestamp', '<=', commit.timestamp)
      .where((eb) => eb.or([
        eb('c_to.id', 'is', null),
        eb('c_to.timestamp', '>', commit.timestamp)
      ]))
      .execute();
  }

  async getChangesInCommit(repositoryId, commitId) {
    const added = await this.db.selectFrom('symbols')
      .selectAll()
      .where('repository_id', '=', repositoryId)
      .where('valid_from_commit_id', '=', commitId)
      .where((eb) => eb.not(
        eb.exists(
          eb.selectFrom('symbols as s2')
            .select('s2.id')
            .where('s2.repository_id', '=', repositoryId)
            .whereRef('s2.qualified_name', '=', 'symbols.qualified_name')
            .where('s2.valid_to_commit_id', '=', commitId)
        )
      ))
      .execute();

    const modified = await this.db.selectFrom('symbols')
      .selectAll()
      .where('repository_id', '=', repositoryId)
      .where('valid_from_commit_id', '=', commitId)
      .where((eb) => eb.exists(
        eb.selectFrom('symbols as s2')
          .select('s2.id')
          .where('s2.repository_id', '=', repositoryId)
          .whereRef('s2.qualified_name', '=', 'symbols.qualified_name')
          .where('s2.valid_to_commit_id', '=', commitId)
      ))
      .execute();

    const removed = await this.db.selectFrom('symbols')
      .selectAll()
      .where('repository_id', '=', repositoryId)
      .where('valid_to_commit_id', '=', commitId)
      .where((eb) => eb.not(
        eb.exists(
          eb.selectFrom('symbols as s2')
            .select('s2.id')
            .where('s2.repository_id', '=', repositoryId)
            .whereRef('s2.qualified_name', '=', 'symbols.qualified_name')
            .where('s2.valid_from_commit_id', '=', commitId)
        )
      ))
      .execute();

    return { added, modified, removed };
  }

  async traceImpact(repositoryId, symbolId, direction = 'downstream', maxDepth = 5) {
    const { sql } = require('kysely');
    
    // Recursive CTE for impact tracing
    // direction 'downstream' = follow to_symbol_id (callees)
    // direction 'upstream' = follow from_symbol_id (callers)
    const fromCol = direction === 'downstream' ? 'from_symbol_id' : 'to_symbol_id';
    const toCol = direction === 'downstream' ? 'to_symbol_id' : 'from_symbol_id';

    const result = await sql`
      WITH RECURSIVE impact_graph AS (
        -- Base case: the starting symbol
        SELECT 
          ${sql.id(toCol)} as symbol_id, 
          1 as depth
        FROM edges
        WHERE ${sql.id(fromCol)} = ${symbolId}
          AND repository_id = ${repositoryId}
          AND valid_to_commit_id IS NULL

        UNION

        -- Recursive step
        SELECT 
          e.${sql.id(toCol)} as symbol_id, 
          ig.depth + 1
        FROM edges e
        INNER JOIN impact_graph ig ON e.${sql.id(fromCol)} = ig.symbol_id
        WHERE ig.depth < ${maxDepth}
          AND e.repository_id = ${repositoryId}
          AND e.valid_to_commit_id IS NULL
      )
      SELECT DISTINCT s.*
      FROM symbols s
      INNER JOIN impact_graph ig ON s.id = ig.symbol_id
      WHERE s.valid_to_commit_id IS NULL
    `.execute(this.db);

    return result.rows;
  }

  async getFilesAtCommit(repositoryId, commitId) {
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
      await trx.insertInto('file_blobs')
        .values({
          content_hash: contentHash,
          storage_type: 'local_fs'
        })
        .onConflict((oc) => oc.column('content_hash').doNothing())
        .execute();

      const activeFile = await trx.selectFrom('files')
        .selectAll()
        .where('repository_id', '=', repositoryId)
        .where('path', '=', path)
        .where('valid_to_commit_id', 'is', null)
        .executeTakeFirst();

      if (activeFile && activeFile.content_hash === contentHash) {
        return activeFile.id;
      }

      if (activeFile) {
        await trx.updateTable('files')
          .set({ valid_to_commit_id: currentCommitId })
          .where('id', '=', activeFile.id)
          .execute();
      }

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
      const activeSymbols = await trx.selectFrom('symbols')
        .selectAll()
        .where('file_id', '=', fileId)
        .where('valid_to_commit_id', 'is', null)
        .execute();

      const newSymbolsMap = new Map(newSymbols.map(s => [s.qualified_name, s]));
      const activeSymbolsMap = new Map(activeSymbols.map(s => [s.qualified_name, s]));

      const symbolsToClose = [];
      const symbolsToInsert = [];

      for (const oldSym of activeSymbols) {
        const newSym = newSymbolsMap.get(oldSym.qualified_name);
        if (!newSym || newSym.symbol_hash !== oldSym.symbol_hash) {
          symbolsToClose.push(oldSym.id);
        }
      }

      if (symbolsToClose.length > 0) {
        await trx.updateTable('symbols')
          .set({ valid_to_commit_id: currentCommitId })
          .where('id', 'in', symbolsToClose)
          .execute();

        await trx.updateTable('edges')
          .set({ valid_to_commit_id: currentCommitId })
          .where((eb) => eb.or([
            eb('from_symbol_id', 'in', symbolsToClose),
            eb('to_symbol_id', 'in', symbolsToClose)
          ]))
          .where('valid_to_commit_id', 'is', null)
          .execute();
      }

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
