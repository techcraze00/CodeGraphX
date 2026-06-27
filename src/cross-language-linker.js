/**
 * Cross-language semantic linker (Phase 6).
 *
 * Matches frontend HTTP requests (file.apiCalls) against backend route
 * definitions (file.apiRoutes) across the whole scanned file set and emits
 * API_CALLS edges between the involved symbols, confidence-scored:
 *
 *   0.9  exact normalized path + exact method
 *   0.75 exact normalized path, method differs/unknown
 *   0.7  parameterized path match (e.g. /users/:param vs /users/:id) + method
 *   0.55 parameterized path match, method differs/unknown
 */

const { EdgeEntity } = require('./entities');

/**
 * Normalize a route/request path for comparison:
 * strips origin, query string, hash and trailing slash; rewrites every
 * parameter style (:id, {id}, <int:id>, :param) to the marker `:param`.
 */
function normalizeRoutePath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return null;
  let p = rawPath.trim();

  p = p.replace(/^https?:\/\/[^/]+/i, '');
  p = p.split(/[?#]/)[0];

  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);

  const segments = p.split('/').map(seg => {
    if (!seg) return seg;
    if (seg.startsWith(':')) return ':param';                 // Express / template-literal marker
    if (/^\{[^}]*\}$/.test(seg)) return ':param';             // FastAPI / Django {id}
    if (/^<[^>]*>$/.test(seg)) return ':param';               // Flask <int:id>
    return seg;
  });

  return segments.join('/') || '/';
}

/** Paths already normalized; equal directly, or segment-wise with :param wildcards. */
function pathsMatch(callPath, routePath) {
  if (callPath === routePath) return { match: true, parameterized: callPath.includes(':param') };

  const callSegs = callPath.split('/');
  const routeSegs = routePath.split('/');
  if (callSegs.length !== routeSegs.length) return { match: false };

  for (let i = 0; i < callSegs.length; i++) {
    if (callSegs[i] === routeSegs[i]) continue;
    if (callSegs[i] === ':param' || routeSegs[i] === ':param') continue;
    return { match: false };
  }
  return { match: true, parameterized: true };
}

function scoreMatch(parameterized, methodMatches) {
  if (!parameterized) return methodMatches ? 0.9 : 0.75;
  return methodMatches ? 0.7 : 0.55;
}

function findSymbol(file, name) {
  if (!name || !file.symbols) return null;
  return (file.symbols || []).find(s => s.name === name) || null;
}

/**
 * @param {Array} files - filesData entries ({ path/file, symbols, apiCalls, apiRoutes })
 * @returns {EdgeEntity[]} API_CALLS edges (from frontend symbol, to backend handler symbol)
 */
function linkApiContracts(files) {
  const routes = [];
  const symbolsByName = new Map();

  for (const f of files) {
    for (const s of (f.symbols || [])) {
      if (s.name && !symbolsByName.has(s.name)) symbolsByName.set(s.name, s);
    }
  }

  for (const f of files) {
    for (const r of (f.apiRoutes || [])) {
      const normalized = normalizeRoutePath(r.path);
      if (!normalized) continue;
      // Handler symbol: named handler in the same file, then anywhere
      // (imported handlers), then the function the registration sits in.
      const handler = findSymbol(f, r.handlerName)
        || (r.handlerName ? symbolsByName.get(r.handlerName) : null)
        || findSymbol(f, r.enclosingSymbol);
      if (!handler || !handler.id) continue;
      routes.push({ method: (r.method || 'GET').toUpperCase(), path: normalized, symbolId: handler.id });
    }
  }

  const edges = [];
  const seen = new Set();

  for (const f of files) {
    for (const call of (f.apiCalls || [])) {
      const normalized = normalizeRoutePath(call.path);
      if (!normalized) continue;
      const caller = findSymbol(f, call.enclosingSymbol);
      if (!caller || !caller.id) continue;

      let best = null;
      for (const route of routes) {
        const { match, parameterized } = pathsMatch(normalized, route.path);
        if (!match) continue;
        const confidence = scoreMatch(parameterized, (call.method || 'GET').toUpperCase() === route.method);
        if (!best || confidence > best.confidence) {
          best = { route, confidence };
        }
      }

      if (best) {
        const key = `${caller.id}->${best.route.symbolId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push(new EdgeEntity({
          from: caller.id,
          to: best.route.symbolId,
          type: 'API_CALLS',
          confidence: best.confidence
        }));
      }
    }
  }

  return edges;
}

module.exports = { linkApiContracts, normalizeRoutePath, pathsMatch };
