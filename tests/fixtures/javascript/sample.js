function hello() {
  console.log("world");
}

class Greeter {
  constructor() {
    this.name = "world";
  }
  greet() {
    hello();
  }
}

const g = new Greeter();
g.greet();
