import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import bcrypt from 'bcryptjs';

export const createPool = () => {
  // Try to find any environment variable that looks like a postgres connection string
  let url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.STORAGE_URL || process.env.STORAGE_DATABASE_URL || process.env.NEON_DATABASE_URL;
  
  if (!url) {
    const postgresKeys = Object.keys(process.env).filter(k => 
      (k.includes('URL') || k.includes('POSTGRES') || k.includes('DATABASE') || k.includes('STORAGE')) && 
      typeof process.env[k] === 'string' && 
      process.env[k]!.startsWith('postgres')
    );
    if (postgresKeys.length > 0) {
      url = process.env[postgresKeys[0]];
    }
  }

  if (url) {
    return new Pool({
      connectionString: url,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 5000,
      max: 1, // Critical for Serverless environments like Vercel
      idleTimeoutMillis: 10000,
    });
  }

  // Fallback to individual pg credentials if prefix is known or standard
  const host = process.env.PGHOST || process.env.STORAGE_PGHOST || process.env.SQL_HOST;
  const user = process.env.PGUSER || process.env.STORAGE_PGUSER || process.env.SQL_USER;
  const password = process.env.PGPASSWORD || process.env.STORAGE_PGPASSWORD || process.env.SQL_PASSWORD;
  const database = process.env.PGDATABASE || process.env.STORAGE_PGDATABASE || process.env.SQL_DB_NAME;

  if (host && user && password && database) {
    return new Pool({
      host,
      user,
      password,
      database,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 5000,
    });
  }

  // Fallback for Vercel if database is not connected
  console.warn("No database configuration found. Please connect Vercel Postgres.");
  return null;
};

export const pool = createPool();

if (pool) {
  pool.on('error', (err) => {
    console.error('Unexpected error on idle SQL pool client:', err);
  });
}

export const db = pool ? drizzle(pool, { schema }) : null as any;

export const initDb = async () => {
  if (!pool) return;
  try {
    // Auto-create tables if they don't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT false NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

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

    // Auto-seed admin account
    const adminEmail = 'rifkifadhilatilaqli@gmail.com';
    const adminPassword = 'Admin4321';
    
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [adminEmail]);
    if (rows.length === 0) {
      const hash = await bcrypt.hash(adminPassword, 10);
      await pool.query(
        'INSERT INTO users (name, email, password_hash, is_admin) VALUES ($1, $2, $3, $4)',
        ['Admin', adminEmail, hash, true]
      );
      console.log('Admin account created successfully.');
    }
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

