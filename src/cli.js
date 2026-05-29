#!/usr/bin/env node

const { program } = require('commander');

program
  .name('codegraphx')
  .description('CodeGraphX - Codebase graphing and analysis tool')
  .version('1.0.0');

async function runScan() {
  const path = require('path');
  const { loadConfig } = require('./utils');
  const { runScan: doScan } = require('./scanner'); 
  
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);
  
  console.log('🔍 Scanning codebase...');
  const result = await doScan(projectRoot, config, false); 
  
  console.log(`✅ CodeGraph outputs written to ${path.relative(projectRoot, config.outputDir)}`);
}

program
  .command('init')
  .description('Initialize the code graph project')
  .action(async () => { await runScan(); });

program
  .command('scan')
  .description('One-off scan of codebase (identical to init)')
  .action(async () => { await runScan(); });

program
  .command('dashboard')
  .description('Open the static codegraph.html dashboard in your browser')
  .action(() => {
    const path = require('path');
    const fs = require('fs');
    const { exec } = require('child_process');
    const outputDir = path.join(process.cwd(), '.codegraphx');
    const htmlFile = path.join(outputDir, 'codegraph.html');
    if (!fs.existsSync(htmlFile)) {
      console.error('No codegraph.html found, run `codegraphx scan` first.');
      process.exit(1);
    }
    const openCmd =
      process.platform === 'darwin' ? 'open' :
      process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${openCmd} "${htmlFile}"`);
    console.log('Opening codegraph.html dashboard...');
  });

program
  .command('stats')
  .description('Print codebase/symbol/edge stats summary to console')
  .action(async () => {
    const { db } = require('./db');
    try {
      const fileCountRes = await db.selectFrom('files').select(db.fn.count('id').as('count')).where('valid_to_commit_id', 'is', null).executeTakeFirst();
      const symbolCountRes = await db.selectFrom('symbols').select(db.fn.count('id').as('count')).where('valid_to_commit_id', 'is', null).executeTakeFirst();
      const funcCountRes = await db.selectFrom('symbols').select(db.fn.count('id').as('count')).where('kind', '=', 'function').where('valid_to_commit_id', 'is', null).executeTakeFirst();
      const classCountRes = await db.selectFrom('symbols').select(db.fn.count('id').as('count')).where('kind', '=', 'class').where('valid_to_commit_id', 'is', null).executeTakeFirst();
      const edgeCountRes = await db.selectFrom('edges').select(db.fn.count('id').as('count')).where('valid_to_commit_id', 'is', null).executeTakeFirst();

      const fileCount = fileCountRes ? fileCountRes.count : 0;
      const symbolCount = symbolCountRes ? symbolCountRes.count : 0;
      const funcCount = funcCountRes ? funcCountRes.count : 0;
      const classCount = classCountRes ? classCountRes.count : 0;
      const edgeCount = edgeCountRes ? edgeCountRes.count : 0;

      console.log(`CodeGraphX Stats:\n  Files: ${fileCount}\n  Symbols: ${symbolCount}\n    - Functions: ${funcCount}\n    - Classes: ${classCount}\n  Edges: ${edgeCount}`);
      process.exit(0);
    } catch (e) {
      console.error('Error fetching stats from database:', e.message);
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Analyse the codebase graph and report missing imports, unresolved calls, and parse errors')
  .option('--json', 'Output the report as JSON instead of pretty-printed text')
  .option('--no-calls', 'Skip reporting unresolved call targets (reduces noise)')
  .option('--strict', 'Exit with code 1 if any issues are found (useful in CI)')
  .action((options) => {
    const path = require('path');
    const { loadConfig } = require('./utils');
    const { GraphStore } = require('./store');
    const { runDoctor, printReport } = require('./doctor');

    const projectRoot = process.cwd();
    const config      = loadConfig(projectRoot);
    const store       = new GraphStore(projectRoot, config);
    const filesData   = store.getFilesData();

    if (filesData.length === 0) {
      console.error('No graph data found. Run `codegraphx scan` first.');
      process.exit(1);
    }

    const report = runDoctor(filesData, projectRoot);

    if (options.calls === false) {
      report.issues.unresolvedCalls  = [];
      report.summary.unresolvedCalls = 0;
      report.summary.totalIssues     =
        report.summary.parseErrors + report.summary.missingImports;
      report.summary.healthy         = report.summary.totalIssues === 0;
    }

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printReport(report);
    }

    if (options.strict && !report.summary.healthy) {
      process.exit(1);
    }
  });

program
  .command('watch')
  .description('Watch Python files and auto-update graph on change')
  .action(async () => {
    await require('./watch')();
  });

program
  .command('query <symbol>')
  .description('Show details (files, edges, calls, called_by) for a symbol')
  .action(async (sym) => {
    const { db } = require('./db');
    const matches = await db.selectFrom('symbols as s')
      .innerJoin('files as f', 's.file_id', 'f.id')
      .selectAll('s')
      .select('f.path as file_path')
      .where('s.name', '=', sym)
      .where('s.valid_to_commit_id', 'is', null)
      .execute();

    if (!matches.length) {
      console.error(`No symbol named "${sym}" found.`);
      process.exit(1);
    }

    for (const match of matches) {
      console.log(`\nFile: ${match.file_path}`);
      console.log(`Type: ${match.kind}`);
      console.log(`Qualified Name: ${match.qualified_name}`);
      console.log(`Location: row ${match.start_line + 1}`);
      
      const outgoing = await db.selectFrom('edges as e')
        .innerJoin('symbols as s', 'e.to_symbol_id', 's.id')
        .select('s.qualified_name')
        .where('e.from_symbol_id', '=', match.id)
        .where('e.valid_to_commit_id', 'is', null)
        .execute();
      
      const incoming = await db.selectFrom('edges as e')
        .innerJoin('symbols as s', 'e.from_symbol_id', 's.id')
        .select('s.qualified_name')
        .where('e.to_symbol_id', '=', match.id)
        .where('e.valid_to_commit_id', 'is', null)
        .execute();

      if (outgoing.length) console.log(`Calls: ${outgoing.map(o => o.qualified_name).join(', ')}`);
      if (incoming.length) console.log(`Called by: ${incoming.map(i => i.qualified_name).join(', ')}`);
    }
    process.exit(0);
  });

program
  .command('impact <symbol>')
  .description('Trace all symbols directly/indirectly impacted by <symbol>')
  .option('-d, --direction <direction>', 'Direction to trace: downstream (callees) or upstream (callers)', 'downstream')
  .option('--depth <depth>', 'Maximum recursion depth', '5')
  .action(async (sym, options) => {
    const { db } = require('./db');
    const { PostgresGraphStore } = require('./store/postgres-store');
    const pgStore = new PostgresGraphStore(db);

    const matches = await db.selectFrom('symbols')
      .selectAll()
      .where('name', '=', sym)
      .where('valid_to_commit_id', 'is', null)
      .execute();

    if (!matches.length) {
      console.error(`No symbol named "${sym}" found.`);
      process.exit(1);
    }

    const repo = await db.selectFrom('repositories').selectAll().limit(1).executeTakeFirst();
    if (!repo) {
       console.error('No repository found in database.');
       process.exit(1);
    }

    for (const match of matches) {
      console.log(`\nImpact analysis for ${match.qualified_name} (${options.direction}):`);
      const impact = await pgStore.traceImpact(repo.id, match.id, options.direction, parseInt(options.depth, 10));
      if (!impact.length) {
        console.log('  No impact detected.');
      } else {
        impact.forEach(s => {
          console.log(`  - ${s.qualified_name} (${s.kind})`);
        });
      }
    }
    process.exit(0);
  });

program
  .command('git-hook <action>')
  .description('Install/remove post-commit and pre-push hooks to auto-run codegraphx scan')
  .action((action) => {
    const fs = require('fs');
    const path = require('path');
    if (!['install', 'remove'].includes(action)) {
      console.error(`Unknown action: ${action}. Use "install" or "remove".`);
      process.exit(1);
    }
    const hooks = ['post-commit', 'pre-push'];
    const hookScript = `#!/bin/sh\ncommand -v codegraphx > /dev/null && codegraphx scan\n`;
    
    if (action === 'install') {
      hooks.forEach(hook => {
        const hookPath = path.join(process.cwd(), '.git', 'hooks', hook);
        fs.writeFileSync(hookPath, hookScript, { mode: 0o755 });
      });
      console.log('✅ post-commit and pre-push hooks installed (runs codegraphx scan).');
    } else if (action === 'remove') {
      hooks.forEach(hook => {
        const hookPath = path.join(process.cwd(), '.git', 'hooks', hook);
        if (fs.existsSync(hookPath)) {
          fs.unlinkSync(hookPath);
        }
      });
      console.log('✅ post-commit and pre-push hooks removed.');
    }
  });

program
  .command('session summary')
  .description('Output a structural summary of changes in the current session/commit')
  .option('-b, --branch <branch>', 'Branch to compare against', 'HEAD')
  .action(async (options) => {
    const { loadConfig } = require('./utils');
    const { PostgresGraphStore } = require('./store/postgres-store');
    const { scanCommit } = require('./git/commit-scanner');
    const { db } = require('./db');
    
    const projectRoot = process.cwd();
    const pgStore = new PostgresGraphStore(db);
    const repo = await db.selectFrom('repositories').selectAll().limit(1).executeTakeFirst();
    
    if (!repo) {
      console.error('No repository found. Run scan first.');
      process.exit(1);
    }

    const summary = await scanCommit(projectRoot, pgStore, repo.id, options.branch);
    if (!summary) {
      console.log('No changes detected or not a git repository.');
      return;
    }
    
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  });

program
  .command('verify')
  .description('Generate task verification evidence for an AI agent')
  .requiredOption('--task <description>', 'The task description to verify')
  .requiredOption('--commit <hash>', 'The commit hash containing the changes')
  .action(async (options) => {
    const { getVerificationEvidence } = require('./verifier');
    const { PostgresGraphStore } = require('./store/postgres-store');
    const { db } = require('./db');
    
    const pgStore = new PostgresGraphStore(db);
    
    const repo = await db.selectFrom('repositories').selectAll().limit(1).executeTakeFirst();
    if (!repo) {
       console.error('No repository found in database. Run scan first.');
       process.exit(1);
    }

    const commitRow = await db.selectFrom('commits').selectAll().where('hash', '=', options.commit).executeTakeFirst();
    if (!commitRow) {
       console.error(`Commit ${options.commit} not found in graph database.`);
       process.exit(1);
    }

    const result = await getVerificationEvidence(pgStore, repo.id, commitRow.id, options.task);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  });

program.parse(process.argv);
