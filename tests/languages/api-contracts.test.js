const { ADAPTERS } = require('../../src/languages');

describe('API contract extraction', () => {
  describe('JavaScript adapter', () => {
    const adapter = ADAPTERS['.js'].adapter;

    function contracts(code) {
      return adapter.extractApiContracts(adapter.parse(code), code);
    }

    test('extracts fetch calls with default GET and enclosing symbol', () => {
      const { apiCalls } = contracts(`
        async function loadUsers() {
          const res = await fetch('/api/users');
          return res.json();
        }
      `);
      expect(apiCalls).toHaveLength(1);
      expect(apiCalls[0]).toMatchObject({ method: 'GET', path: '/api/users', enclosingSymbol: 'loadUsers' });
    });

    test('extracts fetch method from options object', () => {
      const { apiCalls } = contracts(`
        const createUser = async (data) => {
          await fetch('/api/users', { method: 'POST', body: JSON.stringify(data) });
        };
      `);
      expect(apiCalls).toHaveLength(1);
      expect(apiCalls[0]).toMatchObject({ method: 'POST', path: '/api/users', enclosingSymbol: 'createUser' });
    });

    test('normalizes template literal params to :param', () => {
      const { apiCalls } = contracts(`
        function getUser(id) {
          return fetch(\`/api/users/\${id}\`);
        }
      `);
      expect(apiCalls[0].path).toBe('/api/users/:param');
    });

    test('extracts axios verb calls as apiCalls, not routes', () => {
      const { apiCalls, apiRoutes } = contracts(`
        function saveOrder(payload) {
          return axios.post('/api/orders', payload);
        }
      `);
      expect(apiRoutes).toHaveLength(0);
      expect(apiCalls).toHaveLength(1);
      expect(apiCalls[0]).toMatchObject({ method: 'POST', path: '/api/orders', enclosingSymbol: 'saveOrder' });
    });

    test('extracts axios config-object form', () => {
      const { apiCalls } = contracts(`
        const ping = () => axios({ url: '/api/ping', method: 'post' });
      `);
      expect(apiCalls).toHaveLength(1);
      expect(apiCalls[0]).toMatchObject({ method: 'POST', path: '/api/ping' });
    });

    test('extracts Express routes with named handlers', () => {
      const { apiRoutes, apiCalls } = contracts(`
        const express = require('express');
        const app = express();
        app.get('/api/users', listUsers);
        app.post('/api/users', createUser);
        router.delete('/api/users/:id', removeUser);
      `);
      expect(apiCalls).toHaveLength(0);
      expect(apiRoutes).toHaveLength(3);
      expect(apiRoutes[0]).toMatchObject({ method: 'GET', path: '/api/users', handlerName: 'listUsers' });
      expect(apiRoutes[1]).toMatchObject({ method: 'POST', path: '/api/users', handlerName: 'createUser' });
      expect(apiRoutes[2]).toMatchObject({ method: 'DELETE', path: '/api/users/:id', handlerName: 'removeUser' });
    });

    test('extracts Express routes with inline handlers (handlerName null)', () => {
      const { apiRoutes } = contracts(`
        app.get('/api/health', (req, res) => res.send('ok'));
      `);
      expect(apiRoutes).toHaveLength(1);
      expect(apiRoutes[0].handlerName).toBeNull();
    });

    test('ignores unrelated member calls like map.get', () => {
      const { apiCalls, apiRoutes } = contracts(`
        function lookup(map) {
          return map.get('/not/a/route');
        }
      `);
      expect(apiCalls).toHaveLength(0);
      expect(apiRoutes).toHaveLength(0);
    });
  });

  describe('Python adapter', () => {
    const adapter = ADAPTERS['.py'].adapter;

    function contracts(code) {
      return adapter.extractApiContracts(adapter.parse(code), code);
    }

    test('extracts Flask @app.route with methods list', () => {
      const { apiRoutes } = contracts(`
@app.route('/api/users', methods=['GET', 'POST'])
def users():
    pass
`);
      expect(apiRoutes).toHaveLength(2);
      expect(apiRoutes[0]).toMatchObject({ method: 'GET', path: '/api/users', handlerName: 'users' });
      expect(apiRoutes[1]).toMatchObject({ method: 'POST', path: '/api/users', handlerName: 'users' });
    });

    test('Flask @app.route defaults to GET', () => {
      const { apiRoutes } = contracts(`
@app.route('/api/health')
def health():
    return 'ok'
`);
      expect(apiRoutes).toHaveLength(1);
      expect(apiRoutes[0].method).toBe('GET');
    });

    test('extracts FastAPI verb decorators with path params', () => {
      const { apiRoutes } = contracts(`
@router.get('/api/items/{item_id}')
def read_item(item_id):
    pass

@app.post('/api/items')
def create_item(item):
    pass
`);
      expect(apiRoutes).toHaveLength(2);
      expect(apiRoutes[0]).toMatchObject({ method: 'GET', path: '/api/items/{item_id}', handlerName: 'read_item' });
      expect(apiRoutes[1]).toMatchObject({ method: 'POST', path: '/api/items', handlerName: 'create_item' });
    });

    test('ignores non-route decorators', () => {
      const { apiRoutes } = contracts(`
@staticmethod
def helper():
    pass

@cache.memoize()
def cached():
    pass
`);
      expect(apiRoutes).toHaveLength(0);
    });
  });
});
