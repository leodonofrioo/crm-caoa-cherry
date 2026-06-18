import React, { useState } from 'react';
import { Accessory, Sale, SaleItem, FilmGlassPosition } from '../types';
import { Printer, X, FileText, ImagePlus, Eye } from 'lucide-react';
import { getAccessoryAttributeBadges } from '../data/categoryConfig';
import FilmSimulatorModal from './FilmSimulatorModal';

interface ProposalPrintProps {
  sale: Sale;
  items: SaleItem[];
  accessories: Accessory[];
  onClose: () => void;
}

export default function ProposalPrint({ sale, items, accessories, onClose }: ProposalPrintProps) {
  const [simulatorConfig, setSimulatorConfig] = useState<{
    title: string;
    baseFilm?: Accessory;
    overlayFilm?: Accessory;
  } | null>(null);
  const handlePrint = () => {
    window.print();
  };

  const totalTimeMinutes = items.reduce((acc, item) => {
    const accessory = accessories.find((candidate) => candidate.id === item.accessoryId);
    return acc + (accessory?.timeEstimate || 30);
  }, 0);

  const formattedHours = Math.floor(totalTimeMinutes / 60);
  const formattedMinutes = totalTimeMinutes % 60;
  const filmAccessories = accessories.filter((accessory) => accessory.category === 'Película Solar' && accessory.active);
  const filmPositions: Array<{ key: FilmGlassPosition; label: string }> = [
    { key: 'windshield', label: 'Frente / Para-brisa' },
    { key: 'rearGlass', label: 'Atrás / Vidro traseiro' },
    { key: 'frontSide', label: 'Laterais dianteiras' },
    { key: 'rearSide', label: 'Laterais traseiras' },
    { key: 'sunroof', label: 'Teto solar' },
  ];
  const configuredFilmPositions = filmPositions.filter((position) => {
    const config = sale.filmConfiguration?.[position.key];
    return Boolean(config?.baseFilmId || config?.overlayFilmId);
  });

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-start sm:items-center justify-center p-3 sm:p-4 z-50 animate-fade-in no-print overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[calc(100vh-1.5rem)] sm:max-h-[90vh] overflow-hidden shadow-xl border border-slate-100 flex flex-col my-3 sm:my-0">
        {/* Modal Toolbar (no-print) */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 no-print hover:grayscale-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-900" />
            <h3 className="font-display font-bold text-slate-800">
              Visualização de Proposta Original Impressa
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={handlePrint}
              className="bg-blue-900 hover:bg-blue-950 font-bold text-white px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all"
            >
              <Printer className="w-4 h-4" /> Imprimir Proposta (PDF)
            </button>
            <button
              onClick={onClose}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-2 rounded-lg"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Paper Core Container */}
        <div className="flex-1 overflow-y-auto p-8 relative bg-white md:p-12" id="printable-sheet">
          {/* Print Letter Head */}
          <div className="flex items-start justify-between border-b-2 border-blue-900 pb-6 mb-8">
            <div className="space-y-1.5">
              <img
                src="/brands/caoa-chery-logo.png"
                alt="CAOA CHERY"
                className="h-14 w-40 object-contain object-left"
              />
              <div className="text-slate-500 text-xs font-semibold uppercase tracking-wide">
                Concessionária Autorizada • Acessórios Genuínos
              </div>
              <div className="text-[11px] text-slate-400">
                Avenida Santos Dumont, São Paulo SP
              </div>
            </div>

            <div className="text-right space-y-1 text-xs">
              <div className="font-bold text-slate-800 text-sm">PROPOSTA DE ACESSÓRIOS</div>
              <div className="text-slate-400 font-mono">ID: {sale.id}</div>
              <div className="text-slate-500">
                Data: {new Date(sale.createdAt).toLocaleDateString('pt-BR')}
              </div>
              <div className="text-slate-500 font-medium">Consultora: Thayná Reis</div>
            </div>
          </div>

          {/* Client & Car info section */}
          <div className="grid grid-cols-2 gap-8 mb-8 text-xs bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            <div className="space-y-1.5">
              <span className="font-bold text-[10px] text-slate-400 uppercase tracking-widest block mb-1">
                Dados do Cliente
              </span>
              <div className="text-slate-800 font-bold text-sm">{sale.clientName}</div>
              <div className="text-slate-600">WhatsApp/Telefone: {sale.clientPhone}</div>
              <div className="text-slate-600">Vendedor do carro: {sale.carSalespersonName || 'Não informado'}</div>
              <div className="text-slate-600">Prazo de Entrega: {sale.installationDate ? new Date(sale.installationDate).toLocaleDateString('pt-BR') : 'A combinar'}</div>
            </div>

            <div className="space-y-1.5">
              <span className="font-bold text-[10px] text-slate-400 uppercase tracking-widest block mb-1">
                Veículo CAOA Chery Escolhido
              </span>
              <div className="text-blue-900 font-bold text-sm">
                CAOA CHERY {sale.carModel?.toUpperCase()}
              </div>
              <div className="text-slate-700">Versão: {sale.carVersion}</div>
              <div className="text-slate-600">Ano Modelo: {sale.carYear}</div>
            </div>
          </div>

          {/* Itemized accessories list table */}
          <div className="space-y-4 mb-8">
            <h4 className="text-xs font-bold text-slate-450 uppercase tracking-widest">
              Itens do Orçamento
            </h4>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold text-[10px]">
                  <th className="py-2.5">Acessório</th>
                  <th className="py-2.5">Categoria</th>
                  <th className="py-2.5 text-right">Preço de Tabela</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {items.length > 0 ? (
                  items.map((it, idx) => {
                    const accessory = accessories.find((candidate) => candidate.id === it.accessoryId);
                    const badges = accessory ? getAccessoryAttributeBadges(accessory) : [];

                    return (
                    <tr key={it.id || idx}>
                      <td className="py-3">
                        <div className="flex items-start gap-3">
                          <div className="h-12 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                            {accessory?.imageUrl ? (
                              <img src={accessory.imageUrl} alt={it.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-slate-300">
                                <ImagePlus className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{it.name}</div>
                            {badges.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {badges.map((badge) => (
                                  <span key={badge} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                                    {badge}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-slate-500">{accessory?.category || 'Acessório Genuíno'}</td>
                      <td className="py-3 text-right font-mono font-medium text-slate-800">
                        {it.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-slate-400">
                      Nenhum acessório selecionado para esta proposta.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {configuredFilmPositions.length > 0 && (
            <div className="space-y-3 mb-8 no-print">
              <h4 className="text-xs font-bold text-slate-450 uppercase tracking-widest">
                Configuração dos Vidros
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {configuredFilmPositions.map((position) => {
                  const config = sale.filmConfiguration?.[position.key];
                  const baseFilm = accessories.find((accessory) => accessory.id === config?.baseFilmId);
                  const overlayFilm = accessories.find((accessory) => accessory.id === config?.overlayFilmId);

                  return (
                    <div key={position.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-800">{position.label}</div>
                          <div className="mt-1 text-[10px] text-slate-500 font-semibold">
                            Principal: {baseFilm?.name || 'Sem película'}
                          </div>
                          {overlayFilm && (
                            <div className="text-[10px] text-slate-500 font-semibold">
                              Composição: {overlayFilm.name}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSimulatorConfig({
                            title: `Visualização do Insulfilm · ${position.label}`,
                            baseFilm: baseFilm || overlayFilm,
                            overlayFilm: baseFilm ? overlayFilm : undefined,
                          })}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#002C5F] hover:bg-blue-100"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Visualizar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Total calculations */}
          <div className="border-t border-slate-200 pt-5 flex justify-end">
            <div className="w-72 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal dos Peças:</span>
                <span className="font-mono">{sale.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-red-650">
                  <span>Desconto Concedido:</span>
                  <span className="font-mono">- {sale.discount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-800 font-bold border-t border-slate-150 pt-2 text-sm justify-between">
                <span className="text-blue-900 uppercase">Total Final Proposto:</span>
                <span className="font-mono text-blue-900">
                  {sale.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              {formattedHours > 0 || formattedMinutes > 0 ? (
                <div className="text-[10px] text-slate-400 text-right pt-1">
                  Tempo estimado de montagem: {formattedHours}h {formattedMinutes}m
                </div>
              ) : null}
            </div>
          </div>

          {/* Guidelines notes */}
          <div className="border-t border-slate-100 pt-8 mt-12 space-y-3.5 text-[10px] text-slate-400 leading-relaxed">
            <h5 className="font-bold text-slate-600 uppercase tracking-wide">Observações Importantes:</h5>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Validade da proposta: 5 dias a partir da data de emissão.</li>
              <li>Acessórios genuínos preservam o padrão de instalação da concessionária.</li>
              <li>Prazo de instalação agendado de acordo com a disponibilidade da oficina técnica e faturamento do carro.</li>
            </ol>
            <div className="pt-8 text-center text-slate-350 italic font-medium">
              Obrigado pela preferência! CAOA Chery.
            </div>
          </div>
        </div>
      </div>

      {simulatorConfig && (
        <FilmSimulatorModal
          films={filmAccessories}
          initialFilm={simulatorConfig.baseFilm}
          initialSecondFilm={simulatorConfig.overlayFilm}
          title={simulatorConfig.title}
          onClose={() => setSimulatorConfig(null)}
        />
      )}
    </div>
  );
}
