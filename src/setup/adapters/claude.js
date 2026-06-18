'use strict';

const os = require('os');
const path = require('path');
const { which, runCli, mergeJsonFile, copySkillFile } = require('../util');

const SERVER_NAME = 'codegraphx';

module.exports = {
  id: 'claude',
  label: 'Claude Code',
  bin: 'claude',
  verifyHint: 'claude mcp list',

  detect() {
    const binPath = which('claude');
    const configDir = path.join(os.homedir(), '.claude');
    return { installed: !!binPath, binPath, configDir };
  },

  configureMcp({ nodeBin, mcpEntry, scope, cwd }) {
    // Prefer the native CLI command.
    if (which('claude')) {
      const cliScope = scope === 'project' ? 'project' : 'user';
      const res = runCli('claude', [
        'mcp', 'add', SERVER_NAME, '--scope', cliScope, '--', nodeBin, mcpEntry,
      ], { cwd });
      if (res.ok) return { ok: true, method: 'claude mcp add', msg: `registered (scope=${cliScope})` };
      // fall through to file fallback on failure
    }

    // File fallback.
    const file = scope === 'project'
      ? path.join(cwd, '.mcp.json')
      : path.join(os.homedir(), '.claude.json');
    const { path: written, backedUp } = mergeJsonFile(file, (obj) => {
      obj.mcpServers = obj.mcpServers || {};
      obj.mcpServers[SERVER_NAME] = { command: nodeBin, args: [mcpEntry] };
    });
    return { ok: true, method: 'config file', msg: `wrote ${written}${backedUp ? ' (backup created)' : ''}` };
  },

  installSkill() {
    // Skills are user-scoped in Claude Code.
    const dest = path.join(os.homedir(), '.claude', 'skills', 'cgx', 'SKILL.md');
    const written = copySkillFile(dest);
    return { ok: true, path: written };
  },
};
