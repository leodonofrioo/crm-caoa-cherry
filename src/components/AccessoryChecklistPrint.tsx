import React, { useState } from 'react';
import { FileText, Printer, X } from 'lucide-react';
import { isVehicleCompatible } from '../data/accessories';
import { AccessoryCategory, Product, ProductVariation } from '../types';

export interface ChecklistVehicleSelection {
  model: string;
  version: string;
  year: string;
}

interface ChecklistRow {
  id: string;
  category: AccessoryCategory;
  name: string;
  price: number;
}

export interface ChecklistPage {
  key: string;
  model: string;
  version: string;
  year: string;
  rows: ChecklistRow[];
}

const normalizeChecklistText = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const getChecklistItemName = (product: Product, variation: ProductVariation) => {
  const productName = product.name.trim();
  const variationName = variation.name.trim();
  const productKey = normalizeChecklistText(productName);
  const variationKey = normalizeChecklistText(variationName);

  if (!variationName || variationName === 'Padrão') return productName;
  if (variationKey === productKey || productKey.includes(variationKey) || variationKey.includes(productKey)) {
    return variationName.length > productName.length ? variationName : productName;
  }
  return `${productName} - ${variationName}`;
};

export const buildAccessoryChecklistPages = (
  products: Product[],
  vehicles: ChecklistVehicleSelection[]
): ChecklistPage[] =>
  vehicles.map((vehicle) => {
    const rows = products
      .filter((product) => product.active)
      .flatMap((product) =>
        product.variations
          .filter((variation) =>
            variation.active && isVehicleCompatible(variation.compatibilities, vehicle.model, vehicle.version, vehicle.year)
          )
          .map((variation) => ({
            id: `${product.id}:${variation.id}`,
            category: product.category,
            name: getChecklistItemName(product, variation),
            price: variation.price,
          }))
      )
      .sort((a, b) => a.category.localeCompare(b.category, 'pt-BR') || a.name.localeCompare(b.name, 'pt-BR'));

    return {
      key: `${vehicle.model}:${vehicle.version}:${vehicle.year}`,
      model: vehicle.model,
      version: vehicle.version,
      year: vehicle.year,
      rows,
    };
  });

export default function AccessoryChecklistPrint({
  pages,
  dealerName,
  clientName,
  clientWhatsapp,
  onClose,
}: {
  pages: ChecklistPage[];
  dealerName: string;
  clientName?: string;
  clientWhatsapp?: string;
  onClose: () => void;
}) {
  const [showValues, setShowValues] = useState(true);
  const printedAt = new Date().toLocaleDateString('pt-BR');
  const firstPage = pages[0];
  const priceHeaderColSpan = showValues ? 5 : 4;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-0 md:p-4">
      <div className="checklist-preview-shell flex min-h-screen w-full flex-col bg-slate-100 md:min-h-0 md:max-w-5xl md:rounded-2xl md:border md:border-slate-200 md:shadow-xl">
        <div className="checklist-print-toolbar flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-5 w-5 shrink-0 text-[#002C5F]" />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black uppercase tracking-tight text-slate-800">
                Checklist A4 de acessórios
              </h3>
              <p className="truncate text-[11px] font-semibold text-slate-500">
                {firstPage ? `${firstPage.model} · ${firstPage.version} · ${firstPage.year}` : 'Nenhum veículo selecionado'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[11px] font-black uppercase tracking-wide text-slate-600">
              <input
                type="checkbox"
                checked={showValues}
                onChange={(event) => setShowValues(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#002C5F]"
              />
              Mostrar valores
            </label>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#002C5F] px-3 py-2 text-xs font-black uppercase tracking-wide text-white hover:bg-slate-800"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="checklist-preview-scroll flex-1 overflow-y-auto p-3 md:p-6">
          <div className="checklist-print-root mx-auto space-y-4">
            {pages.map((page, pageIndex) => {
              const categories = Array.from(new Set(page.rows.map((row) => row.category)));

              return (
                <section key={page.key} className="checklist-a4-page bg-white text-slate-950 shadow-sm">
                  <header className="checklist-page-header flex items-start justify-between gap-4 border-b-2 border-slate-950 pb-3">
                    <div>
                      <div className="text-[15px] font-black uppercase tracking-tight">{dealerName || 'CRM Thayná Reis'}</div>
                      <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        Checklist de venda offline
                      </div>
                    </div>
                    <div className="text-right text-[9px] font-bold uppercase leading-tight text-slate-600">
                      <div>Data: {printedAt}</div>
                      <div>Consultora: Thayná Reis</div>
                    </div>
                  </header>

                  <div className="mt-3 grid grid-cols-[1fr_1.2fr_70px] gap-2 border-b border-slate-300 pb-3 text-[10px]">
                    <div>
                      <div className="font-black uppercase text-slate-500">Modelo</div>
                      <div className="text-[17px] font-black uppercase tracking-tight text-[#002C5F]">{page.model}</div>
                    </div>
                    <div>
                      <div className="font-black uppercase text-slate-500">Versão</div>
                      <div className="font-bold leading-tight text-slate-900">{page.version}</div>
                    </div>
                    <div>
                      <div className="font-black uppercase text-slate-500">Ano</div>
                      <div className="text-[17px] font-black text-slate-900">{page.year}</div>
                    </div>
                  </div>

                  {pageIndex === 0 && (
                    <section className="checklist-sales-fields mt-3 grid grid-cols-2 gap-2 border border-slate-300 p-2 text-[9px]">
                      <div>
                        <div className="font-black uppercase text-slate-500">Cliente</div>
                        <div className="min-h-5 border-b border-slate-300 pt-1 font-bold text-slate-900">
                          {clientName || ''}
                        </div>
                      </div>
                      <div>
                        <div className="font-black uppercase text-slate-500">WhatsApp</div>
                        <div className="min-h-5 border-b border-slate-300 pt-1 font-bold text-slate-900">
                          {clientWhatsapp || ''}
                        </div>
                      </div>
                      <div>
                        <div className="font-black uppercase text-slate-500">Forma de pagamento</div>
                        <div className="min-h-5 border-b border-slate-300" />
                      </div>
                      <div>
                        <div className="font-black uppercase text-slate-500">Total negociado</div>
                        <div className="min-h-5 border-b border-slate-300" />
                      </div>
                      <div className="col-span-2">
                        <div className="font-black uppercase text-slate-500">Observações da venda</div>
                        <div className="mt-1 grid gap-1">
                          <span className="block h-4 border-b border-slate-300" />
                          <span className="block h-4 border-b border-slate-300" />
                        </div>
                      </div>
                    </section>
                  )}

                  <table className="mt-3 w-full border-collapse text-[9px] leading-tight">
                    <thead>
                      <tr className="border-y border-slate-950 bg-slate-100 text-left text-[8px] uppercase tracking-wide">
                        <th className="w-6 py-1.5 text-center font-black">Ok</th>
                        <th className="w-[92px] py-1.5 font-black">Categoria</th>
                        <th className="py-1.5 font-black">Acessório / variação</th>
                        {showValues && <th className="w-[74px] py-1.5 text-right font-black">Tabela</th>}
                        <th className={`${showValues ? 'w-[116px]' : 'w-[190px]'} py-1.5 text-center font-black`}>
                          Obs./negociação
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.length > 0 ? (
                        categories.map((category) => {
                          const rows = page.rows.filter((row) => row.category === category);

                          return (
                            <React.Fragment key={`${page.key}:${category}`}>
                              <tr>
                                <td colSpan={priceHeaderColSpan} className="bg-slate-900 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-white">
                                  {category}
                                </td>
                              </tr>
                              {rows.map((row) => (
                                <tr key={row.id} className="border-b border-slate-200">
                                  <td className="py-1 text-center">
                                    <span className="inline-block h-3.5 w-3.5 border border-slate-950 align-middle" />
                                  </td>
                                  <td className="py-1 pr-1 font-bold text-slate-600">{row.category}</td>
                                  <td className="py-1 pr-2 font-semibold text-slate-950">{row.name}</td>
                                  {showValues && (
                                    <td className="py-1 text-right font-mono font-bold text-slate-900">{formatCurrency(row.price)}</td>
                                  )}
                                  <td className="py-1 pl-2">
                                    <span className="block h-4 border-b border-slate-300" />
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={priceHeaderColSpan} className="py-8 text-center text-[10px] font-bold text-slate-500">
                            Nenhum acessório ativo compatível com este veículo.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  <footer className="checklist-page-footer mt-3 space-y-3 border-t border-slate-300 pt-2 text-[9px] font-bold text-slate-600">
                    <div className="flex items-center justify-between gap-2">
                      <span>Total de opções: {page.rows.length}</span>
                      <span>Data de aprovação: ____/____/______</span>
                    </div>
                    <div className="grid grid-cols-2 gap-8 pt-5 text-center text-[9px] uppercase tracking-wide text-slate-700">
                      <div>
                        <div className="border-t border-slate-500 pt-1">Assinatura do vendedor</div>
                      </div>
                      <div>
                        <div className="border-t border-slate-500 pt-1">Assinatura do cliente</div>
                      </div>
                    </div>
                  </footer>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
