import { SalesStatus } from '../types.js';

export const SALES_STATUSES: SalesStatus[] = [
  'Novo cliente',
  'Orçamento enviado',
  'Aprovado',
  'Aguardando instalação',
  'Pronto para entrega',
  'Entregue',
  'Perdido',
];

export const isSalesStatus = (value: unknown): value is SalesStatus =>
  typeof value === 'string' && SALES_STATUSES.includes(value as SalesStatus);

export const coerceSalesStatus = (value: unknown, fallback: SalesStatus = 'Novo cliente'): SalesStatus =>
  isSalesStatus(value) ? value : fallback;
