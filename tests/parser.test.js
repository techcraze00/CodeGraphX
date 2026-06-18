const fs = require('fs');
const path = require('path');
const { parseFile } = require('../src/parser');
// Reuse the globalThis-cached adapter singletons. Creating fresh adapters with
// `new` spins up native tree-sitter 0.21 Parser instances that get corrupted
// (empty parses) when GC'd under load from other suites — see src/languages/index.js.
const { getAdapterForFile, ADAPTERS } = require('../src/languages');

describe('CodeGraphX Parser System', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');

  describe('JavaScript Parsing', () => {
    test('extracts symbols from string', () => {
      const contents = `
        function start() { helper(); }
        class AuthService { login() {} }
      `;
      const adapter = ADAPTERS['.js'].adapter;
      const tree = adapter.parse(contents);
      const symbols = adapter.extractSymbols(tree, contents);
      
      expect(symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'start', type: 'function' }),
          expect.objectContaining({ name: 'AuthService', type: 'class' })
        ])
      );
    });

    test('extracts symbols from fixture', () => {
      const adapter = ADAPTERS['.js'].adapter;
      const content = fs.readFileSync(path.join(fixturesDir, 'javascript/sample.js'), 'utf8');
      const tree = adapter.parse(content);
      const symbols = adapter.extractSymbols(tree, content);

      expect(symbols.length).toBeGreaterThan(0);
      expect(symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'hello', type: 'function' }),
          expect.objectContaining({ name: 'Greeter', type: 'class' })
        ])
      );
    });

    test('JavaScript adapter extracts structured imports', () => {
      const adapter = ADAPTERS['.js'].adapter;
      const code = `
        import { login as authLogin } from "@/auth/service";
        import defaultExport from "module-name";
        import * as namespace from "namespace-module";
      `;
      const tree = adapter.parse(code);
      const imports = adapter.extractImports(tree, code);
      
      expect(imports).toEqual([
        { localName: 'authLogin', importedName: 'login', source: '@/auth/service' },
        { localName: 'defaultExport', importedName: 'default', source: 'module-name' },
        { localName: 'namespace', importedName: '*', source: 'namespace-module' }
      ]);
    });
  });

  describe('Python Parsing', () => {
    test('extracts symbols from fixture', () => {
      const adapter = ADAPTERS['.py'].adapter;
      const content = fs.readFileSync(path.join(fixturesDir, 'python/sample.py'), 'utf8');
      const tree = adapter.parse(content);
      const symbols = adapter.extractSymbols(tree, content);

      expect(symbols.length).toBeGreaterThan(0);
      expect(symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'hello', type: 'function' }),
          expect.objectContaining({ name: 'Greeter', type: 'class' })
        ])
      );
    });

    test('Python adapter extracts structured imports', () => {
      const adapter = ADAPTERS['.py'].adapter;
      const code = `
from auth.service import login as authLogin
import sys
import os as myos
      `;
      const tree = adapter.parse(code);
      const imports = adapter.extractImports(tree, code);
      
      expect(imports).toContainEqual({ localName: 'authLogin', importedName: 'login', source: 'auth.service' });
      expect(imports).toContainEqual({ localName: 'sys', importedName: '*', source: 'sys' });
      expect(imports).toContainEqual({ localName: 'myos', importedName: '*', source: 'os' });
    });
  });

  describe('TypeScript Parsing', () => {
    test('extracts symbols from fixture', () => {
      const adapter = ADAPTERS['.ts'].adapter;
      const content = fs.readFileSync(path.join(fixturesDir, 'typescript/sample.ts'), 'utf8');
      const tree = adapter.parse(content);
      const symbols = adapter.extractSymbols(tree, content);

      expect(symbols.length).toBeGreaterThan(0);
      expect(symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Greeter', type: 'class' }),
          expect.objectContaining({ name: 'AdvancedGreeter', type: 'class' })
        ])
      );
    });
  });

  describe('CSS Parsing', () => {
    test('extracts selectors', () => {
      const adapter = ADAPTERS['.css'].adapter;
      const contents = `.btn { color: red; } #id { width: 10px; }`;
      const tree = adapter.parse(contents);
      const symbols = adapter.extractSymbols(tree, contents);
      
      expect(symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: '.btn', type: 'class' }),
          expect.objectContaining({ name: '#id', type: 'id' })
        ])
      );
    });
  });

  test('parseFile returns standardized File-Level Symbol Table structure', () => {
    const { parseFile } = require('../src/parser.js');
    const result = parseFile('test.js', 'function test() { console.log(1); }');
    
    expect(result).toHaveProperty('exports');
    expect(result).toHaveProperty('imports');
    expect(result).toHaveProperty('declaredSymbols');
    expect(result).toHaveProperty('calls');
    
    expect(Array.isArray(result.exports)).toBe(true);
    expect(Array.isArray(result.imports)).toBe(true);
    expect(Array.isArray(result.declaredSymbols)).toBe(true);
    expect(Array.isArray(result.calls)).toBe(true);
  });
});
