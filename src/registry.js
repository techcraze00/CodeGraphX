class SymbolRegistry {
  constructor() {
    this.symbols = new Map(); // id -> symbol object
    this.fileExports = new Map(); // file -> symbol objects
    this.nameIndex = new Map(); // name -> symbol objects
  }

  registerSymbol(symbol) {
    this.symbols.set(symbol.symbol_id, symbol);
    
    if (symbol.exported) {
      if (!this.fileExports.has(symbol.file)) {
        this.fileExports.set(symbol.file, []);
      }
      this.fileExports.get(symbol.file).push(symbol);
    }

    if (!this.nameIndex.has(symbol.name)) {
        this.nameIndex.set(symbol.name, []);
    }
    this.nameIndex.get(symbol.name).push(symbol);
  }

  getSymbolById(id) {
    return this.symbols.get(id) || null;
  }

  getExportsByFile(file) {
    return this.fileExports.get(file) || [];
  }

  getSymbolsByName(name) {
    return this.nameIndex.get(name) || [];
  }
}

module.exports = SymbolRegistry;
