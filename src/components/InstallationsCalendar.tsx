import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCRM, getSimulatedToday } from '../context/CRMContext';
import { InstallationStatus, PaymentStatus } from '../types';
import {
  addDays,
  buildInstallationEntries,
  diffDays,
  formatDateBR,
  InstallationEntry,
  INSTALLATION_STATUSES,
  parseLocalDate,
  PAYMENT_STATUSES,
} from '../utils/installationSchedule';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Filter,
  Package,
  Search,
  User,
} from 'lucide-react';
import { MobileFilterSheet, MobilePageHeader, useIsMobile } from './mobile';

type CalendarView = 'month' | 'week' | 'day' | 'list';
type QuickFilter = 'all' | 'overdue' | 'today' | 'next3' | 'next7' | 'noDate' | 'paidWaiting' | 'unpaidSoon';

interface InstallationsCalendarProps {
  onSelectSale: (saleId: string) => void;
}

const VIEW_LABELS: Record<CalendarView, string> = {
  month: 'Mês',
  week: 'Semana',
  day: 'Dia',
  list: 'Lista',
};

const QUICK_FILTERS: Array<{ id: QuickFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'overdue', label: 'Atrasadas' },
  { id: 'today', label: 'Hoje' },
  { id: 'next3', label: 'Próx. 3 dias' },
  { id: 'next7', label: 'Próx. 7 dias' },
  { id: 'noDate', label: 'Sem data' },
  { id: 'paidWaiting', label: 'Pagas aguardando' },
  { id: 'unpaidSoon', label: 'Não pagas próximas' },
];

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const monthLabel = (date: string) =>
  parseLocalDate(date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

const getMonthGrid = (date: string) => {
  const current = parseLocalDate(date);
  const firstDay = new Date(current.getFullYear(), current.getMonth(), 1, 12, 0, 0);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return {
      date: toISODate(day),
      inCurrentMonth: day.getMonth() === current.getMonth(),
    };
  });
};

const getWeekDates = (date: string) => {
  const current = parseLocalDate(date);
  const start = new Date(current);
  start.setDate(current.getDate() - current.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return toISODate(day);
  });
};

const isOpenInstallation = (entry: InstallationEntry) =>
  entry.effectiveStatus !== 'Instalada' && entry.effectiveStatus !== 'Cancelada';

function InstallationCard({ entry, onSelectSale }: { entry: InstallationEntry; onSelectSale: (saleId: string) => void }) {
  const sale = entry.sale;

  return (
    <button
      type="button"
      onClick={() => onSelectSale(sale.id)}
      className={`w-full rounded-xl border p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${entry.radar.cardClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-slate-800">{sale.clientName}</div>
          <div className="mt-0.5 truncate text-[11px] font-bold text-[#002C5F]">
            {sale.carModel} {sale.carVersion ? `· ${sale.carVersion}` : ''} {sale.carYear ? `· ${sale.carYear}` : ''}
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${entry.radar.badgeClass}`}>
          {entry.radar.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] font-semibold text-slate-600">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>{formatDateBR(sale.installationDate)} · {entry.effectiveStatus}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>{sale.paymentStatus || 'Não paga'} · {entry.paymentSignal.detail}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate">{entry.responsible}</span>
        </div>
        <div className="flex items-start gap-1.5">
          <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="line-clamp-2">{entry.accessoriesText}</span>
        </div>
      </div>

      {sale.installationNotes && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white/80 p-2 text-[10px] font-medium leading-relaxed text-slate-500">
          {sale.installationNotes}
        </div>
      )}
    </button>
  );
}

export default function InstallationsCalendar({ onSelectSale }: InstallationsCalendarProps) {
  const { sales, saleItems } = useCRM();
  const today = getSimulatedToday();
  const isMobile = useIsMobile();
  const defaultedMobileView = useRef(false);
  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState(today);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InstallationStatus | 'Todos'>('Todos');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'Todos'>('Todos');
  const [responsibleFilter, setResponsibleFilter] = useState('Todos');
  const [dateFilter, setDateFilter] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    if (!isMobile || defaultedMobileView.current) return;
    defaultedMobileView.current = true;
    setView('list');
  }, [isMobile]);

  const entries = useMemo<InstallationEntry[]>(
    () => buildInstallationEntries(sales, saleItems, today),
    [sales, saleItems, today]
  );
  const responsibleOptions = useMemo(
    () => Array.from(new Set<string>(entries.map((entry) => entry.responsible))).sort((a, b) => a.localeCompare(b)),
    [entries]
  );

  const filteredEntries = useMemo<InstallationEntry[]>(() => entries.filter((entry) => {
    const sale = entry.sale;
    const text = `${sale.clientName} ${sale.clientPhone} ${sale.carModel} ${sale.carVersion} ${entry.accessoriesText}`.toLowerCase();
    const matchesSearch = !searchTerm.trim() || text.includes(searchTerm.trim().toLowerCase());
    const matchesStatus = statusFilter === 'Todos' || entry.effectiveStatus === statusFilter;
    const matchesPayment = paymentFilter === 'Todos' || (sale.paymentStatus || 'Não paga') === paymentFilter;
    const matchesResponsible = responsibleFilter === 'Todos' || entry.responsible === responsibleFilter;
    const matchesDate = !dateFilter || sale.installationDate === dateFilter;
    const distance = sale.installationDate ? diffDays(today, sale.installationDate) : null;

    let matchesQuick = true;
    if (quickFilter === 'overdue') matchesQuick = entry.effectiveStatus === 'Atrasada';
    if (quickFilter === 'today') matchesQuick = sale.installationDate === today;
    if (quickFilter === 'next3') matchesQuick = distance !== null && distance >= 0 && distance <= 3;
    if (quickFilter === 'next7') matchesQuick = distance !== null && distance >= 0 && distance <= 7;
    if (quickFilter === 'noDate') matchesQuick = !sale.installationDate;
    if (quickFilter === 'paidWaiting') matchesQuick = sale.paymentStatus === 'Paga' && isOpenInstallation(entry);
    if (quickFilter === 'unpaidSoon') {
      matchesQuick = sale.paymentStatus !== 'Paga' && distance !== null && distance >= 0 && distance <= 3 && isOpenInstallation(entry);
    }

    return matchesSearch && matchesStatus && matchesPayment && matchesResponsible && matchesDate && matchesQuick;
  }), [dateFilter, entries, paymentFilter, quickFilter, responsibleFilter, searchTerm, statusFilter, today]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, InstallationEntry[]>();
    filteredEntries.forEach((entry) => {
      const key = entry.sale.installationDate || 'sem-data';
      map.set(key, [...(map.get(key) || []), entry]);
    });
    return map;
  }, [filteredEntries]);

  const dashboardCounts = {
    today: entries.filter((entry) => entry.sale.installationDate === today).length,
    overdue: entries.filter((entry) => entry.effectiveStatus === 'Atrasada').length,
    next3: entries.filter((entry) => {
      const distance = entry.sale.installationDate ? diffDays(today, entry.sale.installationDate) : null;
      return distance !== null && distance >= 0 && distance <= 3;
    }).length,
    noDate: entries.filter((entry) => !entry.sale.installationDate).length,
  };

  const changePeriod = (direction: -1 | 1) => {
    if (view === 'month' || view === 'list') {
      const date = parseLocalDate(currentDate);
      date.setMonth(date.getMonth() + direction);
      setCurrentDate(toISODate(date));
      return;
    }
    setCurrentDate(addDays(currentDate, direction * (view === 'week' ? 7 : 1)));
  };

  const renderDateColumn = (date: string, compact = false, muted = false) => {
    const dayEntries = entriesByDate.get(date) || [];
    const isToday = date === today;

    return (
      <div className={`min-h-[150px] rounded-xl border p-2 ${isToday ? 'border-[#002C5F] bg-blue-50/40' : 'border-slate-200 bg-white'} ${muted ? 'opacity-55' : ''}`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className={`text-[11px] font-black uppercase ${isToday ? 'text-[#002C5F]' : 'text-slate-500'}`}>
            {compact ? formatDateBR(date) : parseLocalDate(date).getDate()}
          </span>
          {dayEntries.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-500">
              {dayEntries.length}
            </span>
          )}
        </div>
        <div className="space-y-2">
          {dayEntries.slice(0, compact ? 12 : 3).map((entry) => (
            <div key={entry.id}>
              <InstallationCard entry={entry} onSelectSale={onSelectSale} />
            </div>
          ))}
          {!compact && dayEntries.length > 3 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-center text-[10px] font-bold text-slate-500">
              +{dayEntries.length - 3} no dia
            </div>
          )}
        </div>
      </div>
    );
  };

  const noDateEntries = entriesByDate.get('sem-data') || [];
  const weekDates = getWeekDates(currentDate);

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in text-slate-800">
      <MobilePageHeader
        title="Instalações"
        description="Agenda, atrasos e pagamentos próximos."
        meta={
          <button
            type="button"
            onClick={() => setShowMobileFilters(true)}
            className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase text-[#002C5F]"
          >
            <Filter className="h-3.5 w-3.5" />
            Filtros
          </button>
        }
      />

      <div className="hidden md:flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-[#002C5F]">
            Calendário de Instalações
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Agenda derivada das propostas existentes, sem cadastro duplicado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(VIEW_LABELS).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id as CalendarView)}
              className={`rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-wide transition-all ${
                view === id
                  ? 'border-[#002C5F] bg-[#002C5F] text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Hoje', dashboardCounts.today, 'border-blue-100 bg-blue-50/60 text-blue-900'],
          ['Atrasadas', dashboardCounts.overdue, 'border-red-100 bg-red-50/60 text-red-700'],
          ['Próx. 3 dias', dashboardCounts.next3, 'border-orange-100 bg-orange-50/60 text-orange-700'],
          ['Sem data', dashboardCounts.noDate, 'border-slate-200 bg-slate-50 text-slate-600'],
        ].map(([label, value, className]) => (
          <div key={String(label)} className={`rounded-xl border p-4 ${className}`}>
            <span className="block text-[10px] font-black uppercase tracking-widest opacity-75">{label}</span>
            <strong className="mt-1 block text-2xl font-black font-mono">{value}</strong>
          </div>
        ))}
      </div>

      <div className="md:hidden flex flex-wrap items-center gap-2">
        {Object.entries(VIEW_LABELS).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id as CalendarView)}
            className={`rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-wide transition-all ${
              view === id
                ? 'border-[#002C5F] bg-[#002C5F] text-white'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <MobileFilterSheet title="Filtros de instalações" open={showMobileFilters} onClose={() => setShowMobileFilters(false)}>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cliente, veículo, item..."
              className="w-full rounded-xl border border-slate-200 py-3 pl-9 pr-3 text-sm font-semibold text-slate-700 focus:outline-none"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as InstallationStatus | 'Todos')} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700">
            <option value="Todos">Status instalação</option>
            {INSTALLATION_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as PaymentStatus | 'Todos')} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700">
            <option value="Todos">Status pagamento</option>
            {PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select value={responsibleFilter} onChange={(e) => setResponsibleFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700">
            <option value="Todos">Responsável</option>
            {responsibleOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-mono text-slate-700" />
          <div className="flex flex-wrap gap-2">
            {QUICK_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setQuickFilter(filter.id)}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase ${
                  quickFilter === filter.id ? 'border-[#002C5F] bg-[#002C5F] text-white' : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </MobileFilterSheet>

      <div className="hidden md:block rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cliente, veículo, item..."
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-xs font-semibold text-slate-700 focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InstallationStatus | 'Todos')}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="Todos">Status instalação</option>
            {INSTALLATION_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as PaymentStatus | 'Todos')}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="Todos">Status pagamento</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <select
            value={responsibleFilter}
            onChange={(e) => setResponsibleFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="Todos">Responsável</option>
            {responsibleOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-mono text-slate-700 focus:outline-none"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-[10px] font-black uppercase text-slate-400">
            <Filter className="h-3 w-3" />
            Radar
          </span>
          {QUICK_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setQuickFilter(filter.id)}
              className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase transition-all ${
                quickFilter === filter.id
                  ? 'border-[#002C5F] bg-[#002C5F] text-white'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-black uppercase tracking-wide text-slate-800">
            {view === 'day' ? formatDateBR(currentDate) : monthLabel(currentDate)}
          </div>
          <div className="text-[11px] font-semibold text-slate-500">
            {filteredEntries.length} instalação(ões) no filtro atual
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => changePeriod(-1)}
            className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-500 hover:bg-slate-100"
            title="Período anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentDate(today)}
            className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black uppercase text-[#002C5F] hover:bg-blue-100"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => changePeriod(1)}
            className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-500 hover:bg-slate-100"
            title="Próximo período"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {view === 'month' && (
        <div className="space-y-4">
          <div className="hidden md:grid grid-cols-7 gap-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
            {WEEK_DAYS.map((day) => <div key={day}>{day}</div>)}
          </div>
          <div className="hidden md:grid grid-cols-1 gap-3 md:grid-cols-7">
            {getMonthGrid(currentDate).map((day) => (
              <div key={day.date}>
                {renderDateColumn(day.date, false, !day.inCurrentMonth)}
              </div>
            ))}
          </div>
          <div className="md:hidden space-y-3">
            {filteredEntries.map((entry) => (
              <div key={entry.id}>
                <InstallationCard entry={entry} onSelectSale={onSelectSale} />
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'week' && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
          {weekDates.map((date) => (
            <div key={date} className="space-y-2">
              <div className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                {WEEK_DAYS[parseLocalDate(date).getDay()]}
              </div>
              {renderDateColumn(date, true)}
            </div>
          ))}
        </div>
      )}

      {view === 'day' && renderDateColumn(currentDate, true)}

      {view === 'list' && (
        <div className="space-y-3">
          {filteredEntries.map((entry) => (
            <div key={entry.id}>
              <InstallationCard entry={entry} onSelectSale={onSelectSale} />
            </div>
          ))}
        </div>
      )}

      {noDateEntries.length > 0 && view !== 'list' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700">
            <Clock className="h-4 w-4 text-slate-400" />
            Sem data definida
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {noDateEntries.map((entry) => (
              <div key={entry.id}>
                <InstallationCard entry={entry} onSelectSale={onSelectSale} />
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredEntries.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-400">
          Nenhuma instalação encontrada para os filtros atuais.
        </div>
      )}
    </div>
  );
}
