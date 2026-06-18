import 'dotenv/config';
import { hashPassword } from './auth.js';

const password = process.argv[2];

if (!password) {
  console.error('Uso: npm run auth:hash -- <senha>');
  process.exit(1);
}

console.log(await hashPassword(password));
