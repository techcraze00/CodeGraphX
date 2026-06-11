const { computeDelta, computeHash } = require('../src/differ');

describe('Differ', () => {
  test('computeHash should return sha1 hex', () => {
    const hash = computeHash('test');
    expect(hash).toHaveLength(40);
    expect(hash).toBe('a94a8fe5ccb19ba61c4c0873d391e987982fbbd3');
  });

  test('computeDelta should detect additions', () => {
    const oldNodes = [];
    const newNodes = [{ type: 'function', name: 'f1', startPosition: { row: 0, column: 0 } }];
    const delta = computeDelta(oldNodes, newNodes);
    expect(delta.added).toHaveLength(1);
    expect(delta.added[0].name).toBe('f1');
  });

  test('computeDelta should detect removals', () => {
    const oldNodes = [{ type: 'function', name: 'f1', startPosition: { row: 0, column: 0 } }];
    const newNodes = [];
    const delta = computeDelta(oldNodes, newNodes);
    expect(delta.removed).toHaveLength(1);
    expect(delta.removed[0].name).toBe('f1');
  });

  test('computeDelta should detect modifications in position', () => {
    const oldNodes = [{ type: 'function', name: 'f1', startPosition: { row: 0, column: 0 } }];
    const newNodes = [{ type: 'function', name: 'f1', startPosition: { row: 1, column: 0 } }];
    const delta = computeDelta(oldNodes, newNodes);
    expect(delta.modified).toHaveLength(1);
    expect(delta.modified[0].name).toBe('f1');
  });
});
