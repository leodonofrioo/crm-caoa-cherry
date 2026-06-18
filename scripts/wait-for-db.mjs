import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
const maxAttempts = Number(process.env.DB_WAIT_ATTEMPTS || 30);
const delayMs = Number(process.env.DB_WAIT_DELAY_MS || 2000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (!connectionString) {
  console.error('DATABASE_URL não configurado.');
  process.exit(1);
}

let lastError = null;

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    console.log('PostgreSQL pronto.');
    process.exit(0);
  } catch (error) {
    lastError = error;
    try {
      await client.end();
    } catch {
      // ignore close failure during startup retry
    }
    console.log(`Aguardando PostgreSQL (${attempt}/${maxAttempts})...`);
    await sleep(delayMs);
  }
}

console.error(lastError instanceof Error ? lastError.message : 'PostgreSQL indisponível.');
process.exit(1);
