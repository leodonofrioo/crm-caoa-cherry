import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import bcrypt from 'bcryptjs';
import path from 'path';
import {createHmac, timingSafeEqual} from 'node:crypto';
import type {IncomingMessage, ServerResponse} from 'node:http';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import {INITIAL_PRODUCTS, flattenProductsToAccessories} from './src/data/accessories.ts';
import {DEFAULT_SETTINGS, INITIAL_EVENTS, INITIAL_FOLLOWUPS, INITIAL_SALE_ITEMS, INITIAL_SALES} from './src/data/seeds.ts';
import type {CarModel, CRMExportPayload, Product, Sale, SaleEvent, SaleItem, Followup, Settings} from './src/types.ts';

const AUTH_TOKEN_TTL_MS = 1000 * 60 * 60 * 12;
const AUTH_COOKIE_NAME = 'crm_session';

const INITIAL_CAR_MODELS: CarModel[] = [
  {id: 'm_1', name: 'Tiggo 5', versions: [{name: 'Geral', years: ['2025', '2026', '2027']}]},
  {
    id: 'm_2',
    name: 'Tiggo 7',
    versions: [{name: 'SPORT/ PRO MAX DRIVE/ PRO HYBRID MAX DRIVE/ PRO PLUG-IN HYBRID', years: ['2025', '2026']}],
  },
  {id: 'm_3', name: 'Tiggo 8', versions: [{name: 'PRO/ PRO PLUG-IN HYBRID', years: ['2025', '2026']}]},
];

let devSnapshot: {
  products: Product[];
  sales: Sale[];
  saleItems: SaleItem[];
  followups: Followup[];
  events: SaleEvent[];
  settings: Settings;
  carModels: CarModel[];
} = {
  products: INITIAL_PRODUCTS,
  sales: INITIAL_SALES,
  saleItems: INITIAL_SALE_ITEMS,
  followups: INITIAL_FOLLOWUPS,
  events: INITIAL_EVENTS,
  settings: DEFAULT_SETTINGS,
  carModels: INITIAL_CAR_MODELS,
};

const sendJson = (res: ServerResponse, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const readJsonBody = (req: IncomingMessage) =>
  new Promise<Record<string, unknown>>((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10_000) {
        reject(new Error('Payload muito grande.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('JSON inválido.'));
      }
    });
    req.on('error', reject);
  });

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
};

const signToken = (login: string, secret: string) => {
  const payload = Buffer.from(JSON.stringify({
    sub: login,
    exp: Date.now() + AUTH_TOKEN_TTL_MS,
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

const verifyToken = (token: string, login: string, secret: string) => {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expectedSignature = createHmac('sha256', secret).update(payload).digest('base64url');
  if (!safeEqual(signature, expectedSignature)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; exp?: number };
    return parsed.sub === login && typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
};

const getCookieValue = (req: IncomingMessage, name: string) => {
  const cookieHeader = req.headers.cookie || '';
  return cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`))
    ?.slice(name.length + 1);
};

const createAuthMiddleware = (env: Record<string, string>) => {
  const authLogin = env.CRM_AUTH_LOGIN;
  const authPassword = env.CRM_AUTH_PASSWORD;
  const authPasswordHash = env.CRM_AUTH_PASSWORD_HASH;
  const authSecret = env.CRM_AUTH_SESSION_SECRET || authPassword || authPasswordHash;
  const authDisplayName = env.CRM_AUTH_DISPLAY_NAME || 'Thayná Reis';

  const validatePassword = async (password: string) => {
    if (authPasswordHash) return bcrypt.compare(password, authPasswordHash);
    return Boolean(authPassword) && safeEqual(password, authPassword);
  };

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/')) {
      next();
      return;
    }
    const pathname = new URL(req.url, 'http://localhost').pathname;

    if (!authLogin || (!authPassword && !authPasswordHash) || !authSecret) {
      sendJson(res, 500, {ok: false, message: 'Autenticação não configurada no ambiente.'});
      return;
    }

    if (pathname === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, {ok: true, database: false, dev: true});
      return;
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const login = String(body.login || '');
        const password = String(body.password || '');
        const valid = safeEqual(login, authLogin) && await validatePassword(password);

        if (!valid) {
          sendJson(res, 401, {ok: false, message: 'Login ou senha inválidos.'});
          return;
        }

        res.setHeader(
          'Set-Cookie',
          `${AUTH_COOKIE_NAME}=${signToken(authLogin, authSecret)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${AUTH_TOKEN_TTL_MS / 1000}`
        );
        sendJson(res, 200, {
          ok: true,
          user: {login: authLogin, displayName: authDisplayName},
        });
      } catch {
        sendJson(res, 400, {ok: false, message: 'Requisição inválida.'});
      }
      return;
    }

    if (pathname === '/api/auth/session' && req.method === 'GET') {
      const authorization = req.headers.authorization || '';
      const token = authorization.startsWith('Bearer ')
        ? authorization.slice(7)
        : decodeURIComponent(getCookieValue(req, AUTH_COOKIE_NAME) || '');
      if (!token || !verifyToken(token, authLogin, authSecret)) {
        sendJson(res, 200, {ok: false});
        return;
      }
      sendJson(res, 200, {ok: true, user: {login: authLogin, displayName: authDisplayName}});
      return;
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
      sendJson(res, 200, {ok: true});
      return;
    }

    const token = decodeURIComponent(getCookieValue(req, AUTH_COOKIE_NAME) || '');
    if (!token || !verifyToken(token, authLogin, authSecret)) {
      sendJson(res, 401, {ok: false, message: 'Sessão inválida.'});
      return;
    }

    if (pathname === '/api/bootstrap' && req.method === 'GET') {
      sendJson(res, 200, {ok: true, ...devSnapshot, accessories: flattenProductsToAccessories(devSnapshot.products)});
      return;
    }

    if (pathname === '/api/state' && req.method === 'PUT') {
      try {
        const body = await readJsonBody(req);
        devSnapshot = {
          products: Array.isArray(body.products) ? body.products as Product[] : devSnapshot.products,
          sales: Array.isArray(body.sales) ? body.sales as Sale[] : devSnapshot.sales,
          saleItems: Array.isArray(body.saleItems) ? body.saleItems as SaleItem[] : devSnapshot.saleItems,
          followups: Array.isArray(body.followups) ? body.followups as Followup[] : devSnapshot.followups,
          events: Array.isArray(body.events) ? body.events as SaleEvent[] : devSnapshot.events,
          settings: body.settings ? body.settings as Settings : devSnapshot.settings,
          carModels: Array.isArray(body.carModels) ? body.carModels as CarModel[] : devSnapshot.carModels,
        };
        sendJson(res, 200, {ok: true});
      } catch {
        sendJson(res, 400, {ok: false, message: 'Dados inválidos.'});
      }
      return;
    }

    if (pathname === '/api/import/local-storage' && req.method === 'POST') {
      try {
        const payload = await readJsonBody(req) as unknown as CRMExportPayload;
        const sections = payload.sections || [];
        devSnapshot = {
          products: sections.includes('products') && Array.isArray(payload.data?.products) ? payload.data.products : devSnapshot.products,
          sales: sections.includes('sales') && Array.isArray(payload.data?.sales) ? payload.data.sales : devSnapshot.sales,
          saleItems: sections.includes('sales') && Array.isArray(payload.data?.saleItems) ? payload.data.saleItems : devSnapshot.saleItems,
          followups: sections.includes('followups') && Array.isArray(payload.data?.followups) ? payload.data.followups : devSnapshot.followups,
          events: sections.includes('events') && Array.isArray(payload.data?.events) ? payload.data.events : devSnapshot.events,
          settings: sections.includes('settings') && payload.data?.settings ? payload.data.settings : devSnapshot.settings,
          carModels: sections.includes('vehicles') && Array.isArray(payload.data?.carModels) ? payload.data.carModels : devSnapshot.carModels,
        };
        sendJson(res, 200, {ok: true, importedSections: sections, skippedSections: []});
      } catch {
        sendJson(res, 400, {ok: false, message: 'Arquivo inválido.'});
      }
      return;
    }

    if (pathname === '/api/export/json' && req.method === 'GET') {
      sendJson(res, 200, {
        schema: 'crm-thayna-reis-export',
        version: 1,
        exportedAt: new Date().toISOString(),
        source: 'CRM Thayná Reis',
        sections: ['products', 'sales', 'followups', 'events', 'settings', 'vehicles'],
        data: {
          products: devSnapshot.products,
          accessories: flattenProductsToAccessories(devSnapshot.products),
          sales: devSnapshot.sales,
          saleItems: devSnapshot.saleItems,
          followups: devSnapshot.followups,
          events: devSnapshot.events,
          settings: devSnapshot.settings,
          carModels: devSnapshot.carModels,
        },
      });
      return;
    }

    sendJson(res, 404, {ok: false});
  };
};

const authPlugin = (mode: string): Plugin => {
  const env = loadEnv(mode, process.cwd(), '');
  const middleware = createAuthMiddleware(env);

  return {
    name: 'crm-private-env-auth',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
};

export default defineConfig(({mode}) => {
  const hmrEnabled = process.env.ENABLE_HMR === 'true';

  return {
    plugins: [authPlugin(mode), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: hmrEnabled,
      watch: hmrEnabled
        ? {
            ignored: ['**/dist/**', '**/node_modules/**'],
          }
        : null,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react-vendor';
            if (id.includes('node_modules/lucide-react') || id.includes('node_modules/motion')) return 'ui-vendor';
            if (id.includes('src/data/russiAccessories.generated')) return 'catalog-data';
            if (
              id.includes('src/components/VendaForm') ||
              id.includes('src/components/SettingsModal') ||
              id.includes('src/components/FilmSimulatorModal')
            ) {
              return 'proposal-ui';
            }
          },
        },
      },
    },
  };
});
