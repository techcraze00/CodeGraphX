'use strict';

const os = require('os');
const path = require('path');
const { which, mergeJsonFile, copySkillFile } = require('../util');

const SERVER_NAME = 'codegraphx';

// Google Antigravity CLI (binary: `agy`) — the successor to the Gemini CLI.
// It shares the ~/.gemini home with the Antigravity IDE. MCP servers are
// configured by editing a JSON file (no native `agy mcp add` command):
//   global    -> ~/.gemini/config/mcp_config.json
//   workspace -> <cwd>/.agents/mcp_config.json
// Skills are SKILL.md folders under ~/.gemini/skills (shared) or .agents/skills.
module.exports = {
  id: 'antigravity',
  label: 'Antigravity CLI',
  bin: 'agy',
  verifyHint: 'agy, then run: /mcp',

  detect() {
    const binPath = which('agy');
    const configDir = path.join(os.homedir(), '.gemini');
    return { installed: !!binPath, binPath, configDir };
  },

  configureMcp({ nodeBin, mcpEntry, scope, cwd }) {
    const file = scope === 'project'
      ? path.join(cwd, '.agents', 'mcp_config.json')
      : path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json');
    const { path: written, backedUp } = mergeJsonFile(file, (obj) => {
      obj.mcpServers = obj.mcpServers || {};
      obj.mcpServers[SERVER_NAME] = { command: nodeBin, args: [mcpEntry] };
    });
    return { ok: true, method: 'config file', msg: `wrote ${written}${backedUp ? ' (backup created)' : ''}` };
  },

  installSkill({ scope, cwd }) {
    const dest = scope === 'project'
      ? path.join(cwd, '.agents', 'skills', 'cgx', 'SKILL.md')
      : path.join(os.homedir(), '.gemini', 'skills', 'cgx', 'SKILL.md');
    const written = copySkillFile(dest);
    return { ok: true, path: written };
  },
};
