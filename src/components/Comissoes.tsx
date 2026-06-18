import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { Sale, CommissionStatus } from '../types';
import {
  DollarSign,
  CheckCircle,
  Clock,
  TrendingUp,
  Filter,
} from 'lucide-react';

export default function Comissoes() {
  const { sales, settings, markCommissionReceived, showConfirm } = useCRM();
  const [statusFilter, setStatusFilter] = useState<string>('Todos');

  // Calculates metrics
  const totalVolume = sales
    .filter((s) => s.status !== 'Perdido')
    .reduce((acc, s) => acc + s.total, 0);

  const totalCommissions = sales
    .filter((s) => s.status !== 'Perdido')
    .reduce((acc, s) => acc + s.commissionAmount, 0);
  const productBonuses = sales
    .filter((s) => s.status !== 'Perdido')
    .reduce((acc, s) => acc + (s.productBonusAmount ?? 0), 0);
  const goalBonuses = sales
    .filter((s) => s.status !== 'Perdido')
    .reduce((acc, s) => acc + (s.goalBonusAmount ?? 0) + (s.goalExtraAmount ?? 0), 0);

  const pending = sales
    .filter((s) => s.commissionStatus === 'A receber')
    .reduce((acc, s) => acc + s.commissionAmount, 0);

  const received = sales
    .filter((s) => s.commissionStatus === 'Recebido')
    .reduce((acc, s) => acc + s.commissionAmount, 0);

  // Filters commissions list
  const filteredSales = sales.filter((sale) => {
    // commission only exists if there is accessory total, but wait we show everything with commission amount > 0
    if (statusFilter === 'Todos') return sale.commissionAmount >= 0;
    return sale.commissionStatus === statusFilter;
  });

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div>
        <h1 className="text-3xl font-display font-medium tracking-tight text-slate-800">
          Minhas Comissões
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Acompanhe seu desempenho de vendas de acessórios do mês e gerencie comissões a receber.
        </p>
      </div>

      {/* Commissions stats summary boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {/* Total volume */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-slate-500 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Faturamento Bruto</span>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl font-display font-bold text-[#002C5F]">
            {totalVolume.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <span className="text-[10px] text-slate-400 block font-medium">Total de acessórios aprovado/em andamento</span>
        </div>

        {/* Total commissions */}
        <div className="bg-blue-50/40 p-5 rounded-xl border border-blue-200 shadow-sm space-y-1">
          <div className="text-blue-900 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Comissão Prevista</span>
            <DollarSign className="w-4 h-4 text-blue-700" />
          </div>
          <p className="text-xl font-display font-bold text-blue-950">
            {totalCommissions.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <span className="text-[10px] text-blue-700 block font-medium">
            Fixa {settings.commissionPercent}% + bônus + meta
          </span>
        </div>

        {/* Pending commissions */}
        <div className="bg-amber-50/40 p-5 rounded-xl border border-amber-200 shadow-sm space-y-1">
          <div className="text-amber-800 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
            <span>A Receber</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-display font-bold text-amber-800">
            {pending.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <span className="text-[10px] text-amber-600 block font-medium">Aguardando folha de pagamento</span>
        </div>

        {/* Received commissions */}
        <div className="bg-green-50/40 p-5 rounded-xl border border-green-200 shadow-sm space-y-1">
          <div className="text-green-800 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Recebido</span>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-xl font-display font-bold text-green-800">
            {received.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <span className="text-[10px] text-green-600 block font-medium">Já creditado em conta</span>
        </div>

        {/* Bonus commissions */}
        <div className="bg-emerald-50/40 p-5 rounded-xl border border-emerald-200 shadow-sm space-y-1">
          <div className="text-emerald-800 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Bônus Produto/Meta</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-display font-bold text-emerald-800">
            {(productBonuses + goalBonuses).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <span className="text-[10px] text-emerald-600 block font-medium">
            Produtos: {productBonuses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · Meta: {goalBonuses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>
      </div>

      {/* Filter and commissions list layout */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-slate-800">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            Vendas e Comissionamento correspondente
          </h3>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-semibold shrink-0">Filtrar Situação:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs p-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none text-slate-700 font-medium"
            >
              <option value="Todos">Todos Comissionamentos</option>
              <option value="A receber">A Receber</option>
              <option value="Recebido">Recebidos</option>
              <option value="Cancelado">Cancelados</option>
            </select>
          </div>
        </div>

        {filteredSales.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-100">
                  <th className="p-4">Cliente / Carro</th>
                  <th className="p-4">Data proposta</th>
                  <th className="p-4">Status Venda</th>
                  <th className="p-4">Valor Total</th>
                  <th className="p-4">Fixa</th>
                  <th className="p-4">Bônus</th>
                  <th className="p-4">Comissão Total</th>
                  <th className="p-4 text-center">Status Pagamento</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSales.map((sale) => {
                  let statusColor = '';
                  if (sale.commissionStatus === 'Recebido') statusColor = 'bg-green-100 text-green-800';
                  else if (sale.commissionStatus === 'A receber') statusColor = 'bg-amber-100 text-amber-800 animate-pulse-slow';
                  else statusColor = 'bg-slate-100 text-slate-400';

                  return (
                    <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Client + Car info */}
                      <td className="p-4">
                        <div className="font-semibold text-slate-800">{sale.clientName}</div>
                        <div className="text-xs text-slate-400 mt-0.5 font-sans">
                          {sale.carModel} • {sale.carVersion}
                        </div>
                      </td>
                      {/* Created date */}
                      <td className="p-4 font-mono font-medium text-slate-500">
                        {new Date(sale.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      {/* Sales process status */}
                      <td className="p-4">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]">
                          {sale.status}
                        </span>
                      </td>
                      {/* Total accessories value */}
                      <td className="p-4 font-mono font-medium text-slate-800">
                        {sale.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      {/* Comission rate */}
                      <td className="p-4 font-mono font-semibold text-slate-500">
                        {sale.commissionPercent}%
                      </td>
                      <td className="p-4 font-mono font-semibold text-emerald-700">
                        {((sale.productBonusAmount ?? 0) + (sale.goalBonusAmount ?? 0) + (sale.goalExtraAmount ?? 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      {/* Comission amount */}
                      <td className="p-4 font-mono font-bold text-slate-800">
                        {sale.commissionAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      {/* Commission payment status */}
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full font-mono text-[9px] font-bold uppercase inline-block ${statusColor}`}>
                          {sale.commissionStatus}
                        </span>
                        {sale.commissionPaidAt && (
                          <span className="text-[10px] text-slate-400 block mt-1">
                            {new Date(sale.commissionPaidAt).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </td>
                      {/* Ações button */}
                      <td className="p-4 text-center">
                        {sale.commissionStatus === 'A receber' ? (
                          <button
                            onClick={() => {
                              showConfirm(
                                'Baixar Comissão',
                                `Thayná, confirma que recebeu a comissão de R$ ${sale.commissionAmount.toFixed(2)} referente à venda do cliente ${sale.clientName}?`,
                                () => {
                                  markCommissionReceived(sale.id);
                                }
                              );
                            }}
                            className="bg-emerald-600 font-semibold hover:bg-emerald-700 text-white leading-none px-3 py-1.5 rounded text-[10px] shadow-sm"
                          >
                            Baixar Pagamento
                          </button>
                        ) : sale.commissionStatus === 'Recebido' ? (
                          <span className="text-slate-400 text-xs">-</span>
                        ) : (
                          <div className="text-[10px] text-red-600 font-semibold">Cancelada</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400">
            Nenhuma comissão correspondente ao filtro encontrado.
          </div>
        )}
      </div>
    </div>
  );
}
