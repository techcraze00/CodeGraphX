'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

/** Absolute path to the bundled cgx skill source. */
const SKILL_SRC = path.resolve(__dirname, '../../skills/cgx/SKILL.md');

/** Expand a leading ~ to the user's home directory. */
function tildeExpand(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2));
  return p;
}

/** Create a directory (recursively) if it does not exist. */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Locate an executable on PATH.
 * Returns the resolved path string, or null if not found.
 */
function which(bin) {
  const probe = process.platform === 'win32' ? 'where' : 'command';
  const args = process.platform === 'win32' ? [bin] : ['-v', bin];
  try {
    const res = spawnSync(probe, args, { encoding: 'utf8', shell: process.platform === 'win32' });
    if (res.status === 0 && res.stdout) {
      return res.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] || null;
    }
  } catch (_) {
    /* ignore */
  }
  return null;
}

/**
 * Run a CLI command, capturing output. Never throws.
 * @returns {{ok: boolean, status: number|null, stdout: string, stderr: string}}
 */
function runCli(cmd, args, opts = {}) {
  try {
    const res = spawnSync(cmd, args, { encoding: 'utf8', timeout: 30000, ...opts });
    return {
      ok: res.status === 0,
      status: res.status,
      stdout: res.stdout || '',
      stderr: res.stderr || (res.error ? String(res.error.message) : ''),
    };
  } catch (e) {
    return { ok: false, status: null, stdout: '', stderr: String(e.message || e) };
  }
}

/**
 * Read-modify-write a JSON file safely.
 * - Missing file -> starts from {}.
 * - Backs up an existing file to <file>.cgx-bak once (never overwrites an existing backup).
 * - `mutator(obj)` mutates the parsed object in place (or returns a replacement).
 * @returns {{path: string, backedUp: boolean}}
 */
function mergeJsonFile(file, mutator) {
  const target = tildeExpand(file);
  ensureDir(path.dirname(target));

  let obj = {};
  let existed = false;
  if (fs.existsSync(target)) {
    existed = true;
    const raw = fs.readFileSync(target, 'utf8').trim();
    if (raw) {
      try {
        obj = JSON.parse(raw);
      } catch (e) {
        throw new Error(`${target} is not valid JSON (${e.message}); refusing to overwrite`);
      }
    }
  }

  let backedUp = false;
  if (existed) {
    const bak = `${target}.cgx-bak`;
    if (!fs.existsSync(bak)) {
      fs.copyFileSync(target, bak);
      backedUp = true;
    }
  }

  const result = mutator(obj) || obj;
  fs.writeFileSync(target, JSON.stringify(result, null, 2) + '\n', 'utf8');
  return { path: target, backedUp };
}

/** Raw skill markdown (with YAML frontmatter), as shipped. */
function getSkillFile() {
  return fs.readFileSync(SKILL_SRC, 'utf8');
}

/** Skill markdown body, frontmatter stripped — for CLIs without a skills system. */
function getSkillBody() {
  const raw = getSkillFile();
  return raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
}

/**
 * cgx instruction block for context files (GEMINI.md / AGENTS.md / Cursor rules).
 * Wrapped in stable markers so it can be merged idempotently.
 */
const BLOCK_START = '<!-- codegraphx:start -->';
const BLOCK_END = '<!-- codegraphx:end -->';

function getInstructionBlock() {
  return `${BLOCK_START}\n${getSkillBody()}\n${BLOCK_END}`;
}

/**
 * Insert or replace the cgx instruction block in a markdown context file.
 * Idempotent: re-running replaces the existing block instead of appending.
 * @returns {{path: string, action: 'created'|'updated'}}
 */
function upsertMarkdownBlock(file) {
  const target = tildeExpand(file);
  ensureDir(path.dirname(target));
  const block = getInstructionBlock();

  if (fs.existsSync(target)) {
    const cur = fs.readFileSync(target, 'utf8');
    const re = new RegExp(`${BLOCK_START}[\\s\\S]*?${BLOCK_END}`);
    if (re.test(cur)) {
      fs.writeFileSync(target, cur.replace(re, block), 'utf8');
      return { path: target, action: 'updated' };
    }
    const sep = cur.endsWith('\n') ? '\n' : '\n\n';
    fs.writeFileSync(target, cur + sep + block + '\n', 'utf8');
    return { path: target, action: 'updated' };
  }

  fs.writeFileSync(target, block + '\n', 'utf8');
  return { path: target, action: 'created' };
}

/** Copy the full SKILL.md (frontmatter intact) to a destination path. */
function copySkillFile(destFile) {
  const target = tildeExpand(destFile);
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, getSkillFile(), 'utf8');
  return target;
}

module.exports = {
  SKILL_SRC,
  tildeExpand,
  ensureDir,
  which,
  runCli,
  mergeJsonFile,
  getSkillFile,
  getSkillBody,
  getInstructionBlock,
  upsertMarkdownBlock,
  copySkillFile,
};
