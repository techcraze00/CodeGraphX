'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const { mergeJsonFile, getSkillBody, ensureDir } = require('../util');

const SERVER_NAME = 'codegraphx';

module.exports = {
  id: 'cursor',
  label: 'Cursor',
  bin: 'cursor',
  verifyHint: 'Reload Cursor → Settings → MCP → confirm "codegraphx" is enabled',

  detect() {
    // Cursor ships no PATH CLI for MCP; treat an existing ~/.cursor dir as "installed".
    const configDir = path.join(os.homedir(), '.cursor');
    return { installed: fs.existsSync(configDir), binPath: null, configDir };
  },

  configureMcp({ nodeBin, mcpEntry, scope, cwd }) {
    // File-only: global ~/.cursor/mcp.json or project .cursor/mcp.json.
    const file = scope === 'project'
      ? path.join(cwd, '.cursor', 'mcp.json')
      : path.join(os.homedir(), '.cursor', 'mcp.json');
    const { path: written, backedUp } = mergeJsonFile(file, (obj) => {
      obj.mcpServers = obj.mcpServers || {};
      obj.mcpServers[SERVER_NAME] = { command: nodeBin, args: [mcpEntry] };
    });
    return { ok: true, method: 'config file', msg: `wrote ${written}${backedUp ? ' (backup created)' : ''}` };
  },

  installSkill({ cwd }) {
    // Cursor rules are project-scoped (.cursor/rules/*.mdc).
    const dir = path.join(cwd, '.cursor', 'rules');
    ensureDir(dir);
    const file = path.join(dir, 'codegraphx.mdc');
    const content = `---\ndescription: Use CodeGraphX (cgx) MCP tools to explore this codebase\nalwaysApply: false\n---\n\n${getSkillBody()}\n`;
    fs.writeFileSync(file, content, 'utf8');
    return { ok: true, path: file };
  },
};
