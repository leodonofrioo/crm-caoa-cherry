import { InstallationStatus, PaymentStatus, Sale, SaleItem } from '../types';

export type InstallationRadarLevel = 'green' | 'yellow' | 'orange' | 'red' | 'gray';

export interface InstallationRadar {
  level: InstallationRadarLevel;
  label: string;
  daysUntil: number | null;
  dotClass: string;
  badgeClass: string;
  cardClass: string;
}

export interface PaymentSignal {
  label: string;
  detail: string;
  badgeClass: string;
  critical: boolean;
}

export interface InstallationEntry {
  id: string;
  sale: Sale;
  items: SaleItem[];
  effectiveStatus: InstallationStatus;
  radar: InstallationRadar;
  paymentSignal: PaymentSignal;
  accessoriesText: string;
  responsible: string;
}

export const PAYMENT_STATUSES: PaymentStatus[] = [
  'Não paga',
  'Pagamento previsto',
  'Paga parcialmente',
  'Paga',
  'Cancelada',
];

export const INSTALLATION_STATUSES: InstallationStatus[] = [
  'Sem data definida',
  'Agendada',
  'Aguardando pagamento',
  'Aguardando peça ou acessório',
  'Pronta para instalar',
  'Em instalação',
  'Instalada',
  'Reagendada',
  'Cancelada',
  'Atrasada',
];

export const INSTALLATION_RADAR_THRESHOLDS = {
  greenMinDays: 6,
  yellowMinDays: 3,
  orangeMinDays: 1,
};

export const isClosedInstallationStatus = (status: InstallationStatus | undefined) =>
  status === 'Instalada' || status === 'Cancelada';

export const parseLocalDate = (date: string) => new Date(`${date}T12:00:00`);

export const formatDateBR = (date?: string) => {
  if (!date) return 'Sem data';
  return parseLocalDate(date).toLocaleDateString('pt-BR');
};

export const addDays = (date: string, days: number) => {
  const parsed = parseLocalDate(date);
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().split('T')[0];
};

export const diffDays = (fromDate: string, toDate: string) => {
  const start = parseLocalDate(fromDate).getTime();
  const end = parseLocalDate(toDate).getTime();
  return Math.round((end - start) / 86400000);
};

export const getEffectiveInstallationStatus = (sale: Sale, today: string): InstallationStatus => {
  const status = sale.installationStatus || (sale.installationDate ? 'Agendada' : 'Sem data definida');
  if (isClosedInstallationStatus(status)) return status;
  if (!sale.installationDate) return 'Sem data definida';
  if (diffDays(today, sale.installationDate) < 0) return 'Atrasada';
  return status;
};

export const getInstallationRadar = (sale: Sale, today: string): InstallationRadar => {
  const effectiveStatus = getEffectiveInstallationStatus(sale, today);
  if (!sale.installationDate) {
    return {
      level: 'gray',
      label: 'Sem data',
      daysUntil: null,
      dotClass: 'bg-slate-400',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      cardClass: 'border-slate-200 bg-white',
    };
  }

  const daysUntil = diffDays(today, sale.installationDate);
  if (effectiveStatus === 'Atrasada') {
    return {
      level: 'red',
      label: `${Math.abs(daysUntil)} dia(s) atrasada`,
      daysUntil,
      dotClass: 'bg-red-500',
      badgeClass: 'bg-red-50 text-red-700 border-red-100',
      cardClass: 'border-red-200 bg-red-50/35',
    };
  }
  if (daysUntil >= INSTALLATION_RADAR_THRESHOLDS.greenMinDays) {
    return {
      level: 'green',
      label: `${daysUntil} dia(s)`,
      daysUntil,
      dotClass: 'bg-emerald-500',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      cardClass: 'border-emerald-100 bg-white',
    };
  }
  if (daysUntil >= INSTALLATION_RADAR_THRESHOLDS.yellowMinDays) {
    return {
      level: 'yellow',
      label: `${daysUntil} dia(s)`,
      daysUntil,
      dotClass: 'bg-yellow-400',
      badgeClass: 'bg-yellow-50 text-yellow-800 border-yellow-100',
      cardClass: 'border-yellow-100 bg-yellow-50/25',
    };
  }
  if (daysUntil >= INSTALLATION_RADAR_THRESHOLDS.orangeMinDays) {
    return {
      level: 'orange',
      label: `${daysUntil} dia(s)`,
      daysUntil,
      dotClass: 'bg-orange-500',
      badgeClass: 'bg-orange-50 text-orange-700 border-orange-100',
      cardClass: 'border-orange-200 bg-orange-50/30',
    };
  }
  return {
    level: 'orange',
    label: 'Hoje',
    daysUntil,
    dotClass: 'bg-orange-500',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-100',
    cardClass: 'border-orange-200 bg-orange-50/30',
  };
};

export const getPaymentSignal = (sale: Sale, radar: InstallationRadar, today: string): PaymentSignal => {
  const status = sale.paymentStatus || 'Não paga';
  if (status === 'Paga') {
    return {
      label: 'Liberada',
      detail: 'Pagamento confirmado',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      critical: false,
    };
  }
  if (status === 'Cancelada') {
    return {
      label: 'Pagamento cancelado',
      detail: 'Não liberar instalação',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-100',
      critical: true,
    };
  }
  if (status === 'Pagamento previsto') {
    const overdue = sale.paymentForecastDate ? diffDays(today, sale.paymentForecastDate) < 0 : false;
    return {
      label: overdue ? 'Pagamento atrasado' : 'Pagamento previsto',
      detail: sale.paymentForecastDate ? `Previsto: ${formatDateBR(sale.paymentForecastDate)}` : 'Sem previsão',
      badgeClass: overdue ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100',
      critical: overdue,
    };
  }
  if (status === 'Paga parcialmente') {
    return {
      label: 'Parcial',
      detail: sale.partialPaidAmount ? `Pago: ${sale.partialPaidAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : 'Valor parcial pendente',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-100',
      critical: radar.level === 'red' || radar.level === 'orange',
    };
  }
  const critical = radar.level === 'red' || radar.level === 'orange';
  return {
    label: critical ? 'Crítico financeiro' : 'Não paga',
    detail: critical ? 'Instalação próxima sem pagamento' : 'Aguardando pagamento',
    badgeClass: critical ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-100 text-slate-600 border-slate-200',
    critical,
  };
};

export const buildInstallationEntries = (sales: Sale[], saleItems: SaleItem[], today: string): InstallationEntry[] =>
  sales
    .filter((sale) => sale.status !== 'Perdido')
    .map((sale) => {
      const items = saleItems.filter((item) => item.saleId === sale.id);
      const effectiveStatus = getEffectiveInstallationStatus(sale, today);
      const radar = getInstallationRadar(sale, today);
      return {
        id: sale.id,
        sale,
        items,
        effectiveStatus,
        radar,
        paymentSignal: getPaymentSignal(sale, radar, today),
        accessoriesText: items.length > 0 ? items.map((item) => item.name).join(', ') : 'Sem acessórios cadastrados',
        responsible: sale.installerName || sale.carSalespersonName || 'Não definido',
      };
    })
    .filter((entry): entry is InstallationEntry => Boolean(entry))
    .sort((a, b) => {
      if (!a.sale.installationDate && b.sale.installationDate) return 1;
      if (a.sale.installationDate && !b.sale.installationDate) return -1;
      return (a.sale.installationDate || '').localeCompare(b.sale.installationDate || '') ||
        a.sale.clientName.localeCompare(b.sale.clientName);
    });
