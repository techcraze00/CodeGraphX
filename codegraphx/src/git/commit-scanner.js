const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

function mapDiffToNodes(changes, filesData) {
  const added = [];
  const removed = [];
  const modified = [];
  
  for (const [file, diff] of Object.entries(changes)) {
    const fileData = filesData.find(f => f.file === file);
    if (!fileData || !fileData.symbols) continue;

    for (const sym of fileData.symbols) {
      if (!sym.startPosition) continue;
      // startPosition.row is 0-based, diff lines are 1-based
      const symRow = sym.startPosition.row + 1;
      
      const hasAdded = diff.added.some(l => Math.abs(l - symRow) <= 5);
      const hasRemoved = diff.removed.some(l => Math.abs(l - symRow) <= 5);
      
      if (hasAdded && !hasRemoved) {
        added.push(`${file}::${sym.name}`);
      } else if (hasRemoved && !hasAdded) {
        removed.push(`${file}::${sym.name}`);
      } else if (hasAdded && hasRemoved) {
        modified.push(`${file}::${sym.name}`);
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

function scanCommit(projectRoot, store, branch = 'HEAD') {
  const currentBranch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  const commitHash = runGit(['log', '-1', '--pretty=%H', branch]);
  const diffStr = runGit(['diff', `${branch}~1`, branch, '--unified=0']);
  
  if (!diffStr) return null;

  const changes = parseDiff(diffStr);
  const { added, removed, modified } = mapDiffToNodes(changes, store.getFilesData());
  const ruleSummary = generateSummary(diffStr);

  return {
    date: new Date().toISOString(),
    commit: commitHash,
    branch: currentBranch,
    added,
    removed,
    modified,
    rule_summary: ruleSummary
  };
}

module.exports = { scanCommit, parseDiff, mapDiffToNodes, generateSummary };