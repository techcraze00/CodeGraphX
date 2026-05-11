const { BloomFilter } = require('bloom-filters');

describe('Bloom Filter Integration', () => {
  test('should accurately report probable existence', () => {
    const symbols = ['foo', 'bar', 'baz'];
    const bloom = BloomFilter.from(symbols, 0.01);
    
    expect(bloom.has('foo')).toBe(true);
    expect(bloom.has('bar')).toBe(true);
    expect(bloom.has('nonexistent')).toBe(false);
  });

  test('should support serialization and restoration', () => {
    const symbols = ['alpha', 'beta'];
    const bloom = BloomFilter.from(symbols, 0.01);
    const json = bloom.saveAsJSON();
    
    const restored = BloomFilter.fromJSON(json);
    expect(restored.has('alpha')).toBe(true);
    expect(restored.has('beta')).toBe(true);
    expect(restored.has('gamma')).toBe(false);
  });
});
