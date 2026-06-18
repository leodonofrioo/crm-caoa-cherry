# Deploy Coolify + PostgreSQL

## Serviços
- App Node com este repositório.
- PostgreSQL no mesmo projeto Coolify.
- Postgres sem porta pública.

## Variáveis App
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=<url-do-postgres-do-coolify>
CRM_AUTH_LOGIN=thayna
CRM_AUTH_PASSWORD_HASH=<hash bcrypt>
CRM_AUTH_SESSION_SECRET=<minimo 24 caracteres aleatorios>
COOKIE_SECURE=true
APP_BASE_URL=https://seu-dominio.com
```

Gerar hash:
```bash
npm run auth:hash -- sua-senha
```

## Build/Start
Build:
```bash
npm ci
npm run db:generate
npm run build
```

Start:
```bash
npm run db:wait && npm run db:migrate && npm run start
```

Healthcheck:
```text
/api/health
```

## Checklist Go/No-Go
- `npm run lint`
- `npm run build`
- `npm run test`
- `/api/health` retorna `ok: true`
- login funciona em HTTPS
- criar proposta, reiniciar app, proposta permanece
- reiniciar Postgres, proposta permanece
- backup Postgres ativo com retenção mínima de 14 dias
