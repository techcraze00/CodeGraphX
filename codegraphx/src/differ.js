const crypto = require('crypto');

function computeHash(content) {
  return crypto.createHash('sha1').update(content).digest('hex');
}

function computeDelta(oldNodes, newNodes) {
  const oldMap = new Map(oldNodes.map(n => [`${n.type}:${n.name}`, n]));
  const newMap = new Map(newNodes.map(n => [`${n.type}:${n.name}`, n]));

  const added = [];
  const removed = [];
  const modified = [];

  for (const [key, newNode] of newMap.entries()) {
    if (!oldMap.has(key)) {
      added.push(newNode);
    } else {
      const oldNode = oldMap.get(key);
      if (JSON.stringify(oldNode.startPosition) !== JSON.stringify(newNode.startPosition)) {
        modified.push(newNode);
      }
    }
  }

  for (const [key, oldNode] of oldMap.entries()) {
    if (!newMap.has(key)) {
      removed.push(oldNode);
    }
  }

  return { added, removed, modified };
}

module.exports = { computeHash, computeDelta };
