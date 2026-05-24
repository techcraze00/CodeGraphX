// tests/context-builder.test.js
const { buildContext } = require('../src/context-builder');

describe('Context Builder', () => {
  it('should build a token-efficient context block from a commit', async () => {
    const mockPgStore = {
      getChangesInCommit: jest.fn().mockResolvedValue({
        added: [{ id: 1, qualified_name: 'src/app.js:startServer', kind: 'function' }],
        modified: [{ id: 2, qualified_name: 'src/app.js:configurePort', kind: 'function' }],
        removed: []
      }),
      traceImpact: jest.fn().mockResolvedValue([
        { id: 3, qualified_name: 'src/main.js:init', kind: 'function' }
      ])
    };

    const context = await buildContext(mockPgStore, 100, 200);

    expect(mockPgStore.getChangesInCommit).toHaveBeenCalledWith(100, 200);
    expect(mockPgStore.traceImpact).toHaveBeenCalledWith(100, 1, 'downstream', 3);
    expect(mockPgStore.traceImpact).toHaveBeenCalledWith(100, 2, 'downstream', 3);

    expect(context).toEqual({
      changed_nodes: {
        added: ['src/app.js:startServer (function)'],
        modified: ['src/app.js:configurePort (function)'],
        removed: []
      },
      blast_radius: {
        downstream: ['src/main.js:init (function)']
      }
    });
  });
});
