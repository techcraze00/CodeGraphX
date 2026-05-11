const { SymbolEntity, FileEntity, EdgeEntity } = require('../src/entities');

describe('SymbolEntity', () => {
  test('should initialize with correct values', () => {
    const sym = new SymbolEntity({
      id: 'js::file.js::global::test',
      name: 'test',
      type: 'function',
      file: 'file.js'
    });
    expect(sym.name).toBe('test');
    expect(sym.scope).toBe('global');
    expect(sym.id).toBe('js::file.js::global::test');
  });

  test('toJSON should return plain object', () => {
    const sym = new SymbolEntity({ id: '1', name: 'n', type: 't', file: 'f' });
    const json = sym.toJSON();
    expect(json).not.toBeInstanceOf(SymbolEntity);
    expect(json.id).toBe('1');
  });
});

describe('EdgeEntity', () => {
  test('should validate edge types', () => {
    expect(() => new EdgeEntity({ from: 'a', to: 'b', type: 'INVALID' }))
      .toThrow('Invalid edge type: INVALID');
  });

  test('should accept valid edge types', () => {
    const edge = new EdgeEntity({ from: 'a', to: 'b', type: 'CALLS' });
    expect(edge.type).toBe('CALLS');
  });
});

describe('FileEntity', () => {
  test('should initialize with symbols', () => {
    const file = new FileEntity({
      path: 'test.js',
      symbols: [{ id: '1', name: 's1', type: 'f', file: 'test.js' }]
    });
    expect(file.symbols[0]).toBeInstanceOf(SymbolEntity);
    expect(file.path).toBe('test.js');
  });
});
