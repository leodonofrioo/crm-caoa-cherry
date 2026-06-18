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
  dealerName: 'CAOA Chery',
  targetPerClient: 2000,
  goalBonusAmount: 0,
  goalExtraCommissionPercent: 0.5,
  commissionPlanVersion: 2,
  carSalespeople: ['Equipe CAOA Chery', 'Consultor Showroom', 'Vendedor Digital'],
  installers: ['Oficina Central', 'Equipe Técnica CAOA Chery'],
  productCategories: DEFAULT_PRODUCT_CATEGORIES,
};

export const INITIAL_SALES: Sale[] = [];

export const INITIAL_SALE_ITEMS: SaleItem[] = [];

export const INITIAL_FOLLOWUPS: Followup[] = [];

export const INITIAL_EVENTS: SaleEvent[] = [];
