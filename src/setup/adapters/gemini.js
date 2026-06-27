'use strict';

const os = require('os');
const path = require('path');
const { which, runCli, mergeJsonFile, upsertMarkdownBlock } = require('../util');

const SERVER_NAME = 'codegraphx';

module.exports = {
  id: 'gemini',
  label: 'Gemini CLI',
  bin: 'gemini',
  verifyHint: 'gemini, then run: /mcp list',

  detect() {
    const binPath = which('gemini');
    const configDir = path.join(os.homedir(), '.gemini');
    return { installed: !!binPath, binPath, configDir };
  },

  configureMcp({ nodeBin, mcpEntry, scope, cwd }) {
    // Native CLI command first.
    if (which('gemini')) {
      const cliScope = scope === 'project' ? 'project' : 'user';
      const res = runCli('gemini', [
        'mcp', 'add', '-s', cliScope, '-t', 'stdio', SERVER_NAME, nodeBin, mcpEntry,
      ], { cwd });
      if (res.ok) return { ok: true, method: 'gemini mcp add', msg: `registered (scope=${cliScope})` };
    }

    // File fallback. Absolute node path is the documented fix for Gemini ignoring shell PATH.
    const file = scope === 'project'
      ? path.join(cwd, '.gemini', 'settings.json')
      : path.join(os.homedir(), '.gemini', 'settings.json');
    const { path: written, backedUp } = mergeJsonFile(file, (obj) => {
      obj.mcpServers = obj.mcpServers || {};
      obj.mcpServers[SERVER_NAME] = { command: nodeBin, args: [mcpEntry] };
    });
    return { ok: true, method: 'config file', msg: `wrote ${written}${backedUp ? ' (backup created)' : ''}` };
  },

  installSkill({ scope, cwd }) {
    // Gemini reads GEMINI.md context files (no skills system).
    const file = scope === 'project'
      ? path.join(cwd, 'GEMINI.md')
      : path.join(os.homedir(), '.gemini', 'GEMINI.md');
    const { path: written } = upsertMarkdownBlock(file);
    return { ok: true, path: written };
  },
};
