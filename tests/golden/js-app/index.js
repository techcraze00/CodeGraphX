// Entry point: main -> square (imported from ./math).
const { square } = require('./math');

class Calculator {
  constructor(seed) {
    this.seed = seed;
  }

  run() {
    return square(this.seed);
  }
}

function main() {
  const calc = new Calculator(4);
  return calc.run();
}

module.exports = { main, Calculator };
