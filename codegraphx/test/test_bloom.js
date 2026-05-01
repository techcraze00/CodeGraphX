// CodeGraphX Bloom Filter Test
// Run with: node codegraphx/test/test_bloom.js

const fs = require('fs');
const path = require('path');
const { BloomFilter } = require('bloom-filters');

const cgxDir = path.join(process.cwd(), '.codegraphx');
const bloomPath = path.join(cgxDir, 'symbols.bloom');
const codegraphPath = path.join(cgxDir, 'codegraph.toon');

if (!fs.existsSync(bloomPath) || !fs.existsSync(codegraphPath)) {
  console.error('ERROR: Missing required .codegraphx outputs. Run `init` first.');
  process.exit(1);
}

// Load Bloom filter
const bloomJSON = JSON.parse(fs.readFileSync(bloomPath, 'utf8'));
const filter = BloomFilter.fromJSON(bloomJSON);

// Load all known symbol names from TOON
const toonLines = fs.readFileSync(codegraphPath, 'utf8').split('\n');
const symbolNames = [];
toonLines.forEach(line => {
  // Simple parser: match - name: value
  if (line.match(/name:/)) {
    let m = line.match(/name:\s*(\S+)/);
    if (m) symbolNames.push(m[1].replace(/[,]/g, ''));
  }
});

console.log(`Testing ${symbolNames.length} symbol names from codegraph.toon...`);
let failures = 0;
symbolNames.forEach(name => {
  if (!filter.has(name)) {
    console.error(`❌ False negative: ${name}`);
    failures++;
  }
});
if (failures === 0) {
  console.log('✅ All symbol names found in Bloom filter (no false negatives).');
} else {
  console.log('❌ Some symbol names not found (should never happen).');
}

// Bonus: check random gibberish
const gibberish = ['abcxyz___', 'bananaphone777', 'notarealsymbol2323'];
gibberish.forEach(str => {
  if (filter.has(str)) {
    console.log(`⚠️ Possibly false positive for gibberish: ${str}`);
  } else {
    console.log(`Correctly missing: ${str}`);
  }
});
