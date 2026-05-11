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
});
