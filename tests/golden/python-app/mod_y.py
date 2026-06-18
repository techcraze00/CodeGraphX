"""Half of a deliberate circular import: mod_x <-> mod_y."""
import mod_x


def y():
    return 2


def use_x():
    return mod_x.x()
