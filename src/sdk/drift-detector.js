/**
 * Detects architectural drift by tracing impact and checking against forbidden layer dependencies.
 * 
 * @param {Object} sdk - The IntelligenceSDK instance
 * @param {string} repositoryId - The repository ID
 * @param {string} symbolId - The starting symbol ID to trace from
 * @param {string} symbolName - The name (or path-qualified name) of the starting symbol
 * @param {Array} rules - Array of rules: { fromLayer: string, forbiddenTarget: string }
 * @returns {Promise<Array>} List of violations found
 */
async function detectDrift(sdk, repositoryId, symbolId, symbolName, rules) {
  const violations = [];

  for (const rule of rules) {
    if (symbolName.includes(rule.fromLayer)) {
      const impacts = await sdk.traceImpact(repositoryId, symbolId, 'downstream');
      
      for (const impacted of impacts) {
        const matchesName = impacted.name && impacted.name.includes(rule.forbiddenTarget);
        const matchesPath = impacted.path && impacted.path.includes(rule.forbiddenTarget);
        const matchesQualified = impacted.qualified_name && impacted.qualified_name.includes(rule.forbiddenTarget);

        if (matchesName || matchesPath || matchesQualified) {
          violations.push({
            symbolName,
            impactedSymbol: impacted.name,
            impactedPath: impacted.path,
            rule
          });
        }
      }
    }
  }

  return violations;
}

module.exports = { detectDrift };
