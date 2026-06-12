const { linkApiContracts, normalizeRoutePath, pathsMatch } = require('../src/cross-language-linker');

describe('cross-language linker', () => {
  describe('normalizeRoutePath', () => {
    test('strips origin, query, hash, trailing slash', () => {
      expect(normalizeRoutePath('https://api.example.com/api/users/?x=1#frag')).toBe('/api/users');
    });
    test('prepends leading slash', () => {
      expect(normalizeRoutePath('api/users')).toBe('/api/users');
    });
    test('normalizes all param styles to :param', () => {
      expect(normalizeRoutePath('/users/:id')).toBe('/users/:param');
      expect(normalizeRoutePath('/users/{id}')).toBe('/users/:param');
      expect(normalizeRoutePath('/users/<int:id>')).toBe('/users/:param');
    });
    test('returns null for non-strings', () => {
      expect(normalizeRoutePath(null)).toBeNull();
    });
  });

  describe('pathsMatch', () => {
    test('exact match', () => {
      expect(pathsMatch('/api/users', '/api/users').match).toBe(true);
    });
    test('parameterized match', () => {
      const r = pathsMatch('/api/users/:param', '/api/users/:param');
      expect(r.match).toBe(true);
      expect(r.parameterized).toBe(true);
    });
    test('mismatched segment count', () => {
      expect(pathsMatch('/api/users', '/api/users/:param').match).toBe(false);
    });
    test('mismatched literal segment', () => {
      expect(pathsMatch('/api/orders', '/api/users').match).toBe(false);
    });
  });

  describe('linkApiContracts', () => {
    test('links a frontend fetch to a backend Express route, exact path+method', () => {
      const files = [
        {
          path: 'frontend/api.js',
          symbols: [{ id: 'js::frontend/api.js::global::loadUsers', name: 'loadUsers' }],
          apiCalls: [{ method: 'GET', path: '/api/users', enclosingSymbol: 'loadUsers' }],
          apiRoutes: []
        },
        {
          path: 'backend/server.js',
          symbols: [{ id: 'js::backend/server.js::global::listUsers', name: 'listUsers' }],
          apiCalls: [],
          apiRoutes: [{ method: 'GET', path: '/api/users', handlerName: 'listUsers' }]
        }
      ];
      const edges = linkApiContracts(files);
      expect(edges).toHaveLength(1);
      expect(edges[0]).toMatchObject({
        from: 'js::frontend/api.js::global::loadUsers',
        to: 'js::backend/server.js::global::listUsers',
        type: 'API_CALLS',
        confidence: 0.9
      });
    });

    test('links across languages (React fetch -> FastAPI route) with param path', () => {
      const files = [
        {
          path: 'web/user.js',
          symbols: [{ id: 'js::web/user.js::global::getUser', name: 'getUser' }],
          apiCalls: [{ method: 'GET', path: '/api/items/:param', enclosingSymbol: 'getUser' }],
          apiRoutes: []
        },
        {
          path: 'api/main.py',
          symbols: [{ id: 'python::api/main.py::global::read_item', name: 'read_item' }],
          apiCalls: [],
          apiRoutes: [{ method: 'GET', path: '/api/items/{item_id}', handlerName: 'read_item' }]
        }
      ];
      const edges = linkApiContracts(files);
      expect(edges).toHaveLength(1);
      expect(edges[0].to).toBe('python::api/main.py::global::read_item');
      expect(edges[0].confidence).toBe(0.7); // parameterized + method match
    });

    test('lower confidence when method differs', () => {
      const files = [
        {
          path: 'f.js',
          symbols: [{ id: 'a', name: 'caller' }],
          apiCalls: [{ method: 'POST', path: '/api/x', enclosingSymbol: 'caller' }],
          apiRoutes: []
        },
        {
          path: 'b.js',
          symbols: [{ id: 'b', name: 'handler' }],
          apiCalls: [],
          apiRoutes: [{ method: 'GET', path: '/api/x', handlerName: 'handler' }]
        }
      ];
      const edges = linkApiContracts(files);
      expect(edges).toHaveLength(1);
      expect(edges[0].confidence).toBe(0.75); // exact path, method differs
    });

    test('no edge when no route matches', () => {
      const files = [
        {
          path: 'f.js',
          symbols: [{ id: 'a', name: 'caller' }],
          apiCalls: [{ method: 'GET', path: '/api/unknown', enclosingSymbol: 'caller' }],
          apiRoutes: []
        }
      ];
      expect(linkApiContracts(files)).toHaveLength(0);
    });

    test('resolves route handler imported from another file by name', () => {
      const files = [
        {
          path: 'routes.js',
          symbols: [],
          apiCalls: [],
          apiRoutes: [{ method: 'POST', path: '/api/orders', handlerName: 'createOrder' }]
        },
        {
          path: 'controllers/order.js',
          symbols: [{ id: 'ctrl::createOrder', name: 'createOrder' }],
          apiCalls: [],
          apiRoutes: []
        },
        {
          path: 'web/checkout.js',
          symbols: [{ id: 'web::checkout', name: 'checkout' }],
          apiCalls: [{ method: 'POST', path: '/api/orders', enclosingSymbol: 'checkout' }],
          apiRoutes: []
        }
      ];
      const edges = linkApiContracts(files);
      expect(edges).toHaveLength(1);
      expect(edges[0]).toMatchObject({ from: 'web::checkout', to: 'ctrl::createOrder', confidence: 0.9 });
    });

    test('deduplicates repeated call->route pairs', () => {
      const files = [
        {
          path: 'f.js',
          symbols: [{ id: 'a', name: 'caller' }],
          apiCalls: [
            { method: 'GET', path: '/api/x', enclosingSymbol: 'caller' },
            { method: 'GET', path: '/api/x', enclosingSymbol: 'caller' }
          ],
          apiRoutes: []
        },
        {
          path: 'b.js',
          symbols: [{ id: 'b', name: 'handler' }],
          apiCalls: [],
          apiRoutes: [{ method: 'GET', path: '/api/x', handlerName: 'handler' }]
        }
      ];
      expect(linkApiContracts(files)).toHaveLength(1);
    });
  });
});
