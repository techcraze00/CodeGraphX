"""A linear call chain a -> b -> c, for impact tracing."""
from models import Dog


def c():
    return 3


def b():
    return c() + 1


def a():
    dog = Dog("rex")
    return b() + dog.speak()
