import React, { useState } from 'react';
import { useCRM, getSimulatedToday } from '../context/CRMContext';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  AlertCircle,
  Copy,
  Check,
  Phone,
  MessageSquare,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { Followup, Sale } from '../types';
import { getMonthlyOpportunityCount, getMonthlyTargetAmount, getSaleMonthKey } from '../utils/commissions';
import { buildInstallationEntries, diffDays } from '../utils/installationSchedule';

interface DashboardProps {
  onNavigateToTab: (tab: string) => void;
  onSelectSale: (saleId: string) => void;
}

export default function Dashboard({ onNavigateToTab, onSelectSale }: DashboardProps) {
  const {
    sales,
    saleItems,
    followups,
    events,
    settings,
    updateFollowupStatus,
    remarcalFollowup,
    markCommissionReceived,
    showConfirm,
  } = useCRM();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [newDateValue, setNewDateValue] = useState<string>(getSimulatedToday());
  const [rescheduleNote, setRescheduleNote] = useState<string>('');

  const [followupAction, setFollowupAction] = useState<{
    id: string;
    type: 'Feito' | 'Sem resposta';
    clientName: string;
    carModel: string;
  } | null>(null);
  const [followupNote, setFollowupNote] = useState<string>('');

  // 1. Calculations
  const todayStr = getSimulatedToday();
  const installationEntries = buildInstallationEntries(sales, saleItems, todayStr);
  const installationRadarCounts = {
    today: installationEntries.filter((entry) => entry.sale.installationDate === todayStr).length,
    overdue: installationEntries.filter((entry) => entry.effectiveStatus === 'Atrasada').length,
    next3: installationEntries.filter((entry) => {
      const distance = entry.sale.installationDate ? diffDays(todayStr, entry.sale.installationDate) : null;
      return distance !== null && distance >= 0 && distance <= 3;
    }).length,
    paidWaiting: installationEntries.filter((entry) =>
      entry.sale.paymentStatus === 'Paga' &&
      entry.effectiveStatus !== 'Instalada' &&
      entry.effectiveStatus !== 'Cancelada'
    ).length,
    unpaidSoon: installationEntries.filter((entry) => {
      const distance = entry.sale.installationDate ? diffDays(todayStr, entry.sale.installationDate) : null;
      return entry.sale.paymentStatus !== 'Paga' &&
        distance !== null &&
        distance >= 0 &&
        distance <= 3 &&
        entry.effectiveStatus !== 'Instalada' &&
        entry.effectiveStatus !== 'Cancelada';
    }).length,
  };

  const totalSalesCount = sales.length;
  const approvedSales = sales.filter((s) => s.status !== 'Perdido' && s.status !== 'Novo cliente');
  const totalApprovedValue = approvedSales.reduce((acc, s) => acc + s.total, 0);
  const currentMonthKey = getSaleMonthKey(new Date().toISOString());
  const monthlyOpportunityCount = getMonthlyOpportunityCount(sales, currentMonthKey);
  const monthlyTargetAmount = getMonthlyTargetAmount(settings, monthlyOpportunityCount);
  const monthlyGoalPercent = monthlyTargetAmount > 0 ? (totalApprovedValue / monthlyTargetAmount) * 100 : 0;
  const goalRemaining = Math.max(0, monthlyTargetAmount - totalApprovedValue);
  const goalReached = monthlyTargetAmount > 0 && totalApprovedValue >= monthlyTargetAmount;
  const productBonusTotal = approvedSales.reduce((acc, sale) => acc + (sale.productBonusAmount ?? 0), 0);
  const goalBonusTotal = approvedSales.reduce(
    (acc, sale) => acc + (sale.goalBonusAmount ?? 0) + (sale.goalExtraAmount ?? 0),
    0
  );

  const metaTargetValue = settings.targetPerClient ?? 2000;
  const averageTicket = sales.length > 0 ? totalApprovedValue / sales.length : 0;

  // 2. Identify Priority Tasks
  // - Atrasados: Pending and due < today
  const overdueFollowups = followups.filter(
    (f) => f.status === 'Pendente' && f.dueDate < todayStr
  );

  // - Hoje: Pending and due === today
  const todayFollowups = followups.filter(
    (f) => f.status === 'Pendente' && f.dueDate === todayStr
  );

  // - Sem resposta: Followups marked 'Sem resposta' requiring attention
  const noResponseFollowups = followups.filter((f) => f.status === 'Sem resposta');

  // - Carros prontos para avisar retirada (sales with status 'Pronto para entrega')
  // We can treat this as a virtual category if no current followup is already generated
  const readyForDeliverySales = sales.filter((s) => s.status === 'Pronto para entrega');

  // - Comissões para receber (A receber and sale is Deliverered or Ready)
  const listCommissionsToReceive = sales.filter(
    (s) => s.commissionStatus === 'A receber' && (s.status === 'Entregue' || s.status === 'Pronto para entrega')
  );

  // Copy WhatsApp message with appropriate template
  const handleCopyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const getWhatsAppTemplate = (type: string, clientName: string, carModel: string): string => {
    const firstName = clientName.split(' ')[0];
    switch (type) {
      case 'WhatsApp':
      case 'Budget':
        return `Oi, ${firstName}, tudo bem? Passando para saber se conseguiu olhar o orçamento dos acessórios do seu ${carModel}. Se quiser, te ajudo a ajustar os itens para ficar melhor para você.`;
      case 'Pronto':
        return `Oi, ${firstName}, tudo bem? Os acessórios do seu ${carModel} já estão prontos. Pode combinar a retirada com a equipe do pós-venda.`;
      case 'Pós-venda':
        return `Oi, ${firstName}, tudo bem? Passando só para saber se ficou tudo certo com os acessórios instalados no seu ${carModel}. Espero que tenha adorado!`;
      default:
        return `Oi, ${firstName}, tudo bem? Sou a Thayná da CAOA Chery. Gostaria de conversar sobre as opções de acessórios personalizados para o seu novo ${carModel}.`;
    }
  };

  const handleReschedule = (id: string) => {
    if (!newDateValue) return;
    remarcalFollowup(id, newDateValue, rescheduleNote.trim() || undefined);
    setRescheduleId(null);
    setRescheduleNote('');
  };

  const handleConfirmFollowupAction = () => {
    if (!followupAction) return;
    updateFollowupStatus(followupAction.id, followupAction.type, followupNote.trim() || undefined);
    setFollowupAction(null);
    setFollowupNote('');
  };

  return (
    <div className="space-y-8 animate-fade-in" id="dashboard-tab">
      {/* Upper header action bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-3xl font-display font-medium tracking-tight text-slate-800">
            Painel Geral
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Seja bem-vinda de volta, <span className="font-semibold text-slate-700">Thayná Reis</span> ! Monitore propostas e follow-ups.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 text-blue-800 text-xs font-mono px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Hoje: 17 de Junho, 2026
          </div>
        </div>
      </div>

      {/* Target Sales Progress Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <span className="text-[10px] bg-[#002C5F]/10 text-[#002C5F] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Meta: {(settings.targetPerClient ?? 2000).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por oportunidade do mês
            </span>
            <span className="text-base font-bold text-slate-800 mt-1 uppercase tracking-tight block">
              Acompanhamento de Premiação e Comissão
            </span>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-[10px] text-slate-400 font-bold block">
              {goalReached ? '+0,5% liberado pela meta' : 'Falta para bater meta'}
            </span>
            <span className="text-base font-extrabold text-slate-700 font-mono">
              {goalReached
                ? `${(settings.goalExtraCommissionPercent ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
                : goalRemaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          {/* Progress Bar Column */}
          <div className="md:col-span-3 space-y-2">
            <div className="flex justify-between text-xs font-bold text-slate-700">
              <span className="text-blue-900">Alcançado: {totalApprovedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              <span className="text-slate-500 font-mono">{monthlyGoalPercent.toFixed(1)}%</span>
            </div>
            {/* Progress line */}
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
              <div
                className="bg-[#002C5F] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, monthlyGoalPercent)}%` }}
              />
            </div>
          </div>

          {/* Average Ticket Column */}
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center space-y-0.5">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Ticket Médio Realizado</span>
            <div className={`text-base font-mono font-black ${averageTicket >= metaTargetValue ? 'text-green-600' : 'text-amber-600'}`}>
              {averageTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-tight">
              {averageTicket >= metaTargetValue ? '🎉 Acima da Meta' : '⚠️ Abaixo da Meta'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-4 text-xs">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-400">Comissão fixa</span>
            <strong className="font-mono text-slate-800">{settings.commissionPercent}%</strong>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-400">Oportunidades</span>
            <strong className="font-mono text-slate-800">{monthlyOpportunityCount}</strong>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
            <span className="block text-[9px] font-bold uppercase tracking-widest text-emerald-700">Bônus produtos</span>
            <strong className="font-mono text-emerald-800">
              {productBonusTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </strong>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
            <span className="block text-[9px] font-bold uppercase tracking-widest text-blue-800">Extra por meta</span>
            <strong className="font-mono text-blue-900">
              {goalBonusTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </strong>
          </div>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* KPI 1 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1 block">Acessórios Vendidos</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[#002C5F] font-display">{totalSalesCount}</span>
              <span className="text-xs text-slate-400 font-medium">negócios</span>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mt-2">CAOA Chery · Catálogo Russi</span>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1 block">Volume de Negócios</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-800 font-display">
                {totalApprovedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 font-medium block mt-2">Total aprovado/em andamento</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-[#002C5F]">
              Radar de Instalações
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Agenda derivada das propostas; pagamento só sinaliza atenção.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToTab('installations')}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black uppercase text-[#002C5F] hover:bg-blue-100"
          >
            Abrir calendário
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            ['Hoje', installationRadarCounts.today, 'border-blue-100 bg-blue-50/60 text-blue-900'],
            ['Atrasadas', installationRadarCounts.overdue, 'border-red-100 bg-red-50/70 text-red-700'],
            ['Próx. 3 dias', installationRadarCounts.next3, 'border-orange-100 bg-orange-50/70 text-orange-700'],
            ['Pagas aguardando', installationRadarCounts.paidWaiting, 'border-emerald-100 bg-emerald-50/70 text-emerald-700'],
            ['Não pagas próximas', installationRadarCounts.unpaidSoon, 'border-rose-100 bg-rose-50/70 text-rose-700'],
          ].map(([label, value, className]) => (
            <button
              key={String(label)}
              type="button"
              onClick={() => onNavigateToTab('installations')}
              className={`rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${className}`}
            >
              <span className="block text-[9px] font-black uppercase tracking-widest opacity-75">{label}</span>
              <strong className="mt-1 block font-mono text-xl font-black">{value}</strong>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Priorities + Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Priority tasks section "O que fazer hoje" */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-medium text-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
              O que fazer hoje
            </h2>
            <span className="text-xs bg-slate-100 px-2.5 py-1 rounded text-slate-500 font-mono">
              Foco imediato
            </span>
          </div>

          <div className="space-y-4">
            {/* 1. Overdue/Atrasados Section */}
            {overdueFollowups.length > 0 && (
              <div className="bg-red-50/50 rounded-xl p-4 border border-red-100">
                <div className="flex items-center gap-2 text-red-800 font-semibold mb-3 text-sm">
                  <AlertCircle className="w-4.5 h-4.5" />
                  Contatos Atrasados ({overdueFollowups.length})
                </div>
                <div className="space-y-3">
                  {overdueFollowups.map((f) => (
                    <FollowupCard
                      key={f.id}
                      followup={f}
                      badgeType="alert"
                      onCopy={() => handleCopyMessage(getWhatsAppTemplate(f.type, f.clientName, f.carModel), f.id)}
                      onDone={() => {
                        setFollowupNote('');
                        setFollowupAction({ id: f.id, type: 'Feito', clientName: f.clientName, carModel: f.carModel });
                      }}
                      onNoResponse={() => {
                        setFollowupNote('');
                        setFollowupAction({ id: f.id, type: 'Sem resposta', clientName: f.clientName, carModel: f.carModel });
                      }}
                      copied={copiedId === f.id}
                      isRescheduling={rescheduleId === f.id}
                      onStartReschedule={() => {
                        setRescheduleId(f.id);
                        setNewDateValue(f.dueDate);
                        setRescheduleNote('');
                      }}
                      onCancelReschedule={() => setRescheduleId(null)}
                      onConfirmReschedule={() => handleReschedule(f.id)}
                      newDateValue={newDateValue}
                      setNewDateValue={setNewDateValue}
                      rescheduleNote={rescheduleNote}
                      setRescheduleNote={setRescheduleNote}
                      onViewSale={() => onSelectSale(f.saleId)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 2. Today Section */}
            {todayFollowups.length > 0 ? (
              <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-slate-750 font-semibold text-sm mb-1 pb-2 border-b border-slate-50">
                  <span className="flex items-center gap-1.5 text-blue-800">
                    <Calendar className="w-4 h-4" />
                    Agendados para Hoje ({todayFollowups.length})
                  </span>
                </div>
                <div className="space-y-3">
                  {todayFollowups.map((f) => (
                    <FollowupCard
                      key={f.id}
                      followup={f}
                      badgeType="today"
                      onCopy={() => handleCopyMessage(getWhatsAppTemplate(f.type, f.clientName, f.carModel), f.id)}
                      onDone={() => {
                        setFollowupNote('');
                        setFollowupAction({ id: f.id, type: 'Feito', clientName: f.clientName, carModel: f.carModel });
                      }}
                      onNoResponse={() => {
                        setFollowupNote('');
                        setFollowupAction({ id: f.id, type: 'Sem resposta', clientName: f.clientName, carModel: f.carModel });
                      }}
                      copied={copiedId === f.id}
                      isRescheduling={rescheduleId === f.id}
                      onStartReschedule={() => {
                        setRescheduleId(f.id);
                        setNewDateValue(f.dueDate);
                        setRescheduleNote('');
                      }}
                      onCancelReschedule={() => setRescheduleId(null)}
                      onConfirmReschedule={() => handleReschedule(f.id)}
                      newDateValue={newDateValue}
                      setNewDateValue={setNewDateValue}
                      rescheduleNote={rescheduleNote}
                      setRescheduleNote={setRescheduleNote}
                      onViewSale={() => onSelectSale(f.saleId)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              overdueFollowups.length === 0 && (
                <div className="p-8 text-center bg-white border border-dashed border-slate-200 rounded-2xl text-slate-400">
                  <Check className="w-10 h-10 mx-auto text-green-500 mb-2" />
                  Nenhum contato pendente para hoje! Tudo limpo.
                </div>
              )
            )}

            {/* 3. Clientes Sem Resposta */}
            {noResponseFollowups.length > 0 && (
              <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100 shadow-sm">
                <div className="flex items-center gap-2 text-amber-800 font-semibold mb-3 text-sm">
                  <ShieldAlert className="w-4.5 h-4.5" />
                  Clientes Ignorando/Sem Resposta ({noResponseFollowups.length})
                </div>
                <div className="space-y-3">
                  {noResponseFollowups.map((f) => (
                    <FollowupCard
                      key={f.id}
                      followup={f}
                      badgeType="warning"
                      onCopy={() => handleCopyMessage(getWhatsAppTemplate('WhatsApp', f.clientName, f.carModel), f.id)}
                      onDone={() => {
                        setFollowupNote('');
                        setFollowupAction({ id: f.id, type: 'Feito', clientName: f.clientName, carModel: f.carModel });
                      }}
                      onNoResponse={() => {}} // already sem resposta
                      copied={copiedId === f.id}
                      isRescheduling={rescheduleId === f.id}
                      onStartReschedule={() => {
                        setRescheduleId(f.id);
                        setNewDateValue(f.dueDate);
                        setRescheduleNote('');
                      }}
                      onCancelReschedule={() => setRescheduleId(null)}
                      onConfirmReschedule={() => handleReschedule(f.id)}
                      newDateValue={newDateValue}
                      setNewDateValue={setNewDateValue}
                      rescheduleNote={rescheduleNote}
                      setRescheduleNote={setRescheduleNote}
                      onViewSale={() => onSelectSale(f.saleId)}
                      hideNoResponseButton
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 4. Carros Prontos - Avisar Retirada */}
            {readyForDeliverySales.length > 0 && (
              <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-800 font-semibold mb-3 text-sm">
                  <Check className="w-4.5 h-4.5 text-emerald-600" />
                  Instalação Concluída - Avisar Retirada ({readyForDeliverySales.length})
                </div>
                <div className="space-y-3">
                  {readyForDeliverySales.map((sale) => (
                    <div
                      key={sale.id}
                      className="bg-white p-3.5 rounded-lg border border-emerald-100 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          {sale.clientName}
                          <span className="text-[11px] bg-emerald-100 text-emerald-800 font-normal px-1.5 py-0.5 rounded">
                            {sale.carModel}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono flex items-center gap-1">
                          <span>Instalador: {sale.installerName || 'Não definido'}</span>
                          <span>•</span>
                          <span>Faturamento: {sale.carVersion}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5 md:self-center">
                        <button
                          onClick={() =>
                            handleCopyMessage(
                              getWhatsAppTemplate('Pronto', sale.clientName, sale.carModel),
                              sale.id + '_pronto'
                            )
                          }
                          className="flex items-center gap-1 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-2 rounded py-1"
                        >
                          {copiedId === sale.id + '_pronto' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-green-600" /> Copiado!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Copiar Aviso WhatsApp
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => onSelectSale(sale.id)}
                          className="text-xs bg-emerald-600 text-white hover:bg-emerald-700 px-2 py-1 rounded flex items-center gap-0.5"
                        >
                          Ver Venda <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Comissões a Receber de carros prontos/entregues */}
            {listCommissionsToReceive.length > 0 && (
              <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 shadow-sm">
                <div className="flex items-center gap-2 text-indigo-800 font-semibold mb-3 text-sm">
                  <DollarSign className="w-4.5 h-4.5" />
                  Comissões a Receber Disponíveis ({listCommissionsToReceive.length})
                </div>
                <div className="space-y-3">
                  {listCommissionsToReceive.map((sale) => (
                    <div
                      key={sale.id}
                      className="bg-white p-3.5 rounded-lg border border-indigo-100 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">
                          {sale.clientName}{' '}
                          <span className="text-xs bg-indigo-100 text-indigo-800 px-1.5 rounded py-0.5 font-normal">
                            CRM: {sale.carModel}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Subtotal: R$ {sale.total.toFixed(2)} | Comissão ({sale.commissionPercent}%):{' '}
                          <span className="font-semibold text-emerald-700">
                            R$ {sale.commissionAmount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            showConfirm(
                              'Dar Baixa na Comissão',
                              `Thayná, confirma que recebeu a comissão de R$ ${sale.commissionAmount.toFixed(2)} referente à venda do cliente ${sale.clientName}?`,
                              () => {
                                markCommissionReceived(sale.id);
                              }
                            );
                          }}
                          className="text-xs bg-indigo-700 text-white hover:bg-indigo-800 px-2.5 py-1.5 rounded"
                        >
                          Marcar como Recebido
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Recent activities (timeline) + Shortcut helpers */}
        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-display font-medium text-slate-800">
              Atividades Recentes
            </h2>
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                {events.length > 0 ? (
                  events.slice(0, 8).map((evt) => (
                    <div key={evt.id} className="border-l-2 border-blue-100 pl-3 pb-1 space-y-0.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">{evt.type}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(evt.createdAt).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-slate-500 line-clamp-2">{evt.description}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-4">
                    Nenhum histórico operacional gravado ainda.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Followup Action Modal */}
      {followupAction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-start sm:items-center justify-center z-50 animate-fade-in p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[calc(100vh-1.5rem)] shadow-xl border border-slate-100 overflow-y-auto transform scale-100 transition-all my-3 sm:my-0">
            <div className={`p-5 text-white ${followupAction.type === 'Feito' ? 'bg-[#002C5F]' : 'bg-amber-600'}`}>
              <h3 className="text-lg font-display font-medium flex items-center gap-2">
                {followupAction.type === 'Feito' ? (
                  <>
                    <Check className="w-5 h-5 animate-pulse" />
                    Concluir Contato (Follow-up)
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-5 h-5 animate-pulse" />
                    Registrar Sem Resposta
                  </>
                )}
              </h3>
              <p className="text-white/85 text-xs mt-1">
                Cliente: <span className="font-semibold text-white">{followupAction.clientName}</span> ({followupAction.carModel})
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 block">
                  Adicione uma observação sobre esta interação:
                </label>
                <textarea
                  value={followupNote}
                  onChange={(e) => setFollowupNote(e.target.value)}
                  placeholder={
                    followupAction.type === 'Feito'
                      ? "Ex: Cliente demonstrou interesse, agendou instalação para semana que vem..."
                      : "Ex: Liguei duas vezes e não atendeu, enviei mensagem e não visualizou..."
                  }
                  rows={4}
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-slate-400 placeholder:text-slate-400 text-slate-800 resize-none font-sans"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setFollowupAction(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer transition-all border border-transparent hover:border-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmFollowupAction}
                  className={`px-5 py-2 text-xs font-semibold text-white rounded-xl cursor-pointer transition-all font-bold ${
                    followupAction.type === 'Feito' ? 'bg-[#002C5F] hover:bg-[#001D3F]' : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  Confirmar e Registrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponent: FollowupCard
interface FollowupCardProps {
  key?: React.Key;
  followup: Followup;
  badgeType: 'alert' | 'today' | 'warning';
  onCopy: () => void;
  onDone: () => void;
  onNoResponse: () => void;
  copied: boolean;
  isRescheduling: boolean;
  onStartReschedule: () => void;
  onCancelReschedule: () => void;
  onConfirmReschedule: () => void;
  newDateValue: string;
  setNewDateValue: (val: string) => void;
  rescheduleNote: string;
  setRescheduleNote: (val: string) => void;
  onViewSale: () => void;
  hideNoResponseButton?: boolean;
}

function FollowupCard({
  followup,
  badgeType,
  onCopy,
  onDone,
  onNoResponse,
  copied,
  isRescheduling,
  onStartReschedule,
  onCancelReschedule,
  onConfirmReschedule,
  newDateValue,
  setNewDateValue,
  rescheduleNote,
  setRescheduleNote,
  onViewSale,
  hideNoResponseButton = false,
}: FollowupCardProps) {
  const getBadgeClass = () => {
    switch (badgeType) {
      case 'alert':
        return 'bg-red-100 text-red-800';
      case 'warning':
        return 'bg-amber-100 text-amber-800';
      case 'today':
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="bg-white p-3.5 rounded-lg border border-slate-100 shadow-xs space-y-3 relative group">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-1.5">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-slate-800">{followup.clientName}</span>
            <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 rounded py-0.5">
              {followup.carModel}
            </span>
            <span className={`text-[10px] font-mono px-1.5 rounded py-0.5 uppercase ${getBadgeClass()}`}>
              {followup.type}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{followup.notes}</p>
        </div>
        <div className="text-[11px] font-mono font-medium text-slate-400 shrink-0 select-none">
          Prazo: {followup.dueDate}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between border-t border-slate-50 pt-2.5 gap-2">
        {/* Secondary buttons context */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onCopy}
            className="flex items-center gap-1 text-[11px] bg-slate-50 hover:bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200"
            title="Copiar mensagem personalizada para WhatsApp"
          >
            {copied ? (
              <>
                <Check className="w-3 text-green-500 h-3" /> Copiado!
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" /> WhatsApp Copiar
              </>
            )}
          </button>
          <button
            onClick={onViewSale}
            className="text-[11px] text-slate-500 hover:text-slate-800 px-2 py-1 rounded bg-slate-50 border border-slate-200"
          >
            Ver Proposta
          </button>
        </div>

        {/* Actions triggers */}
        <div className="flex items-center gap-1.5">
          {isRescheduling ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
              <input
                type="date"
                value={newDateValue}
                onChange={(e) => setNewDateValue(e.target.value)}
                className="text-xs border border-slate-200 bg-white rounded px-1.5 py-1 text-slate-700 font-mono focus:outline-none focus:border-slate-400"
              />
              <input
                type="text"
                value={rescheduleNote}
                onChange={(e) => setRescheduleNote(e.target.value)}
                placeholder="Observação (opcional)..."
                className="text-xs border border-slate-200 bg-white rounded px-2 py-1 text-slate-705 w-[160px] focus:outline-none focus:border-slate-400"
              />
              <div className="flex items-center gap-1">
                <button
                  onClick={onConfirmReschedule}
                  className="bg-[#002C5F] hover:bg-[#001D3F] text-white text-xs px-2 py-1 rounded font-bold cursor-pointer transition-colors"
                >
                  Salvar
                </button>
                <button
                  onClick={onCancelReschedule}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs px-2 py-1 rounded cursor-pointer transition-colors"
                  title="Cancelar Reagendamento"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              {!hideNoResponseButton && (
                <button
                  onClick={onNoResponse}
                  className="text-[11px] text-amber-700 hover:bg-amber-100 border border-transparent px-2 py-1 rounded"
                  title="Marca sem resposta e reagenda em 2 dias"
                >
                  Sem Resposta
                </button>
              )}
              <button
                onClick={onStartReschedule}
                className="text-[11px] text-slate-600 hover:bg-slate-100 px-2 py-1 rounded"
              >
                Remarcar
              </button>
              <button
                onClick={onDone}
                className="text-[11px] bg-emerald-600 text-white hover:bg-emerald-700 px-2.5 py-1 rounded flex items-center gap-0.5 font-medium"
              >
                <Check className="w-3 h-3" /> Feito
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
