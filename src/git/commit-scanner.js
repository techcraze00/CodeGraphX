const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { CommitEntity } = require('../entities');

function runGit(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch (e) {
    return '';
  }
}

function parseDiff(diffStr) {
  const changes = {}; // filepath -> { added: [lines], removed: [lines] }
  let currentFile = null;

  const lines = diffStr.split('\n');
  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      const match = line.match(/ b\/(.+)$/);
      if (match) {
        currentFile = match[1];
        changes[currentFile] = { added: [], removed: [] };
      }
    } else if (currentFile && line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        let oldLine = parseInt(match[1], 10);
        let newLine = parseInt(match[2], 10);
        changes[currentFile]._oldCursor = oldLine;
        changes[currentFile]._newCursor = newLine;
      }
    } else if (currentFile && line.startsWith('+') && !line.startsWith('+++')) {
      if (changes[currentFile]._newCursor) {
        changes[currentFile].added.push(changes[currentFile]._newCursor);
        changes[currentFile]._newCursor++;
      }
    } else if (currentFile && line.startsWith('-') && !line.startsWith('---')) {
      if (changes[currentFile]._oldCursor) {
        changes[currentFile].removed.push(changes[currentFile]._oldCursor);
        changes[currentFile]._oldCursor++;
      }
    } else if (currentFile && !line.startsWith('\\')) {
      if (changes[currentFile]._newCursor) changes[currentFile]._newCursor++;
      if (changes[currentFile]._oldCursor) changes[currentFile]._oldCursor++;
    }
  }

  for (const file in changes) {
    delete changes[file]._oldCursor;
    delete changes[file]._newCursor;
  }
  return changes;
}

async function mapDiffToNodes(changes, pgStore, repositoryId, commitId) {
  const added = [];
  const removed = [];
  const modified = [];
  
  for (const [file, diff] of Object.entries(changes)) {
    const symbols = await pgStore.getSymbolsInFile(repositoryId, commitId, file);
    if (!symbols) continue;

    for (const sym of symbols) {
      const symRow = (sym.start_line || 0) + 1;
      
      const hasAdded = diff.added.some(l => Math.abs(l - symRow) <= 5);
      const hasRemoved = diff.removed.some(l => Math.abs(l - symRow) <= 5);
      
      if (hasAdded && !hasRemoved) {
        added.push(sym.qualified_name);
      } else if (hasRemoved && !hasAdded) {
        removed.push(sym.qualified_name);
      } else if (hasAdded && hasRemoved) {
        modified.push(sym.qualified_name);
      }
    }
  }
  return { added, removed, modified };
}

function generateSummary(diffStr) {
  const rules = [
    { regex: /^\+def (\w+)/gm, msg: "Added function" },
    { regex: /^\+class (\w+)/gm, msg: "Added class" },
    { regex: /^-def (\w+)/gm, msg: "Removed function" },
    { regex: /^-class (\w+)/gm, msg: "Removed class" },
    { regex: /^\+.*import (.+)/gm, msg: "Added import" }
  ];

  const summaries = [];
  for (const rule of rules) {
    let match;
    while ((match = rule.regex.exec(diffStr)) !== null) {
      summaries.push(`${rule.msg} ${match[1]}`);
    }
  }
  return summaries.join('; ') || 'Modified code logic';
}

async function scanCommit(projectRoot, pgStore, repositoryId, branch = 'HEAD') {
  const currentBranch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  const commitHash = runGit(['log', '-1', '--pretty=%H', branch]);
  
  const commit = await pgStore.db.selectFrom('commits')
    .selectAll()
    .where('hash', '=', commitHash)
    .executeTakeFirst();
    
  if (!commit) return null;

  const author = runGit(['log', '-1', '--pretty=%an', branch]);
  const timestamp = runGit(['log', '-1', '--pretty=%at', branch]);
  const message = runGit(['log', '-1', '--pretty=%s', branch]);
  const diffStr = runGit(['diff', `${branch}~1`, branch, '--unified=0']);
  
  if (!diffStr) return null;

  const changes = parseDiff(diffStr);
  const symbolChanges = await mapDiffToNodes(changes, pgStore, repositoryId, commit.id);
  const ruleSummary = generateSummary(diffStr);

  return new CommitEntity({
    hash: commitHash,
    author,
    timestamp: parseInt(timestamp, 10) * 1000,
    message,
    branch: currentBranch,
    changes: symbolChanges,
    summary: ruleSummary
  });
}

module.exports = { scanCommit, parseDiff, mapDiffToNodes, generateSummary };
