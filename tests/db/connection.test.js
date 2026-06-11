const { db, closeDb } = require('../../src/db');

describe('Database Connection', () => {
  afterAll(async () => {
    await closeDb();
  });

  test('can execute a simple query', async () => {
    const result = await db.executeQuery({
      sql: 'SELECT 1 as "connected"',
      parameters: []
    });
    expect(result.rows[0].connected).toBe(1);
  });
});
