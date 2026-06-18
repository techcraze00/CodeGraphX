// Isolate tests from the project's .codegraphx.db: each Jest worker process
// gets its own in-memory SQLite database, so suites cannot race on a shared
// database file or pollute the real graph.
if (!process.env.DATABASE_URL && (process.env.DB_DIALECT || 'sqlite') === 'sqlite') {
  process.env.DATABASE_URL = ':memory:';
}
