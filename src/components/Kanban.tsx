import React, { useState } from 'react';
import { useCRM, getSimulatedToday } from '../context/CRMContext';
import { Sale, SalesStatus } from '../types';
import {
  formatDateBR,
  getEffectiveInstallationStatus,
  getInstallationRadar,
  getPaymentSignal,
} from '../utils/installationSchedule';
import { getPipelineAutomation } from '../utils/pipelineAutomation';
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  User,
  Activity,
  UserCheck,
  Package,
  Calendar,
  MessageSquare,
  DollarSign,
  Trash2,
} from 'lucide-react';

const STATUS_COLUMNS: { name: SalesStatus; borderHex: string; headerBg: string; stripeColor: string; title: string; textHex: string }[] = [
  { 
    name: 'Novo cliente', 
    borderHex: 'border-blue-150', 
    headerBg: 'bg-blue-50/50', 
    stripeColor: 'bg-blue-600', 
    title: 'Novo Cliente',
    textHex: 'text-blue-900',
  },
  { 
    name: 'Orçamento enviado', 
    borderHex: 'border-purple-150', 
    headerBg: 'bg-purple-50/40', 
    stripeColor: 'bg-purple-600', 
    title: 'Orçamento Enviado',
    textHex: 'text-purple-900',
  },
  { 
    name: 'Aprovado', 
    borderHex: 'border-emerald-150', 
    headerBg: 'bg-emerald-50/45', 
    stripeColor: 'bg-emerald-600', 
    title: 'Aprovado',
    textHex: 'text-emerald-900',
  },
  { 
    name: 'Aguardando instalação', 
    borderHex: 'border-amber-150', 
    headerBg: 'bg-amber-50/40', 
    stripeColor: 'bg-amber-600', 
    title: 'Aguardando Instalação',
    textHex: 'text-amber-900',
  },
  { 
    name: 'Pronto para entrega', 
    borderHex: 'border-[#002C5F]/20', 
    headerBg: 'bg-slate-50', 
    stripeColor: 'bg-[#002C5F]', 
    title: 'Pronto p/ Entrega',
    textHex: 'text-slate-800',
  },
  { 
    name: 'Entregue', 
    borderHex: 'border-slate-200', 
    headerBg: 'bg-slate-50', 
    stripeColor: 'bg-slate-600', 
    title: 'Entregue',
    textHex: 'text-slate-700',
  },
  { 
    name: 'Perdido', 
    borderHex: 'border-rose-150', 
    headerBg: 'bg-rose-50/40', 
    stripeColor: 'bg-rose-600', 
    title: 'Perdido',
    textHex: 'text-rose-900',
  },
];

interface KanbanProps {
  onSelectSale: (saleId: string) => void;
  onCreateSale: (status: SalesStatus) => void;
}

export default function Kanban({ onSelectSale, onCreateSale }: KanbanProps) {
  const { sales, saleItems, followups, updateSaleStatus, deleteSale, showConfirm, showAlert } = useCRM();
  const [draggedSaleId, setDraggedSaleId] = useState<string | null>(null);
  
  // Dialog state for "lostReason"
  const [showLostDialog, setShowLostDialog] = useState(false);
  const [lossTargetId, setLossTargetId] = useState<string | null>(null);
  const [lostReasonText, setLostReasonText] = useState('');

  const getAutomationForSale = (sale: Sale) => {
    const items = saleItems.filter((item) => item.saleId === sale.id);
    return getPipelineAutomation({
      itemCount: items.length,
      total: sale.total,
      paymentStatus: sale.paymentStatus || 'Não paga',
      installationStatus: sale.installationStatus || (sale.installationDate ? 'Agendada' : 'Sem data definida'),
      installationDate: sale.installationDate,
      currentStatus: sale.status,
    });
  };

  const pendingAutoMoveCount = sales.filter((sale) => {
    const automation = getAutomationForSale(sale);
    return !automation.locked && automation.status !== sale.status;
  }).length;

  // 1. Drag & Drop events
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedSaleId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStatus: SalesStatus) => {
    e.preventDefault();
    const id = draggedSaleId || e.dataTransfer.getData('text/plain');
    if (!id) return;

    if (targetStatus === 'Perdido') {
      setLossTargetId(id);
      setLostReasonText('');
      setShowLostDialog(true);
    } else {
      updateSaleStatus(id, targetStatus);
    }
    setDraggedSaleId(null);
  };

  // 2. Custom helper to shift columns (mobile friendly)
  const shiftStatus = (sale: Sale, forward: boolean) => {
    const currentIndex = STATUS_COLUMNS.findIndex((col) => col.name === sale.status);
    let nextIndex = currentIndex + (forward ? 1 : -1);
    
    if (nextIndex >= 0 && nextIndex < STATUS_COLUMNS.length) {
      const targetStatus = STATUS_COLUMNS[nextIndex].name;
      if (targetStatus === 'Perdido') {
        setLossTargetId(sale.id);
        setLostReasonText('');
        setShowLostDialog(true);
      } else {
        updateSaleStatus(sale.id, targetStatus);
      }
    }
  };

  const submitPerdidoReason = () => {
    if (!lossTargetId || !lostReasonText.trim()) {
      showAlert('Atenção', 'Por favor, indique um motivo descritivo da perda do cliente.');
      return;
    }
    updateSaleStatus(lossTargetId, 'Perdido', lostReasonText);
    setShowLostDialog(false);
    setLossTargetId(null);
    setLostReasonText('');
  };

  return (
    <div className="space-y-6 animate-fade-in relative font-sans text-slate-800">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight text-[#002C5F] uppercase">
          Funil de Vendas (Kanban)
        </h1>
        <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-slate-500 font-medium">
            Status move sozinho quando proposta ganha itens, pagamento, agenda ou instalação concluída.
          </p>
          <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-[#002C5F]">
            <Activity className="h-3.5 w-3.5" />
            {pendingAutoMoveCount > 0 ? `${pendingAutoMoveCount} card(s) fora da regra` : 'Kanban sincronizado'}
          </div>
        </div>
      </div>

      {/* Kanban columns grid */}
      <div className="flex gap-4 overflow-x-auto pb-6 select-none scrollbar-thin snap-x max-w-full">
        {STATUS_COLUMNS.map((col) => {
          const columnSales = sales
            .filter((s) => s.status === col.name)
            .sort((a, b) => {
              const aRadar = getInstallationRadar(a, getSimulatedToday());
              const bRadar = getInstallationRadar(b, getSimulatedToday());
              const aPayment = getPaymentSignal(a, aRadar, getSimulatedToday());
              const bPayment = getPaymentSignal(b, bRadar, getSimulatedToday());
              const score = (sale: Sale, critical: boolean, level: string) => {
                if (critical) return 0;
                if (level === 'red') return 1;
                if (level === 'orange') return 2;
                if (sale.installationDate) return 3;
                return 4;
              };
              const priorityDiff =
                score(a, aPayment.critical, aRadar.level) - score(b, bPayment.critical, bRadar.level);
              if (priorityDiff !== 0) return priorityDiff;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
          const columnTotalValue = columnSales.reduce((acc, sale) => acc + sale.total, 0);

          return (
            <div
              key={col.name}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.name)}
              className={`flex-none w-[290px] rounded-2xl border bg-slate-50/30 flex flex-col p-3 transition-colors snap-start ${col.borderHex}`}
            >
              {/* Column Header */}
              <div className={`flex items-center justify-between font-bold text-slate-800 text-xs py-2 px-3 rounded-xl shadow-xs border border-slate-100 ${col.headerBg} mb-3`}>
                <div className="flex items-center gap-1.5 truncate">
                  <span className={`w-2 h-2 rounded-full ${col.stripeColor} shrink-0`}></span>
                  <span className={`truncate font-extrabold uppercase tracking-wide text-[10px] ${col.textHex}`}>{col.title}</span>
                </div>
                <span className="bg-white/80 border border-slate-250 text-slate-700 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold">
                  {columnSales.length}
                </span>
              </div>
              
              {/* Column Total Value */}
              <div className="text-[10px] font-mono font-bold text-slate-500 mb-3 px-1 text-right flex items-center justify-end gap-1">
                <span className="text-[9px] uppercase font-bold text-slate-400">Total:</span>
                <span className="text-slate-700">
                  {columnTotalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>

              {/* Card List container */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[580px] min-h-[350px] transition-all pr-1">
                {columnSales.map((sale) => {
                  // Gather items for this sale
                  const items = saleItems.filter((it) => it.saleId === sale.id);
                  // Find any active pending followup
                  const pendingFollowup = followups.find(
                    (f) => f.saleId === sale.id && f.status === 'Pendente'
                  );
                  const radar = getInstallationRadar(sale, getSimulatedToday());
                  const effectiveInstallationStatus = getEffectiveInstallationStatus(sale, getSimulatedToday());
                  const paymentSignal = getPaymentSignal(sale, radar, getSimulatedToday());
                  const automation = getPipelineAutomation({
                    itemCount: items.length,
                    total: sale.total,
                    paymentStatus: sale.paymentStatus || 'Não paga',
                    installationStatus: sale.installationStatus || (sale.installationDate ? 'Agendada' : 'Sem data definida'),
                    installationDate: sale.installationDate,
                    currentStatus: sale.status,
                  });
                  const needsAutoMove = !automation.locked && automation.status !== sale.status;
                  const agendaHighlightClass =
                    radar.level === 'red' || paymentSignal.critical
                      ? 'border-red-200 bg-red-50/35'
                      : radar.level === 'orange'
                        ? 'border-orange-200 bg-orange-50/30'
                        : 'border-slate-200 bg-white';

                  return (
                    <div
                      key={sale.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, sale.id)}
                      className={`p-3.5 rounded-xl border hover:border-slate-400 cursor-grab active:cursor-grabbing hover:shadow-md transition-all space-y-3 relative group ${agendaHighlightClass}`}
                    >
                      {/* Badge / Car Info */}
                      <div className="flex justify-between items-start gap-1">
                        <span className="text-[9px] font-bold bg-[#002C5F]/10 text-[#002C5F] px-2 py-0.5 rounded-lg font-sans uppercase tracking-wide">
                          {sale.carModel}
                        </span>
                        
                        {/* Date indicator */}
                        <span className="text-[9px] font-mono font-bold text-slate-400">
                          {new Date(sale.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      {/* Client info */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-[#002C5F] transition-colors leading-tight">
                          {sale.clientName}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-bold truncate mt-0.5">
                          {sale.carVersion || 'Completo'} {sale.carYear ? `· ${sale.carYear}` : ''}
                        </p>
                      </div>

                      {/* Mini list of accessories - VITAL for quick readability */}
                      {items.length > 0 && (
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-150 space-y-1">
                          <span className="text-[9px] text-[#002C5F] font-bold uppercase tracking-wider block flex items-center gap-1">
                            <Package className="w-3 h-3 text-[#002C5F]" /> {items.length} {items.length === 1 ? 'Acessório' : 'Acessórios'}:
                          </span>
                          <div className="text-[10px] text-slate-600 line-clamp-2 leading-tight space-y-0.5">
                            {items.map((it) => (
                              <div key={it.id} className="truncate select-none font-medium flex items-center gap-1 text-slate-650">
                                <span className="w-1 h-1 rounded-full bg-slate-400 shrink-0"></span>
                                {it.name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Scheduled Next Contact Alert */}
                      {pendingFollowup && (
                        <div className="flex items-center gap-1.5 text-[9px] bg-amber-50 border border-amber-100 text-amber-800 font-bold p-1.5 rounded-lg">
                          <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="truncate">
                            Contato: <span className="underline">{pendingFollowup.dueDate}</span>
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-1.5">
                        <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[9px] font-black uppercase ${radar.badgeClass}`}>
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span className="truncate">{formatDateBR(sale.installationDate)} · {effectiveInstallationStatus}</span>
                        </div>
                        <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[9px] font-black uppercase ${paymentSignal.badgeClass}`}>
                          <DollarSign className="h-3 w-3 shrink-0" />
                          <span className="truncate">{paymentSignal.label}</span>
                        </div>
                      </div>

                      <div className={`rounded-lg border px-2 py-2 text-[9px] font-bold ${
                        needsAutoMove
                          ? 'border-blue-100 bg-blue-50 text-blue-900'
                          : 'border-slate-100 bg-slate-50 text-slate-500'
                      }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 uppercase tracking-wide">
                              <Activity className="h-3 w-3 shrink-0" />
                              <span className="truncate">Auto: {automation.status}</span>
                            </div>
                            <div className="mt-0.5 line-clamp-2 normal-case leading-snug">
                              {automation.trigger}
                            </div>
                          </div>
                          {needsAutoMove && (
                            <button
                              type="button"
                              onClick={() => updateSaleStatus(sale.id, automation.status)}
                              className="shrink-0 rounded-md bg-[#002C5F] px-2 py-1 text-[9px] font-black uppercase text-white hover:bg-blue-950"
                              title={`Mover para ${automation.status}`}
                            >
                              Mover
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Price & commission row */}
                      <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-100 font-mono">
                        <div className="flex flex-col">
                          <span className="text-[8px] uppercase tracking-wider font-bold text-slate-400">Proposta</span>
                          <span className="font-bold text-[#002C5F]">
                            {sale.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>

                        {/* Commissions */}
                        {sale.commissionAmount > 0 && sale.status !== 'Perdido' && (
                          <div className="text-right flex flex-col">
                            <span className="text-[8px] uppercase tracking-wider font-bold text-emerald-650">Comissão</span>
                            <span className="text-[10px] font-bold text-emerald-700">
                              R$ {sale.commissionAmount.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Loss annotation */}
                      {sale.status === 'Perdido' && sale.lostReason && (
                        <div className="bg-rose-50 border border-rose-100 text-rose-800 text-[10px] p-2.5 rounded-lg font-medium leading-relaxed mt-1">
                          <span className="font-bold text-[9px] block uppercase tracking-wider text-rose-700 mb-0.5">Motivo de perda:</span>
                          {sale.lostReason}
                        </div>
                      )}

                      {/* Interactive edge buttons for mobile/alternative shifting */}
                      <div className="flex items-center justify-between pt-2 border-t border-dashed border-slate-150">
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => shiftStatus(sale, false)}
                            className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer"
                            disabled={sale.status === 'Novo cliente'}
                            title="Mover para esquerda"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => shiftStatus(sale, true)}
                            className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer"
                            disabled={sale.status === 'Perdido'}
                            title="Mover para direita"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              showConfirm(
                                'Excluir Oportunidade',
                                `Deseja realmente apagar permanentemente a proposta de ${sale.clientName}? Esta ação é irreversível e removerá todos os históricos deste cliente.`,
                                () => deleteSale(sale.id)
                              );
                            }}
                            className="p-1 text-slate-400 hover:text-red-650 hover:bg-red-55 rounded-md transition-all cursor-pointer"
                            title="Excluir Oportunidade / Kanban"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onSelectSale(sale.id)}
                            className="text-[10px] font-bold text-[#002C5F] hover:bg-slate-100 px-2 py-1 rounded-lg transition-all cursor-pointer"
                          >
                            Ver Detalhes
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {columnSales.length === 0 && (
                  <button
                    type="button"
                    onClick={() => onCreateSale(col.name)}
                    className="flex min-h-[160px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/40 p-8 text-center text-slate-400 transition-all hover:border-[#002C5F]/40 hover:bg-blue-50/40 hover:text-[#002C5F] focus:outline-none focus:ring-2 focus:ring-[#002C5F]/30"
                    title={`Adicionar nova proposta em ${col.title}`}
                  >
                    <HelpCircle className="w-7 h-7 stroke-1 mb-1 text-slate-300" />
                    <span className="text-[10px] font-bold font-sans">Sem clientes nesta coluna</span>
                    <span className="mt-1 text-[9px] font-semibold uppercase tracking-wide">Clique para adicionar proposta</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lost Reason Dialog Modal */}
      {showLostDialog && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-start sm:items-center justify-center p-3 sm:p-4 z-50 animate-fade-in no-print bg-opacity-70 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-sm w-full max-h-[calc(100vh-1.5rem)] overflow-y-auto p-4 sm:p-6 shadow-xl border border-slate-200 space-y-4 my-3 sm:my-0">
            <div className="text-center space-y-2">
              <span className="p-3 bg-red-50 text-rose-600 rounded-xl inline-block border border-rose-150 shadow-xs">
                <AlertCircle className="w-6 h-6" />
              </span>
              <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight">
                Registrar Motivo de Perda
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Por favor, indique resumidamente por que esta proposta não foi fechada para nos ajudar a aprimorar o atendimento.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-750">Qual foi o empecilho?</label>
              <textarea
                value={lostReasonText}
                onChange={(e) => setLostReasonText(e.target.value)}
                placeholder="Exemplo: cliente achou os valores elevados / comprou na concorrência / etc."
                rows={3}
                className="w-full text-xs p-3 border border-slate-250 rounded-xl focus:outline-none focus:border-slate-400 font-sans font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setShowLostDialog(false);
                  setLossTargetId(null);
                }}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl font-bold cursor-pointer"
              >
                Voltar
              </button>
              <button
                onClick={submitPerdidoReason}
                className="text-xs bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold cursor-pointer"
              >
                Confirmar Perda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
