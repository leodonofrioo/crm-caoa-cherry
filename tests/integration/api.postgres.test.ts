import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../server/app.js';

const runDbTests = process.env.RUN_DB_TESTS === 'true';

describe.skipIf(!runDbTests)('api postgres integration', () => {
  const app = createApp();

  it('bloqueia bootstrap sem cookie', async () => {
    await request(app).get('/api/bootstrap').expect(401);
  });

  it('faz login, valida sessao e carrega bootstrap', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ login: process.env.CRM_AUTH_LOGIN, password: process.env.CRM_AUTH_TEST_PASSWORD })
      .expect(200);

    const cookie = login.headers['set-cookie'];
    expect(String(cookie)).toContain('HttpOnly');

    await request(app).get('/api/auth/session').set('Cookie', cookie).expect(200);
    const bootstrap = await request(app).get('/api/bootstrap').set('Cookie', cookie).expect(200);
    expect(bootstrap.body.products.length).toBeGreaterThan(0);
    expect(bootstrap.body.carModels.length).toBeGreaterThan(0);
  });
});
