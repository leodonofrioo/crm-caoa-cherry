# CRM CAOA Chery

CRM interno para propostas de acessórios CAOA Chery, com catálogo por produto/variação, compatibilidade por modelo/versão/ano, slots comerciais na proposta e persistência server-side.

## Stack

- React + Vite
- Express
- PostgreSQL
- Prisma
- Cookie `HttpOnly` para sessão
- Coolify-ready via `Dockerfile`

## Desenvolvimento

```bash
npm install
npm run db:generate
npm run dev
```

O Vite mantém uma API de desenvolvimento em memória para preservar o fluxo local em `localhost:3000`.

## Produção

Produção usa Express + PostgreSQL. Variáveis mínimas:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=<url-do-postgres-do-coolify>
CRM_AUTH_LOGIN=thayna
CRM_AUTH_PASSWORD_HASH=<hash-bcrypt>
CRM_AUTH_SESSION_SECRET=<segredo-longo>
COOKIE_SECURE=true
```

Gerar hash:

```bash
npm run auth:hash -- sua-senha
```

Build:

```bash
npm run db:generate
npm run build
```

Start:

```bash
npm run db:migrate && npm run start
```

## Coolify

Ver [docs/coolify-postgres-deploy.md](docs/coolify-postgres-deploy.md).

Healthcheck:

```text
/api/health
```

## Validação

```bash
npm run lint
npm run test
npm run build
npx prisma validate
```

Testes de integração com Postgres só rodam quando `RUN_DB_TESTS=true`.
Testes E2E só rodam quando `E2E_BASE_URL` estiver definido.
