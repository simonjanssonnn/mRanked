// Make sure environment-sensitive modules (db.ts, auth.ts) have what they
// need to merely *import* during a test run. None of the tests below actually
// hit the database or sign real tokens — these defaults just stop the
// constructors from yelling at us.

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-only-secret-please-ignore";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://stub:stub@localhost:5432/stub";
