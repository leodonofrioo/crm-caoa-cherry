import 'dotenv/config';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { z } from 'zod';
import { loginHandler, logoutHandler, requireAuth, sessionHandler } from './auth.js';
import {
  CrmSnapshot,
  exportPayloadFromSnapshot,
  loadSnapshot,
  mergeAndReplaceSnapshot,
  prisma,
  replaceSnapshot,
} from './persistence.js';
import { flattenProductsToAccessories } from '../src/data/accessories.js';
import { sanitizeSettings } from '../src/data/seeds.js';

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');

const localStorageImportSchema = z.object({
  schema: z.literal('crm-thayna-reis-export'),
  version: z.number().optional(),
  sections: z.array(z.enum(['products', 'sales', 'followups', 'events', 'settings', 'vehicles'])),
  data: z.record(z.string(), z.unknown()),
});

const fullStateSchema = z.object({
  products: z.array(z.unknown()),
  sales: z.array(z.unknown()),
  saleItems: z.array(z.unknown()),
  followups: z.array(z.unknown()),
  events: z.array(z.unknown()),
  settings: z.record(z.string(), z.unknown()),
  carModels: z.array(z.unknown()),
});

const snapshotCounts = (snapshot: CrmSnapshot) => ({
  products: snapshot.products.length,
  variations: snapshot.products.reduce((total, product) => total + product.variations.length, 0),
  sales: snapshot.sales.length,
  saleItems: snapshot.saleItems.length,
  followups: snapshot.followups.length,
  events: snapshot.events.length,
  carModels: snapshot.carModels.length,
});

export const createApp = () => {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, database: true });
    } catch {
      res.status(503).json({ ok: false, database: false });
    }
  });

  app.post('/api/auth/login', loginHandler);
  app.post('/api/auth/logout', logoutHandler);
  app.get('/api/auth/session', sessionHandler);

  app.use('/api', requireAuth);

  app.get('/api/bootstrap', async (_req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      res.json({ ok: true, ...snapshot, accessories: flattenProductsToAccessories(snapshot.products) });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/state', async (req, res, next) => {
    try {
      const parsed = fullStateSchema.parse(req.body);
      const snapshot = parsed as unknown as CrmSnapshot;
      await replaceSnapshot(snapshot);
      res.json({ ok: true, counts: snapshotCounts(snapshot) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/products', async (_req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      res.json({ ok: true, products: snapshot.products });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/products', async (req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      const product = req.body;
      const duplicate = snapshot.products.some(
        (item) => item.active !== false && item.name?.toLowerCase() === product.name?.toLowerCase() && item.category?.toLowerCase() === product.category?.toLowerCase()
      );
      if (duplicate) {
        res.status(409).json({ ok: false, message: 'Produto já cadastrado nesta categoria.' });
        return;
      }
      const next = { ...snapshot, products: [...snapshot.products, product] };
      await replaceSnapshot(next);
      res.status(201).json({ ok: true, product });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/products/:id', async (req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      const products = snapshot.products.map((product) => product.id === req.params.id ? { ...product, ...req.body } : product);
      await replaceSnapshot({ ...snapshot, products });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/products/:id', async (req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      const products = snapshot.products.map((product) => product.id === req.params.id ? { ...product, active: false } : product);
      await replaceSnapshot({ ...snapshot, products });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/products/:id/variations', async (req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      const products = snapshot.products.map((product) => {
        if (product.id !== req.params.id) return product;
        const duplicate = product.variations.some(
          (variation) => variation.active !== false && variation.name?.toLowerCase() === req.body?.name?.toLowerCase()
        );
        if (duplicate) throw Object.assign(new Error('Variação já cadastrada neste produto.'), { statusCode: 409 });
        return { ...product, variations: [...product.variations, req.body] };
      });
      await replaceSnapshot({ ...snapshot, products });
      res.status(201).json({ ok: true, variation: req.body });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/products/:id/variations/:variationId', async (req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      const products = snapshot.products.map((product) =>
        product.id === req.params.id
          ? {
              ...product,
              variations: product.variations.map((variation) =>
                variation.id === req.params.variationId ? { ...variation, ...req.body } : variation
              ),
            }
          : product
      );
      await replaceSnapshot({ ...snapshot, products });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/products/:id/variations/:variationId', async (req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      const products = snapshot.products.map((product) =>
        product.id === req.params.id
          ? {
              ...product,
              variations: product.variations.map((variation) =>
                variation.id === req.params.variationId ? { ...variation, active: false } : variation
              ),
            }
          : product
      );
      await replaceSnapshot({ ...snapshot, products });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/sales', async (_req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      res.json({ ok: true, sales: snapshot.sales, saleItems: snapshot.saleItems });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/sales', async (req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      const sale = req.body?.sale;
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      if (!sale?.id) {
        res.status(400).json({ ok: false, message: 'Venda inválida.' });
        return;
      }
      const next = { ...snapshot, sales: [sale, ...snapshot.sales], saleItems: [...items, ...snapshot.saleItems] };
      await replaceSnapshot(next);
      res.status(201).json({ ok: true, sale, items });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/sales/:id', async (req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      const sales = snapshot.sales.map((sale) => sale.id === req.params.id ? { ...sale, ...req.body } : sale);
      await replaceSnapshot({ ...snapshot, sales });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/sales/:id', async (req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      await replaceSnapshot({
        ...snapshot,
        sales: snapshot.sales.filter((sale) => sale.id !== req.params.id),
        saleItems: snapshot.saleItems.filter((item) => item.saleId !== req.params.id),
        followups: snapshot.followups.filter((followup) => followup.saleId !== req.params.id),
        events: snapshot.events.filter((event) => event.saleId !== req.params.id),
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/sales/:id/status', async (req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      const sales = snapshot.sales.map((sale) => {
        if (sale.id !== req.params.id) return sale;
        const status = req.body?.status || sale.status;
        return {
          ...sale,
          status,
          lostReason: status === 'Perdido' ? req.body?.lostReason || sale.lostReason : sale.lostReason,
          commissionStatus: status === 'Perdido' ? 'Cancelado' : sale.commissionStatus,
          installationStatus: status === 'Perdido' ? 'Cancelada' : sale.installationStatus,
          paymentStatus: status === 'Perdido' ? 'Cancelada' : sale.paymentStatus,
        };
      });
      await replaceSnapshot({ ...snapshot, sales });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/sales/:id/commission-received', async (req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      const now = new Date().toISOString();
      const sales = snapshot.sales.map((sale) =>
        sale.id === req.params.id ? { ...sale, commissionStatus: 'Recebido' as const, commissionPaidAt: now } : sale
      );
      await replaceSnapshot({ ...snapshot, sales });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/followups', async (_req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      res.json({ ok: true, followups: snapshot.followups });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/followups', async (req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      const followups = [req.body, ...snapshot.followups];
      await replaceSnapshot({ ...snapshot, followups });
      res.status(201).json({ ok: true, followup: req.body });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/followups/:id', async (req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      const followups = snapshot.followups.map((followup) => followup.id === req.params.id ? { ...followup, ...req.body } : followup);
      await replaceSnapshot({ ...snapshot, followups });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/followups/:id', async (req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      const followups = snapshot.followups.filter((followup) => followup.id !== req.params.id);
      await replaceSnapshot({ ...snapshot, followups });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/events', async (req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      const events = [req.body, ...snapshot.events];
      await replaceSnapshot({ ...snapshot, events });
      res.status(201).json({ ok: true, event: req.body });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/settings', async (_req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      res.json({ ok: true, settings: snapshot.settings });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/settings', async (req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      const settings = sanitizeSettings({ ...snapshot.settings, ...req.body });
      await replaceSnapshot({ ...snapshot, settings });
      res.json({ ok: true, settings });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/car-catalog', async (_req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      res.json({ ok: true, carModels: snapshot.carModels });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/car-catalog', async (req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      const carModels = Array.isArray(req.body?.carModels) ? req.body.carModels : [];
      await replaceSnapshot({ ...snapshot, carModels });
      res.json({ ok: true, carModels });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/import/local-storage', async (req, res, next) => {
    try {
      const payload = localStorageImportSchema.parse(req.body);
      const snapshot = await mergeAndReplaceSnapshot(payload.data, payload.sections);
      res.json({ ok: true, importedSections: payload.sections, skippedSections: [], counts: snapshotCounts(snapshot) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/export/json', async (req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      const sections = String(req.query.sections || 'products,sales,followups,events,settings,vehicles')
        .split(',')
        .filter(Boolean) as Array<'products' | 'sales' | 'followups' | 'events' | 'settings' | 'vehicles'>;
      res.json(exportPayloadFromSnapshot(snapshot, sections));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/backup-json', async (_req, res, next) => {
    try {
      const snapshot = await loadSnapshot();
      res.json(exportPayloadFromSnapshot(snapshot, ['products', 'sales', 'followups', 'events', 'settings', 'vehicles']));
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ ok: false, message: 'Rota não encontrada.' });
  });

  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const explicitStatus = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : undefined;
    const status = explicitStatus || (error instanceof z.ZodError ? 400 : 500);
    res.status(status).json({
      ok: false,
      message: error instanceof Error && status < 500 ? error.message : status === 400 ? 'Dados inválidos.' : 'Erro interno do servidor.',
    });
  });

  return app;
};
