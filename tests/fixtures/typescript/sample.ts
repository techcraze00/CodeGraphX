interface IGreeter {
  greet(): void;
}

class Greeter implements IGreeter {
  greet(): void {
    console.log("hello");
  }
}

class AdvancedGreeter extends Greeter {
  greet(): void {
    super.greet();
    console.log("world");
  }
}
