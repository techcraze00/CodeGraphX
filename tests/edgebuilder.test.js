const { buildEdges } = require('../src/edgebuilder');

describe('EdgeBuilder', () => {
  const mockFiles = [
    {
      file: 'a.js',
      symbols: [
        { id: 'js::a.js::global::f1', name: 'f1', type: 'function', calls: ['f2'] }
      ]
    },
    {
      file: 'b.js',
      symbols: [
        { id: 'js::b.js::global::f2', name: 'f2', type: 'function', calls: [] }
      ]
    }
  ];

  test('buildEdges should create CALLS edges', () => {
    const edges = buildEdges(mockFiles);
    const calls = edges.filter(e => e.type === 'CALLS');
    expect(calls).toHaveLength(1);
    expect(calls[0].from).toBe('js::a.js::global::f1');
    expect(calls[0].to).toBe('js::b.js::global::f2');
  });

  test('buildEdges should create IMPORTS edges', () => {
    const filesWithImports = [
      { path: 'a.js', imports: ['./b.js'] }
    ];
    const edges = buildEdges(filesWithImports);
    const imports = edges.filter(e => e.type === 'IMPORTS');
    expect(imports).toHaveLength(1);
    expect(imports[0].from).toBe('a.js');
    expect(imports[0].to).toBe('./b.js');
  });

  test('buildEdges should create INHERITS edges from ontology', () => {
    const filesWithInheritance = [
      {
        file: 'a.ts',
        symbols: [
          { 
            id: 'ts::a.ts::global::Sub', 
            name: 'Sub', 
            type: 'class', 
            ontology: [{ type: 'INHERITS', target: 'Base' }] 
          },
          {
            id: 'ts::a.ts::global::Base',
            name: 'Base',
            type: 'class'
          }
        ]
      }
    ];
    const edges = buildEdges(filesWithInheritance);
    const inherits = edges.filter(e => e.type === 'INHERITS');
    expect(inherits).toHaveLength(1);
    expect(inherits[0].from).toBe('ts::a.ts::global::Sub');
    expect(inherits[0].to).toBe('ts::a.ts::global::Base');
  });
});
