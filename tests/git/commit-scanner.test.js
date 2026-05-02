const { generateSummary } = require('../../src/git/commit-scanner');

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
