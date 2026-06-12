/**
 * Heuristic extraction of cross-language API contracts from JS/TS trees.
 *
 * - apiCalls:  frontend HTTP requests (fetch, axios and axios-like clients)
 * - apiRoutes: backend HTTP endpoints (Express-style app/router definitions)
 *
 * Receiver-name allowlists keep `app.get('/x', handler)` (a route) apart from
 * `client.get('/x')` (a request); anything matching neither list is skipped
 * rather than guessed.
 */

const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'head', 'options']);

const ROUTE_RECEIVERS = new Set(['app', 'router', 'server', 'express']);
const CLIENT_RECEIVERS = new Set(['axios', 'http', 'client', 'api', 'apiclient', 'fetcher', '$http', 'request', 'instance']);

function isRouteReceiver(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  return ROUTE_RECEIVERS.has(lower) || lower.endsWith('router') || lower.endsWith('app');
}

function isClientReceiver(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  return CLIENT_RECEIVERS.has(lower) || lower.endsWith('client') || lower.endsWith('api');
}

/** String literal or template string -> path text; `${expr}` becomes `:param`. */
function nodeToPathString(node) {
  if (!node) return null;
  if (node.type === 'string') {
    return node.text.replace(/^['"]|['"]$/g, '');
  }
  if (node.type === 'template_string') {
    return node.text
      .replace(/^`|`$/g, '')
      .replace(/\$\{[^}]*\}/g, ':param');
  }
  return null;
}

/** Climb parents to the nearest named function/method/class declaration. */
function findEnclosingSymbolName(node) {
  let current = node.parent;
  while (current) {
    if (current.type === 'function_declaration' || current.type === 'class_declaration') {
      const nameNode = current.childForFieldName('name');
      if (nameNode) return nameNode.text;
    }
    if (current.type === 'method_definition') {
      const nameNode = current.childForFieldName('name');
      if (nameNode) return nameNode.text;
    }
    if (current.type === 'variable_declarator') {
      const nameNode = current.childForFieldName('name');
      const valueNode = current.childForFieldName('value');
      if (nameNode && valueNode && (valueNode.type === 'arrow_function' || valueNode.type === 'function_expression')) {
        return nameNode.text;
      }
    }
    current = current.parent;
  }
  return null;
}

/** Find `method: 'POST'` inside a fetch options object literal. */
function extractMethodFromOptions(objectNode) {
  if (!objectNode || objectNode.type !== 'object') return null;
  for (let i = 0; i < objectNode.namedChildCount; i++) {
    const pair = objectNode.namedChild(i);
    if (pair.type !== 'pair') continue;
    const keyNode = pair.childForFieldName('key');
    const valueNode = pair.childForFieldName('value');
    const key = keyNode ? keyNode.text.replace(/['"]/g, '') : null;
    if (key === 'method' && valueNode && valueNode.type === 'string') {
      return valueNode.text.replace(/['"]/g, '').toUpperCase();
    }
  }
  return null;
}

function getCallArgs(callNode) {
  const argsNode = callNode.childForFieldName('arguments');
  if (!argsNode) return [];
  const args = [];
  for (let i = 0; i < argsNode.namedChildCount; i++) {
    args.push(argsNode.namedChild(i));
  }
  return args;
}

function extractApiContracts(tree) {
  const apiCalls = [];
  const apiRoutes = [];
  if (!tree || !tree.rootNode) return { apiCalls, apiRoutes };

  const stack = [tree.rootNode];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;

    if (node.type === 'call_expression') {
      const funcNode = node.childForFieldName('function') || node.child(0);
      const args = getCallArgs(node);

      if (funcNode && (funcNode.text === 'fetch' || funcNode.text === 'window.fetch')) {
        const path = nodeToPathString(args[0]);
        if (path) {
          apiCalls.push({
            method: extractMethodFromOptions(args[1]) || 'GET',
            path,
            enclosingSymbol: findEnclosingSymbolName(node),
            via: 'fetch'
          });
        }
      } else if (funcNode && funcNode.type === 'member_expression') {
        const objectNode = funcNode.childForFieldName('object');
        const propertyNode = funcNode.childForFieldName('property');
        const receiver = objectNode ? objectNode.text : null;
        const property = propertyNode ? propertyNode.text : null;

        if (property && HTTP_METHODS.has(property)) {
          const path = nodeToPathString(args[0]);
          if (path) {
            const lastArg = args[args.length - 1];
            const lastIsHandler = lastArg && args.length > 1 &&
              (lastArg.type === 'arrow_function' || lastArg.type === 'function_expression' || lastArg.type === 'identifier');

            if (isRouteReceiver(receiver) && lastIsHandler) {
              apiRoutes.push({
                method: property.toUpperCase(),
                path,
                handlerName: lastArg.type === 'identifier' ? lastArg.text : null,
                enclosingSymbol: findEnclosingSymbolName(node),
                framework: 'express'
              });
            } else if (isClientReceiver(receiver)) {
              apiCalls.push({
                method: property.toUpperCase(),
                path,
                enclosingSymbol: findEnclosingSymbolName(node),
                via: receiver
              });
            }
          }
        }
      } else if (funcNode && funcNode.text === 'axios' && args[0] && args[0].type === 'object') {
        // axios({ url: '/api/x', method: 'post' }) config form
        let url = null;
        let method = null;
        for (let i = 0; i < args[0].namedChildCount; i++) {
          const pair = args[0].namedChild(i);
          if (pair.type !== 'pair') continue;
          const key = pair.childForFieldName('key')?.text?.replace(/['"]/g, '');
          const valueNode = pair.childForFieldName('value');
          if (key === 'url') url = nodeToPathString(valueNode);
          if (key === 'method' && valueNode?.type === 'string') {
            method = valueNode.text.replace(/['"]/g, '').toUpperCase();
          }
        }
        if (url) {
          apiCalls.push({
            method: method || 'GET',
            path: url,
            enclosingSymbol: findEnclosingSymbolName(node),
            via: 'axios'
          });
        }
      }
    }

    for (let i = node.childCount - 1; i >= 0; i--) {
      stack.push(node.child(i));
    }
  }

  return { apiCalls, apiRoutes };
}

module.exports = { extractApiContracts };
