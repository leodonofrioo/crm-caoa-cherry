import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');

if (!connectionString) {
  console.error('DATABASE_URL nao configurado.');
  process.exit(1);
}

const checksum = (content) => crypto.createHash('sha256').update(content).digest('hex');

const tableExists = async (client, tableName) => {
  const result = await client.query('SELECT to_regclass($1) AS name', [`public.${tableName}`]);
  return Boolean(result.rows[0]?.name);
};

const loadMigrationDirs = async () => {
  try {
    const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }
};

const client = new Client({ connectionString });

try {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS crm_migrations (
      name TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const appliedRows = await client.query('SELECT name, checksum FROM crm_migrations');
  const applied = new Map(appliedRows.rows.map((row) => [row.name, row.checksum]));

  const prismaApplied = new Set();
  if (await tableExists(client, '_prisma_migrations')) {
    const rows = await client.query(`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `);
    for (const row of rows.rows) prismaApplied.add(row.migration_name);
  }

  const dirs = await loadMigrationDirs();
  if (dirs.length === 0) {
    console.log('Nenhuma migration encontrada.');
    process.exit(0);
  }

  for (const name of dirs) {
    const sqlPath = path.join(migrationsDir, name, 'migration.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    const hash = checksum(sql);

    if (applied.has(name)) {
      if (applied.get(name) !== hash) {
        throw new Error(`Migration alterada apos aplicada: ${name}`);
      }
      continue;
    }

    if (prismaApplied.has(name)) {
      await client.query('INSERT INTO crm_migrations (name, checksum) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
        name,
        hash,
      ]);
      console.log(`Migration ja aplicada pelo Prisma: ${name}`);
      continue;
    }

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO crm_migrations (name, checksum) VALUES ($1, $2)', [name, hash]);
      await client.query('COMMIT');
      console.log(`Migration aplicada: ${name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  console.log('Migrations prontas.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha ao aplicar migrations.');
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
