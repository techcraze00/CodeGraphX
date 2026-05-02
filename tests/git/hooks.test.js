const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('git-hook command', () => {
  const testDir = path.join(__dirname, 'test-repo');
  const hooksDir = path.join(testDir, '.git', 'hooks');
  const cliPath = path.resolve(__dirname, '../../src/cli.js');

  beforeAll(() => {
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('installs post-commit and pre-push hooks', () => {
    // Run the install command in the test repo
    execSync(`node "${cliPath}" git-hook install`, { cwd: testDir });
    
    // Verify files exist
    expect(fs.existsSync(path.join(hooksDir, 'post-commit'))).toBe(true);
    expect(fs.existsSync(path.join(hooksDir, 'pre-push'))).toBe(true);
    // Ensure pre-commit is removed if it existed, or just that we moved to post-commit
  });
});
