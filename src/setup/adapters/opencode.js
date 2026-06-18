'use strict';

const os = require('os');
const path = require('path');
const { which, runCli, mergeJsonFile, upsertMarkdownBlock } = require('../util');

const SERVER_NAME = 'codegraphx';

function configDir() {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'opencode');
}

module.exports = {
  id: 'opencode',
  label: 'OpenCode',
  bin: 'opencode',
  verifyHint: 'opencode mcp list',

  detect() {
    const binPath = which('opencode');
    return { installed: !!binPath, binPath, configDir: configDir() };
  },

  configureMcp({ nodeBin, mcpEntry, scope, cwd }) {
    // Try the native command (arg surface still stabilizing); fall back to config file on any failure.
    if (which('opencode')) {
      const res = runCli('opencode', [
        'mcp', 'add', SERVER_NAME, '--', nodeBin, mcpEntry,
      ], { cwd });
      if (res.ok) return { ok: true, method: 'opencode mcp add', msg: 'registered' };
    }

    // File fallback — OpenCode `mcp` block, local stdio server.
    const file = scope === 'project'
      ? path.join(cwd, 'opencode.json')
      : path.join(configDir(), 'opencode.json');
    const { path: written, backedUp } = mergeJsonFile(file, (obj) => {
      if (!obj.$schema) obj.$schema = 'https://opencode.ai/config.json';
      obj.mcp = obj.mcp || {};
      obj.mcp[SERVER_NAME] = { type: 'local', command: [nodeBin, mcpEntry], enabled: true };
    });
    return { ok: true, method: 'config file', msg: `wrote ${written}${backedUp ? ' (backup created)' : ''}` };
  },

  installSkill({ scope, cwd }) {
    // OpenCode reads AGENTS.md.
    const file = scope === 'project'
      ? path.join(cwd, 'AGENTS.md')
      : path.join(configDir(), 'AGENTS.md');
    const { path: written } = upsertMarkdownBlock(file);
    return { ok: true, path: written };
  },
};
