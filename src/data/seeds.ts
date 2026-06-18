import { Sale, SaleItem, Followup, SaleEvent, Settings } from '../types.js';

export const DEFAULT_PRODUCT_CATEGORIES = [
  'Película Solar',
  'Película',
  'Tapete',
  'Proteção',
  'Segurança',
  'Estética',
  'Tecnologia',
  'Iluminação',
  'Serviço',
  'Outro',
];

export const DEFAULT_SETTINGS: Settings = {
  commissionPercent: 1.7,
  dealerName: 'CRM Thayná Reis',
  targetPerClient: 2000,
  goalBonusAmount: 0,
  goalExtraCommissionPercent: 0.5,
  commissionPlanVersion: 2,
  carSalespeople: ['Equipe Comercial', 'Consultor Showroom', 'Vendedor Digital'],
  installers: ['Oficina Central', 'Equipe Técnica'],
  productCategories: DEFAULT_PRODUCT_CATEGORIES,
};

const LEGACY_DEALER_GROUP = ['C', 'A', 'O', 'A'].join('');
const LEGACY_MODEL_GROUP = ['C', 'h', 'e', 'r', 'y'].join('');
const LEGACY_BRAND_NAME = new RegExp(`\\b${LEGACY_DEALER_GROUP}(?:\\s+${LEGACY_MODEL_GROUP})?\\b`, 'i');

const sanitizeLegacyBrandValue = (value: string | undefined, fallback: string) => {
  const trimmed = value?.trim();
  if (!trimmed || LEGACY_BRAND_NAME.test(trimmed)) return fallback;
  return trimmed;
};

export const sanitizeSettings = (settings: Partial<Settings> | undefined): Settings => {
  const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  return {
    ...merged,
    dealerName: sanitizeLegacyBrandValue(merged.dealerName, DEFAULT_SETTINGS.dealerName),
    carSalespeople: (merged.carSalespeople || DEFAULT_SETTINGS.carSalespeople || []).map((name) =>
      sanitizeLegacyBrandValue(name, 'Equipe Comercial')
    ),
    installers: (merged.installers || DEFAULT_SETTINGS.installers || []).map((name) =>
      sanitizeLegacyBrandValue(name, 'Equipe Técnica')
    ),
  };
};

export const INITIAL_SALES: Sale[] = [];

export const INITIAL_SALE_ITEMS: SaleItem[] = [];

export const INITIAL_FOLLOWUPS: Followup[] = [];

export const INITIAL_EVENTS: SaleEvent[] = [];
