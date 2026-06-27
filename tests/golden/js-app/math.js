// Pure helpers with an internal call chain: square -> add.
function add(p, q) {
  return p + q;
}

function square(n) {
  return add(n, n) * (n / 2 || 1);
}

module.exports = { add, square };
