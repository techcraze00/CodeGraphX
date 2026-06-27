'use strict';

const path = require('path');

const ADAPTERS = [
  require('./adapters/claude'),
  require('./adapters/gemini'),
  require('./adapters/antigravity'),
  require('./adapters/opencode'),
  require('./adapters/cursor'),
];

function byId(id) {
  return ADAPTERS.find((a) => a.id === id);
}

/** Parse --agents "claude,gemini" into a deduped, validated id list. */
function parseAgentList(str) {
  const ids = String(str)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const out = [];
  for (const id of ids) {
    const a = byId(id);
    if (!a) {
      console.error(`⚠️  Unknown agent "${id}" — known: ${ADAPTERS.map((x) => x.id).join(', ')}`);
      continue;
    }
    if (!out.includes(a.id)) out.push(a.id);
  }
  return out;
}

/** Interactive multi-select via @clack/prompts. Returns array of ids, or null on cancel. */
async function promptSelection(detections) {
  let clack;
  try {
    clack = require('@clack/prompts');
  } catch (_) {
    return null; // dependency unavailable — caller falls back
  }

  clack.intro('CodeGraphX setup');
  const options = ADAPTERS.map((a) => {
    const det = detections[a.id];
    return {
      value: a.id,
      label: a.label,
      hint: det.installed ? 'detected' : 'not found',
    };
  });
  const initial = ADAPTERS.filter((a) => detections[a.id].installed).map((a) => a.id);

  const picked = await clack.multiselect({
    message: 'Select the coding CLIs to configure for CodeGraphX:',
    options,
    initialValues: initial,
    required: false,
  });

  if (clack.isCancel(picked)) {
    clack.cancel('Setup cancelled.');
    return null;
  }
  clack.outro('Configuring…');
  return picked;
}

async function runSetup(opts = {}) {
  const cwd = process.cwd();
  const nodeBin = process.execPath;
  const mcpEntry = path.resolve(__dirname, '../../bin/cgx-mcp');
  const scope = opts.project ? 'project' : 'user';

  // 1. Detect every adapter.
  const detections = {};
  for (const a of ADAPTERS) {
    try {
      detections[a.id] = a.detect();
    } catch (e) {
      detections[a.id] = { installed: false, error: e.message };
    }
  }

  // 2. Resolve which agents to configure.
  let selected;
  if (opts.agents) {
    selected = parseAgentList(opts.agents);
  } else if (opts.yes || !process.stdin.isTTY) {
    selected = ADAPTERS.filter((a) => detections[a.id].installed).map((a) => a.id);
    if (!opts.yes) {
      console.log('ℹ️  Non-interactive terminal — configuring all detected agents.');
    }
  } else {
    selected = await promptSelection(detections);
    if (selected === null) {
      // prompt unavailable or cancelled
      selected = ADAPTERS.filter((a) => detections[a.id].installed).map((a) => a.id);
      if (!selected.length) {
        console.error('No coding CLIs detected and no --agents specified. Nothing to do.');
        process.exitCode = 1;
        return;
      }
    }
  }

  if (!selected.length) {
    console.log('No agents selected. Nothing to do.');
    return;
  }

  console.log(`\nCodeGraphX → wiring MCP server: ${nodeBin} ${mcpEntry}`);
  console.log(`Scope: ${scope}${scope === 'project' ? ` (${cwd})` : ' (global, resolves project from cwd at launch)'}\n`);

  // 3. Configure each selected adapter.
  const results = [];
  for (const id of selected) {
    const a = byId(id);
    const r = { id, label: a.label, verifyHint: a.verifyHint };
    if (!detections[id].installed) {
      console.log(`• ${a.label}: not detected on PATH — configuring anyway (will activate once installed).`);
    }
    try {
      r.mcp = a.configureMcp({ nodeBin, mcpEntry, scope, cwd });
    } catch (e) {
      r.mcp = { ok: false, msg: e.message };
    }
    try {
      r.skill = a.installSkill({ scope, cwd });
    } catch (e) {
      r.skill = { ok: false, path: e.message };
    }
    results.push(r);
  }

  // 4. Summary + verification.
  console.log('\n──────── CodeGraphX setup complete ────────');
  for (const r of results) {
    const mcpLine = r.mcp.ok ? `✅ MCP via ${r.mcp.method} — ${r.mcp.msg}` : `❌ MCP failed — ${r.mcp.msg}`;
    const skillLine = r.skill.ok ? `✅ skill → ${r.skill.path}` : `❌ skill failed — ${r.skill.path}`;
    console.log(`\n${r.label}`);
    console.log(`  ${mcpLine}`);
    console.log(`  ${skillLine}`);
    console.log(`  verify: ${r.verifyHint}`);
  }

  console.log('\nNext steps:');
  console.log('  1. Open your coding CLI inside any project directory.');
  console.log('  2. Ask it: "use cgx to explore this codebase" (list files, explain_impact, verify_task).');
  console.log('  3. The graph auto-indexes on first tool call; run `cgx scan` to pre-build it.\n');
}

module.exports = { runSetup, ADAPTERS, parseAgentList };
