import React, { useRef, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { sanitizeSettings } from '../data/seeds';
import { CRMExportPayload, CRMExportSection, Product } from '../types';
import { getMonthlyOpportunityCount, getSaleMonthKey } from '../utils/commissions';
import {
  X,
  Plus,
  Trash2,
  TrendingUp,
  Sliders,
  Check,
  ChevronRight,
  Sparkles,
  Award,
  Download,
  FileJson,
  Upload,
  Pencil,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const normalizeText = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const getUniqueProductCategories = (...categoryLists: Array<Array<string | undefined>>) => {
  const categories = new Map<string, string>();
  categoryLists.flat().forEach((category) => {
    const trimmed = category?.trim();
    if (!trimmed) return;
    categories.set(normalizeText(trimmed), trimmed);
  });
  return Array.from(categories.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
};

const getProductCategoryCounts = (products: Product[]) =>
  products.reduce<Record<string, number>>((counts, product) => {
    const category = product.category?.trim();
    if (!category) return counts;
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {});

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    settings,
    updateSettings,
    carModels,
    saveCarModels,
    products,
    sales,
    saleItems,
    followups,
    events,
    exportCRMData,
    importCRMData,
    clearProducts,
    clearSalesData,
    resetDatabase,
    showAlert,
    showConfirm,
  } = useCRM();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const allExportSections: CRMExportSection[] = ['products', 'sales', 'followups', 'events', 'settings', 'vehicles'];

  // Local settings fields
  const [targetPerClient, setTargetPerClient] = useState<number>(settings.targetPerClient ?? 2000);
  const [commissionPercent, setCommissionPercent] = useState<number>(settings.commissionPercent);
  const [goalExtraCommissionPercent, setGoalExtraCommissionPercent] = useState<number>(
    settings.goalExtraCommissionPercent ?? 0.5
  );
  const [dealerName, setDealerName] = useState<string>(settings.dealerName);

  // Car models editing state
  const [selectedModelId, setSelectedModelId] = useState<string>(carModels[0]?.id || '');
  const [selectedVersionName, setSelectedVersionName] = useState<string>('');

  // Add inputs
  const [newModelName, setNewModelName] = useState('');
  const [newVersionName, setNewVersionName] = useState('');
  const [newYearName, setNewYearName] = useState('');
  const [editingModelId, setEditingModelId] = useState('');
  const [editingModelName, setEditingModelName] = useState('');
  const [editingVersionName, setEditingVersionName] = useState('');
  const [editingVersionValue, setEditingVersionValue] = useState('');
  const [editingYearName, setEditingYearName] = useState('');
  const [editingYearValue, setEditingYearValue] = useState('');
  const [newCarSalespersonName, setNewCarSalespersonName] = useState('');
  const [newInstallerName, setNewInstallerName] = useState('');
  const [newProductCategoryName, setNewProductCategoryName] = useState('');
  const [selectedExportSections, setSelectedExportSections] = useState<CRMExportSection[]>(allExportSections);
  const [selectedImportSections, setSelectedImportSections] = useState<CRMExportSection[]>(allExportSections);
  const [lastImportFileName, setLastImportFileName] = useState('');

  if (!isOpen) return null;

  // Active Model & Version references
  const currentModel = carModels.find((m) => m.id === selectedModelId);
  const currentVersion = currentModel?.versions.find((v) => v.name === selectedVersionName);
  const currentMonthKey = getSaleMonthKey(new Date().toISOString());
  const monthlyOpportunityCount = getMonthlyOpportunityCount(sales, currentMonthKey);
  const calculatedMonthlyTarget = monthlyOpportunityCount * targetPerClient;
  const productCategoryCounts = getProductCategoryCounts(products);
  const configuredProductCategories = settings.productCategories || [];
  const visibleProductCategories = getUniqueProductCategories(configuredProductCategories, Object.keys(productCategoryCounts));
  const exportOptions: Array<{ key: CRMExportSection; label: string; description: string }> = [
    {
      key: 'products',
      label: 'Produtos e acessórios',
      description: `${products.length} produto(s) e catálogo derivado`,
    },
    {
      key: 'sales',
      label: 'Clientes e propostas',
      description: `${sales.length} proposta(s), ${saleItems.length} item(ns) vendido(s)`,
    },
    {
      key: 'followups',
      label: 'Follow-ups',
      description: `${followups.length} acompanhamento(s)`,
    },
    {
      key: 'events',
      label: 'Histórico das propostas',
      description: `${events.length} evento(s) registrados`,
    },
    {
      key: 'settings',
      label: 'Metas e parâmetros',
      description: 'Comissão, metas e identificação do CRM',
    },
    {
      key: 'vehicles',
      label: 'Modelos, versões e anos',
      description: `${carModels.length} modelo(s) configurado(s)`,
    },
  ];

  // 1. Actions for settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      targetPerClient: Number(targetPerClient),
      commissionPercent: Number(commissionPercent),
      monthlyStoreCarsSold: undefined,
      monthlyTargetAmount: calculatedMonthlyTarget,
      goalBonusAmount: 0,
      goalExtraCommissionPercent: Number(goalExtraCommissionPercent),
      commissionPlanVersion: 2,
      dealerName: dealerName.trim(),
    });
    showAlert('Sucesso', 'Configurações salvas com sucesso!');
  };

  const handleAddCarSalesperson = () => {
    const name = newCarSalespersonName.trim();
    if (!name) return;

    const existingSalespeople = settings.carSalespeople || [];
    const alreadyExists = existingSalespeople.some((person) => person.toLowerCase() === name.toLowerCase());
    if (alreadyExists) {
      showAlert('Vendedor já cadastrado', `"${name}" já existe na lista de vendedores.`);
      return;
    }

    updateSettings({
      carSalespeople: [...existingSalespeople, name].sort((a, b) => a.localeCompare(b)),
    });
    setNewCarSalespersonName('');
  };

  const handleDeleteCarSalesperson = (name: string) => {
    const hasSalesUsingPerson = sales.some((sale) => sale.carSalespersonName === name);
    showConfirm(
      'Excluir Vendedor',
      hasSalesUsingPerson
        ? `Remover "${name}" da lista ativa? Propostas antigas continuam exibindo esse vendedor.`
        : `Remover "${name}" da lista de vendedores?`,
      () => {
        updateSettings({
          carSalespeople: (settings.carSalespeople || []).filter((person) => person !== name),
        });
      }
    );
  };

  const handleAddInstaller = () => {
    const name = newInstallerName.trim();
    if (!name) return;

    const existingInstallers = settings.installers || [];
    const alreadyExists = existingInstallers.some((installer) => installer.toLowerCase() === name.toLowerCase());
    if (alreadyExists) {
      showAlert('Instalador já cadastrado', `"${name}" já existe na lista de instaladores.`);
      return;
    }

    updateSettings({
      installers: [...existingInstallers, name].sort((a, b) => a.localeCompare(b)),
    });
    setNewInstallerName('');
  };

  const handleDeleteInstaller = (name: string) => {
    const hasSalesUsingInstaller = sales.some((sale) => sale.installerName === name);
    showConfirm(
      'Excluir Instalador',
      hasSalesUsingInstaller
        ? `Remover "${name}" da lista ativa? Propostas antigas continuam exibindo esse instalador.`
        : `Remover "${name}" da lista de instaladores?`,
      () => {
        updateSettings({
          installers: (settings.installers || []).filter((installer) => installer !== name),
        });
      }
    );
  };

  const handleAddProductCategory = () => {
    const category = newProductCategoryName.trim();
    if (!category) return;

    const configuredMatch = configuredProductCategories.find((item) => normalizeText(item) === normalizeText(category));
    if (configuredMatch) {
      showAlert('Categoria já cadastrada', `"${configuredMatch}" já existe nas categorias de produto.`);
      setNewProductCategoryName('');
      return;
    }

    const usedMatch = visibleProductCategories.find((item) => normalizeText(item) === normalizeText(category));
    updateSettings({
      productCategories: getUniqueProductCategories(configuredProductCategories, [usedMatch || category]),
    });
    setNewProductCategoryName('');
  };

  const handleDeleteProductCategory = (category: string) => {
    const productsInCategory = productCategoryCounts[category] || 0;
    if (productsInCategory > 0) {
      showAlert(
        'Categoria em uso',
        `"${category}" tem ${productsInCategory} produto(s) cadastrado(s). Reclassifique ou exclua esses produtos antes de remover a categoria.`
      );
      return;
    }

    showConfirm(
      'Excluir Categoria',
      `Remover "${category}" da lista de categorias disponíveis para novos produtos?`,
      () => {
        updateSettings({
          productCategories: configuredProductCategories.filter((item) => normalizeText(item) !== normalizeText(category)),
        });
      }
    );
  };

  const toggleSection = (
    section: CRMExportSection,
    selectedSections: CRMExportSection[],
    setSelectedSections: React.Dispatch<React.SetStateAction<CRMExportSection[]>>
  ) => {
    setSelectedSections(
      selectedSections.includes(section)
        ? selectedSections.filter((item) => item !== section)
        : [...selectedSections, section]
    );
  };

  const setAllSections = (
    checked: boolean,
    setSelectedSections: React.Dispatch<React.SetStateAction<CRMExportSection[]>>
  ) => {
    setSelectedSections(checked ? allExportSections : []);
  };

  const handleExportJson = () => {
    if (selectedExportSections.length === 0) {
      showAlert('Exportação vazia', 'Selecione pelo menos um grupo de dados para exportar.');
      return;
    }

    const payload = exportCRMData(selectedExportSections);
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const dateTag = new Date().toISOString().slice(0, 10);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `crm-thayna-reis-export-${dateTag}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showAlert('Exportação criada', 'Arquivo JSON gerado com os grupos selecionados.');
  };

  const syncLocalSettingsAfterImport = (payload: CRMExportPayload) => {
    if (!selectedImportSections.includes('settings') || !payload.data.settings) return;
    const importedSettings = payload.data.settings;
    const cleanSettings = sanitizeSettings(importedSettings);
    setTargetPerClient(cleanSettings.targetPerClient ?? 2000);
    setCommissionPercent(cleanSettings.commissionPercent);
    setGoalExtraCommissionPercent(cleanSettings.goalExtraCommissionPercent ?? 0.5);
    setDealerName(cleanSettings.dealerName);
  };

  const handleImportPayload = (payload: CRMExportPayload) => {
    const result = importCRMData(payload, selectedImportSections);
    syncLocalSettingsAfterImport(payload);
    const importedLabels = result.importedSections
      .map((section) => exportOptions.find((option) => option.key === section)?.label || section)
      .join(', ');
    const skippedLabels = result.skippedSections
      .map((section) => exportOptions.find((option) => option.key === section)?.label || section)
      .join(', ');

    showAlert(
      'Importação concluída',
      [
        importedLabels ? `Importado: ${importedLabels}.` : 'Nenhum grupo foi importado.',
        skippedLabels ? `Ignorado por ausência no arquivo: ${skippedLabels}.` : '',
      ].filter(Boolean).join(' ')
    );
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (selectedImportSections.length === 0) {
      showAlert('Importação vazia', 'Selecione pelo menos um grupo de dados para importar.');
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as CRMExportPayload;
      setLastImportFileName(file.name);
      showConfirm(
        'Importar JSON',
        `Importar "${file.name}" vai substituir os grupos selecionados no CRM atual. Confirma a importação?`,
        () => handleImportPayload(parsed)
      );
    } catch (error) {
      showAlert('Arquivo inválido', error instanceof Error ? error.message : 'Não foi possível ler este JSON.');
    }
  };

  const handleClearProducts = () => {
    showConfirm(
      'Excluir todos os produtos',
      'Isso vai apagar todo o catálogo de produtos e acessórios disponíveis para novas propostas. Clientes e propostas existentes serão mantidos. Confirma?',
      () => {
        clearProducts();
        showAlert('Catálogo limpo', 'Todos os produtos e acessórios foram removidos.');
      }
    );
  };

  const handleClearSalesData = () => {
    showConfirm(
      'Excluir todas as propostas',
      'Isso vai apagar todos os clientes, propostas, itens vendidos, follow-ups e histórico de eventos. Produtos e configurações serão mantidos. Confirma?',
      () => {
        clearSalesData();
        showAlert('Propostas removidas', 'Clientes, propostas, itens, follow-ups e histórico foram removidos.');
      }
    );
  };

  const handleResetSystem = () => {
    showConfirm(
      'Resetar sistema inteiro',
      'Isso vai apagar todos os produtos, acessórios, propostas, follow-ups, histórico, configurações e modelos personalizados, deixando o sistema limpo. Confirma o reset completo?',
      () => {
        resetDatabase();
        setTargetPerClient(2000);
        setCommissionPercent(1.7);
        setGoalExtraCommissionPercent(0.5);
        setDealerName('CRM Thayná Reis');
        setSelectedModelId('');
        setSelectedVersionName('');
        showAlert('Sistema resetado', 'O CRM foi limpo. Produtos, acessórios, propostas, follow-ups e histórico foram removidos.');
      }
    );
  };

  // 2. Actions for Models
  const handleAddModel = () => {
    const name = newModelName.trim();
    if (!name) return;
    const exists = carModels.some((m) => m.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      showAlert('Erro', 'Este modelo de carro já está cadastrado!');
      return;
    }
    const updated = [
      ...carModels,
      {
        id: `m_${Date.now()}`,
        name,
        versions: [],
      },
    ];
    saveCarModels(updated);
    setSelectedModelId(updated[updated.length - 1].id);
    setSelectedVersionName('');
    setNewModelName('');
  };

  const handleDeleteModel = (id: string, name: string) => {
    if (['Tiggo 5', 'Tiggo 7', 'Tiggo 8'].includes(name)) {
      showAlert('Modelo fixo', 'Tiggo 5, Tiggo 7 e Tiggo 8 não podem ser removidos do escopo atual.');
      return;
    }
    showConfirm(
      'Apagar Modelo',
      `Tem certeza que deseja apagar o modelo "${name}" e TODAS as suas versões/anos associadas?`,
      () => {
        const updated = carModels.filter((m) => m.id !== id);
        saveCarModels(updated);
        if (selectedModelId === id) {
          setSelectedModelId(updated[0]?.id || '');
          setSelectedVersionName('');
        }
      }
    );
  };

  const handleStartEditModel = (id: string, name: string) => {
    setSelectedModelId(id);
    setSelectedVersionName('');
    setEditingModelId(id);
    setEditingModelName(name);
  };

  const handleCancelEditModel = () => {
    setEditingModelId('');
    setEditingModelName('');
  };

  const handleSaveModelName = () => {
    const name = editingModelName.trim();
    if (!editingModelId || !name) {
      showAlert('Nome obrigatório', 'Informe um nome para o modelo.');
      return;
    }

    const duplicated = carModels.some(
      (model) => model.id !== editingModelId && normalizeText(model.name) === normalizeText(name)
    );
    if (duplicated) {
      showAlert('Modelo já cadastrado', 'Já existe outro modelo com este nome.');
      return;
    }

    saveCarModels(carModels.map((model) => (model.id === editingModelId ? { ...model, name } : model)));
    handleCancelEditModel();
  };

  // 3. Actions for Versions
  const handleAddVersion = () => {
    if (!selectedModelId || !newVersionName.trim()) return;
    const model = carModels.find((m) => m.id === selectedModelId);
    if (!model) return;

    const exists = model.versions.some(
      (v) => v.name.toLowerCase() === newVersionName.trim().toLowerCase()
    );
    if (exists) {
      showAlert('Erro', 'Esta versão já existe para este modelo!');
      return;
    }

    const updatedVersions = [
      ...model.versions,
      {
        name: newVersionName.trim(),
        years: [],
      },
    ];

    const updatedModels = carModels.map((m) =>
      m.id === selectedModelId ? { ...m, versions: updatedVersions } : m
    );

    saveCarModels(updatedModels);
    setSelectedVersionName(newVersionName.trim());
    setNewVersionName('');
  };

  const handleDeleteVersion = (versionName: string) => {
    if (!selectedModelId) return;
    showConfirm(
      'Apagar Versão',
      `Tem certeza que deseja apagar a versão "${versionName}" com seus anos associados?`,
      () => {
        const model = carModels.find((m) => m.id === selectedModelId);
        if (!model) return;

        const updatedVersions = model.versions.filter((v) => v.name !== versionName);
        const updatedModels = carModels.map((m) =>
          m.id === selectedModelId ? { ...m, versions: updatedVersions } : m
        );

        saveCarModels(updatedModels);
        if (selectedVersionName === versionName) {
          setSelectedVersionName('');
        }
      }
    );
  };

  const handleStartEditVersion = (versionName: string) => {
    setSelectedVersionName(versionName);
    setEditingVersionName(versionName);
    setEditingVersionValue(versionName);
    setEditingYearName('');
    setEditingYearValue('');
  };

  const handleCancelEditVersion = () => {
    setEditingVersionName('');
    setEditingVersionValue('');
  };

  const handleSaveVersionName = () => {
    if (!selectedModelId || !editingVersionName) return;
    const name = editingVersionValue.trim();
    if (!name) {
      showAlert('Nome obrigatório', 'Informe um nome para a versão.');
      return;
    }

    const model = carModels.find((m) => m.id === selectedModelId);
    if (!model) return;

    const duplicated = model.versions.some(
      (version) => version.name !== editingVersionName && normalizeText(version.name) === normalizeText(name)
    );
    if (duplicated) {
      showAlert('Versão já cadastrada', 'Já existe outra versão com este nome neste modelo.');
      return;
    }

    const updatedModels = carModels.map((m) =>
      m.id === selectedModelId
        ? {
            ...m,
            versions: m.versions.map((version) =>
              version.name === editingVersionName ? { ...version, name } : version
            ),
          }
        : m
    );

    saveCarModels(updatedModels);
    setSelectedVersionName(name);
    handleCancelEditVersion();
  };

  // 4. Actions for Years
  const handleAddYear = () => {
    if (!selectedModelId || !selectedVersionName || !newYearName.trim()) return;
    const model = carModels.find((m) => m.id === selectedModelId);
    if (!model) return;

    const version = model.versions.find((v) => v.name === selectedVersionName);
    if (!version) return;

    const trimmedYear = newYearName.trim();
    if (version.years.includes(trimmedYear)) {
      showAlert('Erro', 'Este ano já está cadastrado para esta versão!');
      return;
    }

    // Add in order
    const updatedYears = [...version.years, trimmedYear].sort((a, b) => b.localeCompare(a));

    const updatedVersions = model.versions.map((v) =>
      v.name === selectedVersionName ? { ...v, years: updatedYears } : v
    );

    const updatedModels = carModels.map((m) =>
      m.id === selectedModelId ? { ...m, versions: updatedVersions } : m
    );

    saveCarModels(updatedModels);
    setNewYearName('');
  };

  const handleDeleteYear = (year: string) => {
    if (!selectedModelId || !selectedVersionName) return;
    const model = carModels.find((m) => m.id === selectedModelId);
    if (!model) return;

    const version = model.versions.find((v) => v.name === selectedVersionName);
    if (!version) return;

    const updatedYears = version.years.filter((y) => y !== year);

    const updatedVersions = model.versions.map((v) =>
      v.name === selectedVersionName ? { ...v, years: updatedYears } : v
    );

    const updatedModels = carModels.map((m) =>
      m.id === selectedModelId ? { ...m, versions: updatedVersions } : m
    );

    saveCarModels(updatedModels);
  };

  const handleStartEditYear = (year: string) => {
    setEditingYearName(year);
    setEditingYearValue(year);
  };

  const handleCancelEditYear = () => {
    setEditingYearName('');
    setEditingYearValue('');
  };

  const handleSaveYearName = () => {
    if (!selectedModelId || !selectedVersionName || !editingYearName) return;
    const year = editingYearValue.trim();
    if (!year) {
      showAlert('Ano obrigatório', 'Informe um ano.');
      return;
    }

    const model = carModels.find((m) => m.id === selectedModelId);
    const version = model?.versions.find((v) => v.name === selectedVersionName);
    if (!model || !version) return;

    const duplicated = version.years.some((currentYear) => currentYear !== editingYearName && currentYear === year);
    if (duplicated) {
      showAlert('Ano já cadastrado', 'Este ano já existe nesta versão.');
      return;
    }

    const updatedYears = version.years
      .map((currentYear) => (currentYear === editingYearName ? year : currentYear))
      .sort((a, b) => b.localeCompare(a));

    const updatedModels = carModels.map((m) =>
      m.id === selectedModelId
        ? {
            ...m,
            versions: m.versions.map((v) =>
              v.name === selectedVersionName ? { ...v, years: updatedYears } : v
            ),
          }
        : m
    );

    saveCarModels(updatedModels);
    handleCancelEditYear();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-start sm:items-center justify-center p-3 sm:p-4 z-[70] animate-fade-in no-print overflow-y-auto">
      <div className="bg-white rounded-xl max-w-4xl w-full p-4 sm:p-6 shadow-xl border border-slate-200 flex flex-col space-y-6 my-3 sm:my-8 font-sans max-h-[calc(100vh-1.5rem)] sm:max-h-[92vh]">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#002C5F]" />
            <span className="text-lg font-bold text-slate-800 tracking-tight uppercase">
              Configurações Gerais & Catálogo de Carros
            </span>
          </div>
          <button
            onClick={onClose}
            className="bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 p-1.5 rounded-lg border border-slate-200 transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 overflow-y-auto pr-1">
          {/* LEFT PANEL: Meta/Commission Goals Column */}
          <div className="md:col-span-1 bg-slate-50 border border-slate-200 p-4 rounded-xl h-fit space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-slate-200">
              <TrendingUp className="w-4 h-4 text-[#002C5F]" />
              Metas & Parâmetros
            </h3>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Oportunidades criadas no mês</label>
                <div className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-800 font-bold">
                  {monthlyOpportunityCount}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Calculado automaticamente pelo pipeline de propostas deste mês.
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Meta mínima por carro vendido (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">R$</span>
                  <input
                    type="number"
                    value={targetPerClient}
                    onChange={(e) => setTargetPerClient(Math.max(0, Number(e.target.value)))}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-white text-slate-800 font-bold"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Meta total: {calculatedMonthlyTarget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Comissão base (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={commissionPercent}
                    onChange={(e) => setCommissionPercent(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-white text-slate-800 font-bold"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 font-bold">%</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Extra ao bater meta (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={goalExtraCommissionPercent}
                    onChange={(e) => setGoalExtraCommissionPercent(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-white text-slate-800 font-bold"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 font-bold">%</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Se a loja bater a meta de acessórios, soma ao percentual base.
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Identificação do CRM</label>
                <input
                  type="text"
                  value={dealerName}
                  onChange={(e) => setDealerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-white text-slate-800 font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#002C5F] hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs text-xs uppercase tracking-wider"
              >
                <Check className="w-4 h-4" /> Salvar Metas
              </button>
            </form>

            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-3">
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-700">
                  Vendedores de Carro
                </h4>
                <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                  Lista usada no campo da proposta.
                </p>
              </div>

              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newCarSalespersonName}
                  onChange={(e) => setNewCarSalespersonName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCarSalesperson();
                    }
                  }}
                  placeholder="Novo vendedor"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-medium text-slate-700 focus:outline-none focus:border-slate-400"
                />
                <button
                  type="button"
                  onClick={handleAddCarSalesperson}
                  className="rounded-lg bg-[#002C5F] p-1.5 text-white hover:bg-slate-800"
                  title="Adicionar vendedor"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-100 divide-y divide-slate-100">
                {(settings.carSalespeople || []).map((person) => (
                  <div key={person} className="flex items-center justify-between gap-2 px-2 py-2">
                    <span className="min-w-0 truncate font-bold text-slate-700">{person}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCarSalesperson(person)}
                      className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title={`Excluir ${person}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {(settings.carSalespeople || []).length === 0 && (
                  <div className="p-3 text-center text-[10px] font-semibold text-slate-400">
                    Nenhum vendedor cadastrado.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-3">
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-700">
                  Instaladores
                </h4>
                <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                  Lista usada na agenda de instalação.
                </p>
              </div>

              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newInstallerName}
                  onChange={(e) => setNewInstallerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddInstaller();
                    }
                  }}
                  placeholder="Novo instalador"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-medium text-slate-700 focus:outline-none focus:border-slate-400"
                />
                <button
                  type="button"
                  onClick={handleAddInstaller}
                  className="rounded-lg bg-[#002C5F] p-1.5 text-white hover:bg-slate-800"
                  title="Adicionar instalador"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-100 divide-y divide-slate-100">
                {(settings.installers || []).map((installer) => (
                  <div key={installer} className="flex items-center justify-between gap-2 px-2 py-2">
                    <span className="min-w-0 truncate font-bold text-slate-700">{installer}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteInstaller(installer)}
                      className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title={`Excluir ${installer}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {(settings.installers || []).length === 0 && (
                  <div className="p-3 text-center text-[10px] font-semibold text-slate-400">
                    Nenhum instalador cadastrado.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANELS: Hierarchical Cascade Car Catalog Manager */}
          <div className="md:col-span-2 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">
                  Categorias de Produtos
                </h3>
                <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">
                  Usadas no catálogo, filtros e cadastro de novos produtos.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={newProductCategoryName}
                  onChange={(e) => setNewProductCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddProductCategory();
                    }
                  }}
                  placeholder="Nova categoria"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-slate-400"
                />
                <button
                  type="button"
                  onClick={handleAddProductCategory}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#002C5F] px-3 py-2 text-[10px] font-black uppercase tracking-wide text-white hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibleProductCategories.map((category) => {
                  const count = productCategoryCounts[category] || 0;
                  return (
                    <div
                      key={category}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-black text-slate-700">{category}</div>
                        <div className="text-[10px] font-semibold text-slate-400">
                          {count > 0 ? `${count} produto(s)` : 'Sem produtos'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteProductCategory(category)}
                        className={`shrink-0 rounded-md p-1 ${
                          count > 0
                            ? 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'
                            : 'text-slate-400 hover:bg-red-50 hover:text-red-600'
                        }`}
                        title={count > 0 ? 'Categoria em uso' : `Excluir ${category}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
                {visibleProductCategories.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-[10px] font-semibold text-slate-400 sm:col-span-2">
                    Nenhuma categoria cadastrada.
                  </div>
                )}
              </div>
            </div>

            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Cascada de Veículos (Modelos &gt; Versões &gt; Anos)
            </h3>

            <div className="grid grid-cols-3 gap-3">
              {/* Col 1: Models */}
              <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-white">
                <div className="bg-slate-100 px-2.5 py-1.5 border-b border-slate-200 font-bold text-[10px] text-slate-600 block uppercase tracking-wide">
                  Modelos
                </div>
                <div className="p-1.5 border-b border-slate-100 flex gap-1 bg-slate-50/50">
                  <input
                    type="text"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    placeholder="Novo modelo"
                    className="p-1 border border-slate-200 rounded text-[11px] w-full focus:outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddModel()}
                  />
                  <button
                    onClick={handleAddModel}
                    className="bg-[#002C5F] hover:bg-slate-800 text-white p-1 rounded transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="overflow-y-auto max-h-[300px] flex-1 text-xs divide-y divide-slate-100">
                  {carModels.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => {
                        setSelectedModelId(m.id);
                        setSelectedVersionName('');
                      }}
                      className={`flex items-center justify-between px-2.5 py-2 cursor-pointer transition-all ${
                        selectedModelId === m.id
                          ? 'bg-blue-50 text-[#002C5F] font-bold border-r-2 border-[#002C5F]'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {editingModelId === m.id ? (
                        <div className="flex min-w-0 flex-1 items-center gap-1">
                          <input
                            type="text"
                            value={editingModelName}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditingModelName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveModelName();
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                handleCancelEditModel();
                              }
                            }}
                            className="min-w-0 flex-1 rounded border border-blue-200 bg-white px-1.5 py-1 text-[11px] font-bold text-slate-800 focus:outline-none focus:border-[#002C5F]"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveModelName();
                            }}
                            className="shrink-0 rounded bg-emerald-50 p-1 text-emerald-700 hover:bg-emerald-100"
                            title="Salvar nome do modelo"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelEditModel();
                            }}
                            className="shrink-0 rounded bg-slate-50 p-1 text-slate-500 hover:bg-slate-100"
                            title="Cancelar edição"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="min-w-0 truncate">{m.name}</span>
                          <div className="ml-2 flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEditModel(m.id, m.name);
                              }}
                              className="rounded p-0.5 text-slate-400 hover:bg-blue-50 hover:text-[#002C5F]"
                              title={`Editar ${m.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            {!['Tiggo 5', 'Tiggo 7', 'Tiggo 8'].includes(m.name) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteModel(m.id, m.name);
                                }}
                                className="rounded p-0.5 text-slate-400 hover:text-red-500"
                                title={`Excluir ${m.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {carModels.length === 0 && (
                    <div className="p-3 text-center text-slate-400 text-[10px]">
                      Nenhum cadastrado.
                    </div>
                  )}
                </div>
              </div>

              {/* Col 2: Versions */}
              <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-white">
                <div className="bg-slate-100 px-2.5 py-1.5 border-b border-slate-200 font-bold text-[10px] text-slate-600 block uppercase tracking-wide">
                  Versões {currentModel && `de ${currentModel.name}`}
                </div>
                {currentModel ? (
                  <>
                    <div className="p-1.5 border-b border-slate-100 flex gap-1 bg-slate-50/50">
                      <input
                        type="text"
                        value={newVersionName}
                        onChange={(e) => setNewVersionName(e.target.value)}
                        placeholder="Ex. N Line"
                        className="p-1 border border-slate-200 rounded text-[11px] w-full focus:outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddVersion()}
                      />
                      <button
                        onClick={handleAddVersion}
                        className="bg-[#002C5F] hover:bg-slate-800 text-white p-1 rounded transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="overflow-y-auto max-h-[300px] flex-1 text-xs divide-y divide-slate-100">
                      {currentModel.versions.map((v) => (
                        <div
                          key={v.name}
                          onClick={() => setSelectedVersionName(v.name)}
                          className={`flex items-center justify-between px-2.5 py-2 cursor-pointer transition-all ${
                            selectedVersionName === v.name
                              ? 'bg-purple-50 text-purple-950 font-bold border-r-2 border-purple-600'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {editingVersionName === v.name ? (
                            <div className="flex min-w-0 flex-1 items-center gap-1">
                              <input
                                type="text"
                                value={editingVersionValue}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setEditingVersionValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveVersionName();
                                  }
                                  if (e.key === 'Escape') {
                                    e.preventDefault();
                                    handleCancelEditVersion();
                                  }
                                }}
                                className="min-w-0 flex-1 rounded border border-purple-200 bg-white px-1.5 py-1 text-[11px] font-bold text-slate-800 focus:outline-none focus:border-purple-600"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveVersionName();
                                }}
                                className="shrink-0 rounded bg-emerald-50 p-1 text-emerald-700 hover:bg-emerald-100"
                                title="Salvar nome da versão"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelEditVersion();
                                }}
                                className="shrink-0 rounded bg-slate-50 p-1 text-slate-500 hover:bg-slate-100"
                                title="Cancelar edição"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="min-w-0 truncate">{v.name}</span>
                              <div className="ml-2 flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEditVersion(v.name);
                                  }}
                                  className="rounded p-0.5 text-slate-400 hover:bg-purple-50 hover:text-purple-700"
                                  title={`Editar ${v.name}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteVersion(v.name);
                                  }}
                                  className="rounded p-0.5 text-slate-400 hover:text-red-500"
                                  title={`Excluir ${v.name}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      {currentModel.versions.length === 0 && (
                        <div className="p-3 text-center text-slate-400 text-[10px]">
                          Crie a primeira versão acima.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-6 text-center text-slate-400 text-[10px] flex-1 flex items-center justify-center">
                    Selecione um modelo à esquerda.
                  </div>
                )}
              </div>

              {/* Col 3: Years */}
              <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-white">
                <div className="bg-slate-100 px-2.5 py-1.5 border-b border-slate-200 font-bold text-[10px] text-slate-600 block uppercase tracking-wide">
                  Anos {currentVersion && `de ${currentVersion.name}`}
                </div>
                {currentVersion ? (
                  <>
                    <div className="p-1.5 border-b border-slate-100 flex gap-1 bg-slate-50/50">
                      <input
                        type="text"
                        value={newYearName}
                        onChange={(e) => setNewYearName(e.target.value)}
                        placeholder="Ex. 2026"
                        className="p-1 border border-slate-200 rounded text-[11px] w-full focus:outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddYear()}
                      />
                      <button
                        onClick={handleAddYear}
                        className="bg-[#002C5F] hover:bg-slate-800 text-white p-1 rounded transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="overflow-y-auto max-h-[300px] flex-1 text-xs divide-y divide-slate-100">
                      {currentVersion.years.map((y) => (
                        <div
                          key={y}
                          className="flex items-center justify-between px-2.5 py-2 text-slate-700 hover:bg-slate-50 transition-all font-mono"
                        >
                          {editingYearName === y ? (
                            <div className="flex min-w-0 flex-1 items-center gap-1">
                              <input
                                type="text"
                                value={editingYearValue}
                                onChange={(e) => setEditingYearValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveYearName();
                                  }
                                  if (e.key === 'Escape') {
                                    e.preventDefault();
                                    handleCancelEditYear();
                                  }
                                }}
                                className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-bold text-slate-800 focus:outline-none focus:border-[#002C5F]"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={handleSaveYearName}
                                className="shrink-0 rounded bg-emerald-50 p-1 text-emerald-700 hover:bg-emerald-100"
                                title="Salvar ano"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditYear}
                                className="shrink-0 rounded bg-slate-50 p-1 text-slate-500 hover:bg-slate-100"
                                title="Cancelar edição"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span>{y}</span>
                              <div className="ml-2 flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditYear(y)}
                                  className="rounded p-0.5 text-slate-400 hover:bg-blue-50 hover:text-[#002C5F]"
                                  title={`Editar ${y}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteYear(y)}
                                  className="rounded p-0.5 text-slate-400 hover:text-red-500"
                                  title={`Excluir ${y}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      {currentVersion.years.length === 0 && (
                        <div className="p-3 text-center text-slate-400 text-[10px]">
                          Adicione o primeiro ano acima.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-6 text-center text-slate-400 text-[10px] flex-1 flex items-center justify-center">
                    {currentModel ? 'Selecione uma versão ao centro.' : 'Selecione modelo e versão.'}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-150 p-3 rounded-lg text-[11px] text-blue-900 leading-relaxed font-medium">
              💡 <strong>Como funciona a Cascata?</strong> Ao cadastrar um acessório ou uma nova proposta de venda, os menus suspensos de carros puxam automaticamente suas configurações de Modelo, Versão e Ano associados em cascata!
            </div>
          </div>

          <div className="md:col-span-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-widest">
                  <FileJson className="h-4 w-4 text-[#002C5F]" />
                  Backup JSON do CRM
                </h3>
                <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">
                  Exporte ou importe grupos específicos. Importação substitui somente os grupos marcados.
                </p>
              </div>
              {lastImportFileName && (
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700">
                  Último arquivo: {lastImportFileName}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide text-[#002C5F]">Exportar</div>
                    <div className="text-[10px] font-semibold text-slate-500">Baixa um arquivo .json no navegador.</div>
                  </div>
                  <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
                    <input
                      type="checkbox"
                      checked={selectedExportSections.length === allExportSections.length}
                      onChange={(e) => setAllSections(e.target.checked, setSelectedExportSections)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-[#002C5F]"
                    />
                    Tudo
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {exportOptions.map((option) => (
                    <label
                      key={`export-${option.key}`}
                      className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white p-2.5 hover:bg-blue-50/40"
                    >
                      <input
                        type="checkbox"
                        checked={selectedExportSections.includes(option.key)}
                        onChange={() => toggleSection(option.key, selectedExportSections, setSelectedExportSections)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#002C5F]"
                      />
                      <span>
                        <span className="block text-[11px] font-black text-slate-700">{option.label}</span>
                        <span className="block text-[10px] font-medium text-slate-400">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleExportJson}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#002C5F] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white hover:bg-slate-800"
                >
                  <Download className="h-4 w-4" />
                  Exportar JSON
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide text-[#002C5F]">Importar</div>
                    <div className="text-[10px] font-semibold text-slate-500">Lê JSON exportado por este CRM.</div>
                  </div>
                  <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
                    <input
                      type="checkbox"
                      checked={selectedImportSections.length === allExportSections.length}
                      onChange={(e) => setAllSections(e.target.checked, setSelectedImportSections)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-[#002C5F]"
                    />
                    Tudo
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {exportOptions.map((option) => (
                    <label
                      key={`import-${option.key}`}
                      className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white p-2.5 hover:bg-amber-50/40"
                    >
                      <input
                        type="checkbox"
                        checked={selectedImportSections.includes(option.key)}
                        onChange={() => toggleSection(option.key, selectedImportSections, setSelectedImportSections)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#002C5F]"
                      />
                      <span>
                        <span className="block text-[11px] font-black text-slate-700">{option.label}</span>
                        <span className="block text-[10px] font-medium text-slate-400">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </div>

                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-amber-800 hover:bg-amber-100"
                >
                  <Upload className="h-4 w-4" />
                  Importar JSON
                </button>
              </div>
            </div>
          </div>

          <div className="md:col-span-3 rounded-xl border border-red-200 bg-red-50/45 p-4 shadow-sm space-y-4">
            <div>
              <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-800">
                <Trash2 className="h-4 w-4" />
                Zona de risco
              </h3>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-red-700">
                Use antes um backup JSON. Todas as ações abaixo pedem confirmação antes de alterar dados.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <button
                type="button"
                onClick={handleClearProducts}
                className="rounded-xl border border-red-200 bg-white p-3 text-left transition-all hover:bg-red-50 hover:shadow-sm"
              >
                <span className="block text-xs font-black uppercase tracking-wide text-red-800">
                  Excluir todos os produtos
                </span>
                <span className="mt-1 block text-[10px] font-semibold leading-relaxed text-red-600">
                  Remove catálogo de produtos/acessórios. Mantém clientes e propostas.
                </span>
              </button>

              <button
                type="button"
                onClick={handleClearSalesData}
                className="rounded-xl border border-red-200 bg-white p-3 text-left transition-all hover:bg-red-50 hover:shadow-sm"
              >
                <span className="block text-xs font-black uppercase tracking-wide text-red-800">
                  Excluir todas as propostas
                </span>
                <span className="mt-1 block text-[10px] font-semibold leading-relaxed text-red-600">
                  Remove clientes, propostas, itens vendidos, follow-ups e histórico.
                </span>
              </button>

              <button
                type="button"
                onClick={handleResetSystem}
                className="rounded-xl border border-red-300 bg-red-700 p-3 text-left text-white transition-all hover:bg-red-800 hover:shadow-sm"
              >
                <span className="block text-xs font-black uppercase tracking-wide">
                  Resetar sistema inteiro
                </span>
                <span className="mt-1 block text-[10px] font-semibold leading-relaxed text-red-50">
                  Limpa produtos, acessórios, propostas, histórico, configs e modelos.
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer bar */}
        <div className="flex items-center justify-end pt-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wide"
          >
            Fechar Configurações
          </button>
        </div>
      </div>
    </div>
  );
}
