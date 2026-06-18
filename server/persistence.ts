import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CarModel,
  CRMExportPayload,
  Followup,
  Product,
  Sale,
  SaleEvent,
  SaleItem,
  Settings,
} from '../src/types.js';
import { INITIAL_PRODUCTS, flattenProductsToAccessories } from '../src/data/accessories.js';
import {
  DEFAULT_SETTINGS,
  INITIAL_EVENTS,
  INITIAL_FOLLOWUPS,
  INITIAL_SALE_ITEMS,
  INITIAL_SALES,
  sanitizeSettings,
} from '../src/data/seeds.js';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || 'postgresql://invalid:invalid@localhost:5432/invalid',
});

export const prisma = new PrismaClient({ adapter });

export interface CrmSnapshot {
  products: Product[];
  sales: Sale[];
  saleItems: SaleItem[];
  followups: Followup[];
  events: SaleEvent[];
  settings: Settings;
  carModels: CarModel[];
}

export const INITIAL_CAR_MODELS: CarModel[] = [
  { id: 'm_1', name: 'Tiggo 5', versions: [{ name: 'Geral', years: ['2025', '2026', '2027'] }] },
  {
    id: 'm_2',
    name: 'Tiggo 7',
    versions: [{ name: 'SPORT/ PRO MAX DRIVE/ PRO HYBRID MAX DRIVE/ PRO PLUG-IN HYBRID', years: ['2025', '2026'] }],
  },
  {
    id: 'm_3',
    name: 'Tiggo 8',
    versions: [{ name: 'PRO/ PRO PLUG-IN HYBRID', years: ['2025', '2026'] }],
  },
];

const cents = (value: number | null | undefined) => Math.round((Number(value) || 0) * 100);
const money = (value: number | null | undefined) => (Number(value) || 0) / 100;
const dateValue = (value: string | Date | null | undefined) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};
const dateIso = (value: Date | null | undefined) => (value ? value.toISOString() : '');

const jsonValue = (value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  value === undefined || value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);

const readJson = <T>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined || value === Prisma.JsonNull) return fallback;
  return value as T;
};

const slug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

const initialSnapshot = (): CrmSnapshot => ({
  products: INITIAL_PRODUCTS,
  sales: INITIAL_SALES,
  saleItems: INITIAL_SALE_ITEMS,
  followups: INITIAL_FOLLOWUPS,
  events: INITIAL_EVENTS,
  settings: sanitizeSettings(DEFAULT_SETTINGS),
  carModels: INITIAL_CAR_MODELS,
});

export const exportPayloadFromSnapshot = (snapshot: CrmSnapshot, sections: CRMExportPayload['sections']): CRMExportPayload => {
  const selected = Array.from(new Set(sections));
  return {
    schema: 'crm-thayna-reis-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    source: 'CRM Thayná Reis',
    sections: selected,
    data: {
      products: selected.includes('products') ? snapshot.products : undefined,
      accessories: selected.includes('products') ? flattenProductsToAccessories(snapshot.products) : undefined,
      sales: selected.includes('sales') ? snapshot.sales : undefined,
      saleItems: selected.includes('sales') ? snapshot.saleItems : undefined,
      followups: selected.includes('followups') ? snapshot.followups : undefined,
      events: selected.includes('events') ? snapshot.events : undefined,
      settings: selected.includes('settings') ? snapshot.settings : undefined,
      carModels: selected.includes('vehicles') ? snapshot.carModels : undefined,
    },
  };
};

export const ensureSeedData = async () => {
  const settings = await prisma.setting.findUnique({ where: { id: 'singleton' } });
  if (settings) return;
  await replaceSnapshot(initialSnapshot());
};

export const loadSnapshot = async (): Promise<CrmSnapshot> => {
  await ensureSeedData();

  const [settingRow, carRows, productRows, saleRows, itemRows, followupRows, eventRows] = await Promise.all([
    prisma.setting.findUnique({ where: { id: 'singleton' } }),
    prisma.carModel.findMany({
      include: { versions: { include: { years: true }, orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.product.findMany({
      include: {
        compatibilities: true,
        variations: { include: { compatibilities: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    prisma.sale.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.saleItem.findMany({ orderBy: { id: 'asc' } }),
    prisma.followup.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.saleEvent.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);

  const products: Product[] = productRows.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    imageUrl: product.imageUrl || undefined,
    attributes: readJson(product.attributes, undefined),
    compatibilities: product.compatibilities.map(({ model, version, year }) => ({
      model,
      version: version || undefined,
      year: year || undefined,
    })),
    universal: product.universal,
    active: product.active,
    variations: product.variations.map((variation) => ({
      id: variation.id,
      name: variation.name,
      description: variation.description,
      imageUrl: variation.imageUrl || undefined,
      attributes: readJson(variation.attributes, undefined),
      price: money(variation.priceCents),
      commissionBonusAmount: variation.commissionBonusCents === null ? undefined : money(variation.commissionBonusCents),
      commissionBonusPercent: variation.commissionBonusPercent ?? undefined,
      timeEstimate: variation.timeEstimate,
      compatibilities: variation.compatibilities.map(({ model, version, year }) => ({
        model,
        version: version || undefined,
        year: year || undefined,
      })),
      active: variation.active,
      sku: variation.sku || undefined,
      legacyAccessoryIds: readJson<string[] | undefined>(variation.legacyAccessoryIds, undefined),
    })),
  }));

  return {
    products,
    sales: saleRows.map((sale) => ({
      id: sale.id,
      clientName: sale.clientName,
      clientPhone: sale.clientPhone,
      carModel: sale.carModel,
      carVersion: sale.carVersion,
      carYear: sale.carYear,
      carSalespersonName: sale.carSalespersonName || undefined,
      installerName: sale.installerName,
      installationDate: sale.installationDate,
      discount: money(sale.discountCents),
      subtotal: money(sale.subtotalCents),
      total: money(sale.totalCents),
      status: sale.status as Sale['status'],
      lostReason: sale.lostReason || undefined,
      internalNotes: sale.internalNotes,
      createdAt: dateIso(sale.createdAt),
      commissionPercent: sale.commissionPercent,
      commissionAmount: money(sale.commissionCents),
      baseCommissionAmount: sale.baseCommissionCents === null ? undefined : money(sale.baseCommissionCents),
      productBonusAmount: sale.productBonusCents === null ? undefined : money(sale.productBonusCents),
      goalExtraAmount: sale.goalExtraCents === null ? undefined : money(sale.goalExtraCents),
      goalBonusAmount: sale.goalBonusCents === null ? undefined : money(sale.goalBonusCents),
      filmConfiguration: readJson(sale.filmConfiguration, undefined),
      commissionStatus: sale.commissionStatus as Sale['commissionStatus'],
      commissionPaidAt: sale.commissionPaidAt ? sale.commissionPaidAt.toISOString() : null,
      paymentStatus: sale.paymentStatus as Sale['paymentStatus'],
      paymentForecastDate: sale.paymentForecastDate || '',
      partialPaidAmount: sale.partialPaidCents === null ? 0 : money(sale.partialPaidCents),
      installationStatus: sale.installationStatus as Sale['installationStatus'],
      installationNotes: sale.installationNotes || '',
    })),
    saleItems: itemRows.map((item) => ({
      id: item.id,
      saleId: item.saleId,
      accessoryId: item.accessoryId,
      productId: item.productId || undefined,
      variationId: item.variationId || undefined,
      vehicleModel: item.vehicleModel || undefined,
      productName: item.productName || undefined,
      variationName: item.variationName || undefined,
      description: item.description || undefined,
      timeEstimate: item.timeEstimate ?? undefined,
      name: item.name,
      price: money(item.priceCents),
    })),
    followups: followupRows.map((followup) => ({
      id: followup.id,
      saleId: followup.saleId,
      clientName: followup.clientName,
      carModel: followup.carModel,
      type: followup.type as Followup['type'],
      status: followup.status as Followup['status'],
      dueDate: followup.dueDate,
      notes: followup.notes,
      createdAt: dateIso(followup.createdAt),
    })),
    events: eventRows.map((event) => ({
      id: event.id,
      saleId: event.saleId,
      type: event.type,
      description: event.description,
      createdAt: dateIso(event.createdAt),
      field: event.field || undefined,
      previousValue: event.previousValue || undefined,
      nextValue: event.nextValue || undefined,
      changedBy: event.changedBy || undefined,
    })),
    settings: sanitizeSettings(readJson<Settings>(settingRow?.data, DEFAULT_SETTINGS)),
    carModels: carRows.map((model) => ({
      id: model.id,
      name: model.name,
      versions: model.versions.map((version) => ({
        name: version.name,
        years: version.years.map((year) => year.year),
      })),
    })),
  };
};

export const replaceSnapshot = async (snapshot: CrmSnapshot) => {
  await prisma.$transaction(async (tx) => {
    await tx.saleEvent.deleteMany();
    await tx.followup.deleteMany();
    await tx.saleItem.deleteMany();
    await tx.sale.deleteMany();
    await tx.vehicleCompatibility.deleteMany();
    await tx.productVariation.deleteMany();
    await tx.product.deleteMany();
    await tx.carYear.deleteMany();
    await tx.carVersion.deleteMany();
    await tx.carModel.deleteMany();

    await tx.setting.upsert({
      where: { id: 'singleton' },
      update: { data: jsonValue(sanitizeSettings(snapshot.settings)) },
      create: { id: 'singleton', data: jsonValue(sanitizeSettings(snapshot.settings)) },
    });

    for (const model of snapshot.carModels) {
      await tx.carModel.create({ data: { id: model.id, name: model.name, active: true } });
      for (const [versionIndex, version] of model.versions.entries()) {
        const versionId = `${model.id}_v_${versionIndex}_${slug(version.name) || 'geral'}`;
        await tx.carVersion.create({ data: { id: versionId, modelId: model.id, name: version.name, active: true } });
        for (const [yearIndex, year] of version.years.entries()) {
          await tx.carYear.create({
            data: { id: `${versionId}_y_${yearIndex}_${slug(year) || yearIndex}`, versionId, year, active: true },
          });
        }
      }
    }

    for (const product of snapshot.products) {
      await tx.product.create({
        data: {
          id: product.id,
          name: product.name,
          description: product.description || '',
          category: product.category || 'Outro',
          imageUrl: product.imageUrl || null,
          attributes: jsonValue(product.attributes),
          universal: Boolean(product.universal),
          active: product.active !== false,
        },
      });
      for (const compatibility of product.compatibilities || []) {
        await tx.vehicleCompatibility.create({
          data: { productId: product.id, model: compatibility.model, version: compatibility.version, year: compatibility.year },
        });
      }
      for (const variation of product.variations || []) {
        await tx.productVariation.create({
          data: {
            id: variation.id,
            productId: product.id,
            name: variation.name,
            description: variation.description || product.description || '',
            imageUrl: variation.imageUrl || null,
            attributes: jsonValue(variation.attributes),
            priceCents: cents(variation.price),
            commissionBonusCents:
              variation.commissionBonusAmount === undefined ? null : cents(variation.commissionBonusAmount),
            commissionBonusPercent: variation.commissionBonusPercent ?? null,
            timeEstimate: Number(variation.timeEstimate) || 0,
            active: variation.active !== false,
            sku: variation.sku || null,
            legacyAccessoryIds: jsonValue(variation.legacyAccessoryIds),
          },
        });
        for (const compatibility of variation.compatibilities || []) {
          await tx.vehicleCompatibility.create({
            data: { variationId: variation.id, model: compatibility.model, version: compatibility.version, year: compatibility.year },
          });
        }
      }
    }

    const saleIds = new Set(snapshot.sales.map((sale) => sale.id));
    for (const sale of snapshot.sales) {
      await tx.sale.create({
        data: {
          id: sale.id,
          clientName: sale.clientName,
          clientPhone: sale.clientPhone,
          carModel: sale.carModel,
          carVersion: sale.carVersion,
          carYear: sale.carYear,
          carSalespersonName: sale.carSalespersonName || null,
          installerName: sale.installerName || '',
          installationDate: sale.installationDate || '',
          discountCents: cents(sale.discount),
          subtotalCents: cents(sale.subtotal),
          totalCents: cents(sale.total),
          status: sale.status,
          lostReason: sale.lostReason || null,
          internalNotes: sale.internalNotes || '',
          createdAt: dateValue(sale.createdAt),
          commissionPercent: Number(sale.commissionPercent) || 0,
          commissionCents: cents(sale.commissionAmount),
          baseCommissionCents: sale.baseCommissionAmount === undefined ? null : cents(sale.baseCommissionAmount),
          productBonusCents: sale.productBonusAmount === undefined ? null : cents(sale.productBonusAmount),
          goalExtraCents: sale.goalExtraAmount === undefined ? null : cents(sale.goalExtraAmount),
          goalBonusCents: sale.goalBonusAmount === undefined ? null : cents(sale.goalBonusAmount),
          filmConfiguration: jsonValue(sale.filmConfiguration),
          commissionStatus: sale.commissionStatus,
          commissionPaidAt: sale.commissionPaidAt ? dateValue(sale.commissionPaidAt) : null,
          paymentStatus: sale.paymentStatus,
          paymentForecastDate: sale.paymentForecastDate || '',
          partialPaidCents: sale.partialPaidAmount === undefined ? null : cents(sale.partialPaidAmount),
          installationStatus: sale.installationStatus,
          installationNotes: sale.installationNotes || '',
        },
      });
    }

    for (const item of snapshot.saleItems.filter((item) => saleIds.has(item.saleId))) {
      await tx.saleItem.create({
        data: {
          id: item.id,
          saleId: item.saleId,
          accessoryId: item.accessoryId,
          productId: item.productId || null,
          variationId: item.variationId || null,
          vehicleModel: item.vehicleModel || null,
          productName: item.productName || null,
          variationName: item.variationName || null,
          description: item.description || null,
          timeEstimate: item.timeEstimate ?? null,
          name: item.name,
          priceCents: cents(item.price),
        },
      });
    }

    for (const followup of snapshot.followups.filter((followup) => saleIds.has(followup.saleId))) {
      await tx.followup.create({
        data: {
          id: followup.id,
          saleId: followup.saleId,
          clientName: followup.clientName,
          carModel: followup.carModel,
          type: followup.type,
          status: followup.status,
          dueDate: followup.dueDate,
          notes: followup.notes || '',
          createdAt: dateValue(followup.createdAt),
        },
      });
    }

    for (const event of snapshot.events.filter((event) => saleIds.has(event.saleId))) {
      await tx.saleEvent.create({
        data: {
          id: event.id,
          saleId: event.saleId,
          type: event.type,
          description: event.description,
          createdAt: dateValue(event.createdAt),
          field: event.field || null,
          previousValue: event.previousValue || null,
          nextValue: event.nextValue || null,
          changedBy: event.changedBy || null,
        },
      });
    }
  });
};

export const mergeAndReplaceSnapshot = async (
  data: Partial<CRMExportPayload['data']>,
  sections: CRMExportPayload['sections']
) => {
  const current = await loadSnapshot();
  const next: CrmSnapshot = {
    products: sections.includes('products') && Array.isArray(data.products) ? data.products : current.products,
    sales: sections.includes('sales') && Array.isArray(data.sales) ? data.sales : current.sales,
    saleItems: sections.includes('sales') && Array.isArray(data.saleItems) ? data.saleItems : current.saleItems,
    followups: sections.includes('followups') && Array.isArray(data.followups) ? data.followups : current.followups,
    events: sections.includes('events') && Array.isArray(data.events) ? data.events : current.events,
    settings: sections.includes('settings') && data.settings ? sanitizeSettings(data.settings) : current.settings,
    carModels: sections.includes('vehicles') && Array.isArray(data.carModels) ? data.carModels : current.carModels,
  };
  await replaceSnapshot(next);
  return next;
};
