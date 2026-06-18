"""Half of a deliberate circular import: mod_x <-> mod_y."""
import mod_y


def x():
    return mod_y.y() + 1
