const { scanCommit, generateSummary, mapDiffToNodes } = require('../../src/git/commit-scanner');

describe('commit-scanner', () => {
  describe('generateSummary', () => {
    test('detects removed class', () => {
      const diffStr = `
diff --git a/src/auth.py b/src/auth.py
index a1b2c3d..e4f5g6h 100644
--- a/src/auth.py
+++ b/src/auth.py
@@ -10,3 +10,0 @@
-class OldAuthenticator:
-    def login(self):
-        pass
`;
      const summary = generateSummary(diffStr);
      expect(summary).toContain('Removed class OldAuthenticator');
    });
  });

  describe('mapDiffToNodes', () => {
    let mockPgStore;
    const repositoryId = 'repo-1';
    const commitId = 'commit-1';

    beforeEach(() => {
      mockPgStore = {
        getSymbolsInFile: jest.fn()
      };
    });

    test('identifies modified symbols based on line overlap', async () => {
      const changes = {
        'src/app.js': { added: [10, 11], removed: [10] }
      };
      
      // Mock symbols in DB
      mockPgStore.getSymbolsInFile.mockResolvedValue([
        { qualified_name: 'src/app.js::main', start_line: 9, end_line: 15 }
      ]);

      const result = await mapDiffToNodes(changes, mockPgStore, repositoryId, commitId);
      
      expect(result.modified).toContain('src/app.js::main');
      expect(mockPgStore.getSymbolsInFile).toHaveBeenCalledWith(repositoryId, commitId, 'src/app.js');
    });

    test('identifies added symbols', async () => {
      const changes = {
        'src/app.js': { added: [20, 21, 22], removed: [] }
      };
      
      mockPgStore.getSymbolsInFile.mockResolvedValue([
        { qualified_name: 'src/app.js::newFunc', start_line: 19, end_line: 25 }
      ]);

      const result = await mapDiffToNodes(changes, mockPgStore, repositoryId, commitId);
      
      expect(result.added).toContain('src/app.js::newFunc');
    });
  });
});
