const fs = require('fs');
const path = require('path');
const { parseFile } = require('../src/parser');
const { getAdapterForFile } = require('../src/languages');

describe('CodeGraphX Parser System', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');

  describe('JavaScript Parsing', () => {
    test('extracts symbols from string', () => {
      const contents = `
        function start() { helper(); }
        class AuthService { login() {} }
      `;
      const JavaScriptAdapter = require('../src/languages/javascript');
      const adapter = new JavaScriptAdapter();
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
      const JavaScriptAdapter = require('../src/languages/javascript');
      const adapter = new JavaScriptAdapter();
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
      const JavaScriptAdapter = require('../src/languages/javascript/index.js');
      const adapter = new JavaScriptAdapter();
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
      const PythonAdapter = require('../src/languages/python');
      const adapter = new PythonAdapter();
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
      const PythonAdapter = require('../src/languages/python/index.js');
      const adapter = new PythonAdapter();
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
      const TypeScriptAdapter = require('../src/languages/typescript');
      const adapter = new TypeScriptAdapter();
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
      const CSSAdapter = require('../src/languages/css');
      const adapter = new CSSAdapter();
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
