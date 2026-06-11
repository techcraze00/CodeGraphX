def hello():
    print("world")

class Greeter:
    def __init__(self):
        self.name = "world"
    
    def greet(self):
        hello()

g = Greeter()
g.greet()
