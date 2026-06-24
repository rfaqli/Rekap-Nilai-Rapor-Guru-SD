import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import bcrypt from 'bcryptjs';

let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getConnectionString(): string | null {
  // Urutan prioritas env vars dari Vercel Postgres / Neon
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    null
  );
}

export function getPool(): Pool | null {
  if (_pool) return _pool;

  const url = getConnectionString();
  if (!url) {
    const postgresKeys = Object.keys(process.env).filter(k => 
      (k.includes('URL') || k.includes('POSTGRES') || k.includes('DATABASE') || k.includes('STORAGE')) && 
      typeof process.env[k] === 'string' && 
      process.env[k]!.startsWith('postgres')
    );
    if (postgresKeys.length > 0) {
      _pool = new Pool({
        connectionString: process.env[postgresKeys[0]],
        ssl: { rejectUnauthorized: false },
        max: 1,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000,
      });
      return _pool;
    }
    
    const host = process.env.PGHOST || process.env.STORAGE_PGHOST || process.env.SQL_HOST;
    const user = process.env.PGUSER || process.env.STORAGE_PGUSER || process.env.SQL_USER;
    const password = process.env.PGPASSWORD || process.env.STORAGE_PGPASSWORD || process.env.SQL_PASSWORD;
    const database = process.env.PGDATABASE || process.env.STORAGE_PGDATABASE || process.env.SQL_DB_NAME;

    if (host && user && password && database) {
      _pool = new Pool({
        host,
        user,
        password,
        database,
        ssl: { rejectUnauthorized: false },
        max: 1,
        connectionTimeoutMillis: 10000,
      });
      return _pool;
    }

    console.error('[DB] No database URL configured. Check environment variables.');
    return null;
  }

  try {
    _pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: 1,                        // Wajib 1 untuk serverless
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });

    // Error handler untuk pool — tanpa ini, unhandled error bisa crash function
    _pool.on('error', (err) => {
      console.error('[DB Pool] Unexpected error:', err);
      _pool = null; // Reset agar next request coba reconnect
      _db = null;
    });

    return _pool;
  } catch (err) {
    console.error('[DB] Failed to create pool:', err);
    return null;
  }
}

export function getDb(): ReturnType<typeof drizzle> | null {
  if (_db) return _db;

  const pool = getPool();
  if (!pool) return null;

  try {
    _db = drizzle(pool, { schema });
    return _db;
  } catch (err) {
    console.error('[DB] Failed to initialize drizzle:', err);
    return null;
  }
}

// Backward compatibility — export db sebagai getter property
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    const instance = getDb();
    if (!instance) {
      throw new Error('[DB] Database not initialized. Check POSTGRES_URL env var.');
    }
    return (instance as any)[prop];
  }
});

export const initDb = async () => {
  const pool = getPool();
  if (!pool) return;
  try {
    // Auto-create tables if they don't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        is_admin BOOLEAN DEFAULT false NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // Safely add new columns if they don't exist
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN password TEXT;`);
    } catch (e) {}
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user' NOT NULL;`);
    } catch (e) {}
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL;`);
    } catch (e) {}

    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        name TEXT NOT NULL,
        student_count INTEGER DEFAULT 0 NOT NULL,
        subject_count INTEGER DEFAULT 0 NOT NULL,
        data TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

