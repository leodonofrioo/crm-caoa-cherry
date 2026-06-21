import React, { useMemo, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { ALLOWED_CAR_MODELS, isVehicleCompatible } from '../data/accessories';
import { getCategoryConfig } from '../data/categoryConfig';
import { AccessoryCategory, CarModel, Product, ProductVariation, VehicleCompatibility } from '../types';
import type { CategoryFieldConfig } from '../data/categoryConfig';
import { Check, ChevronDown, ChevronUp, Edit, Filter, Plus, Printer, Search, Tag, Trash, XCircle } from 'lucide-react';
import { MobileFilterSheet, MobilePageHeader } from './mobile';
import AccessoryChecklistPrint, { buildAccessoryChecklistPages } from './AccessoryChecklistPrint';

const SOLAR_FILM_CATEGORY = 'Película Solar';

const emptyVariation = (): ProductVariation => ({
  id: `var_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  name: '',
  description: '',
  price: 0,
  timeEstimate: 30,
  compatibilities: ALLOWED_CAR_MODELS.map((model) => ({ model })),
  active: true,
});

const normalizeText = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const getUniqueCategories = (...categoryLists: Array<Array<string | undefined>>): AccessoryCategory[] => {
  const categories = new Map<string, AccessoryCategory>();
  categoryLists.flat().forEach((category) => {
    const trimmed = category?.trim();
    if (!trimmed) return;
    categories.set(normalizeText(trimmed), trimmed);
  });
  return Array.from(categories.values());
};

const sortCategories = (categories: AccessoryCategory[]) =>
  [...categories].sort((a, b) => a.localeCompare(b, 'pt-BR'));

const clampNumber = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

const getNumberAttribute = (variation: ProductVariation, key: string): number | undefined => {
  const value = variation.attributes?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const getAttributeInputValue = (variation: ProductVariation, field: CategoryFieldConfig) => {
  const value = variation.attributes?.[field.key];
  if (field.type === 'number') return getNumberAttribute(variation, field.key) ?? '';
  if (field.type === 'color') return typeof value === 'string' && value ? value : '#000000';
  return value === undefined ? '' : String(value);
};

const getGlareReduction = (variation: ProductVariation) => {
  const visibleLightTransmission = getNumberAttribute(variation, 'visibleLightTransmission');
  if (visibleLightTransmission === undefined) return '';
  return clampNumber(Math.round(100 - visibleLightTransmission), 0, 99);
};

const isSolarFilmCategory = (category: AccessoryCategory) =>
  normalizeText(category) === normalizeText(SOLAR_FILM_CATEGORY);

const getSolarFilmBadges = (variation: ProductVariation): string[] => {
  const visibleLightTransmission = getNumberAttribute(variation, 'visibleLightTransmission');
  const uvProtection = getNumberAttribute(variation, 'uvProtection');
  const heatRejection = getNumberAttribute(variation, 'heatRejection');
  const infraredRejection = getNumberAttribute(variation, 'infraredRejection');

  return [
    visibleLightTransmission !== undefined ? `Transp.: ${clampNumber(Math.round(visibleLightTransmission), 1, 100)}%` : undefined,
    visibleLightTransmission !== undefined ? `Ofusc.: ${clampNumber(Math.round(100 - visibleLightTransmission), 0, 99)}%` : undefined,
    uvProtection !== undefined ? `UV: ${clampNumber(Math.round(uvProtection), 0, 100)}%` : undefined,
    heatRejection !== undefined ? `TSER: ${clampNumber(Math.round(heatRejection), 0, 100)}%` : undefined,
    infraredRejection !== undefined ? `IR: ${clampNumber(Math.round(infraredRejection), 0, 100)}%` : undefined,
  ].filter((item): item is string => Boolean(item));
};

const unionCompatibilities = (variations: ProductVariation[]): VehicleCompatibility[] => {
  const map = new Map<string, VehicleCompatibility>();
  variations.forEach((variation) => {
    variation.compatibilities.forEach((compatibility) => {
      if (ALLOWED_CAR_MODELS.includes(compatibility.model)) map.set(compatibility.model, { model: compatibility.model });
    });
  });
  return Array.from(map.values());
};

const formatCompatibility = (compatibility: VehicleCompatibility) =>
  [
    compatibility.model,
    compatibility.version || 'todas as versões',
    compatibility.year || 'todos os anos',
  ].join(' - ');

const optionalPositiveNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const getYearSortValue = (year: string) => {
  const parsed = Number(year);
  return Number.isInteger(parsed) ? parsed : Number.POSITIVE_INFINITY;
};

const getCompatibilityYearOptions = (years: string[]) => {
  const maxYear = new Date().getFullYear() + 1;
  const numericYears = years.map(Number).filter(Number.isInteger);
  const minYear = numericYears.length > 0
    ? Math.min(...numericYears.filter((year) => year <= maxYear), maxYear)
    : maxYear;
  const rangeYears = Array.from({ length: maxYear - minYear + 1 }, (_, index) => String(minYear + index));
  return Array.from(new Set([...years.filter((year) => getYearSortValue(year) <= maxYear), ...rangeYears]))
    .sort((a, b) => getYearSortValue(a) - getYearSortValue(b) || a.localeCompare(b, 'pt-BR'));
};

const withCompatibilityYearOptions = (models: CarModel[]): CarModel[] =>
  models.map((model) => ({
    ...model,
    versions: model.versions.map((version) => ({
      ...version,
      years: getCompatibilityYearOptions(version.years),
    })),
  }));

export default function AccessoriesList() {
  const { products, carModels, settings, updateSettings, addProduct, updateProduct, deleteProduct, showAlert, showConfirm } = useCRM();
  const defaultFormCategory = settings.productCategories?.[0] || products[0]?.category || 'Outro';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedModel, setSelectedModel] = useState('Todos');
  const [selectedVersion, setSelectedVersion] = useState('Todos');
  const [selectedYear, setSelectedYear] = useState('Todos');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<AccessoryCategory>(defaultFormCategory);
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formVariations, setFormVariations] = useState<ProductVariation[]>([emptyVariation()]);
  const [expandedCompatibilityModels, setExpandedCompatibilityModels] = useState<Record<string, boolean>>({});
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isChecklistPrintOpen, setIsChecklistPrintOpen] = useState(false);
  const catalogCarModels = useMemo(
    () => withCompatibilityYearOptions(carModels.filter((model) => ALLOWED_CAR_MODELS.includes(model.name))),
    [carModels]
  );
  const selectedCatalogModel = catalogCarModels.find((model) => model.name === selectedModel);
  const catalogVersionOptions = selectedCatalogModel?.versions || [];
  const selectedCatalogVersion = catalogVersionOptions.find((version) => version.name === selectedVersion);
  const catalogYearOptions = selectedCatalogVersion?.years || [];
  const canPrintCatalogChecklist = selectedModel !== 'Todos' && selectedVersion !== 'Todos' && selectedYear !== 'Todos';
  const checklistPages = useMemo(
    () =>
      canPrintCatalogChecklist
        ? buildAccessoryChecklistPages(products, [{ model: selectedModel, version: selectedVersion, year: selectedYear }])
        : [],
    [canPrintCatalogChecklist, products, selectedModel, selectedVersion, selectedYear]
  );
  const registeredProductCategories = useMemo(
    () => getUniqueCategories(products.map((product) => product.category)),
    [products]
  );
  const productCategoryOptions = useMemo(
    () =>
      getUniqueCategories(
        settings.productCategories || [],
        registeredProductCategories,
        formCategory ? [formCategory] : []
      ),
    [formCategory, registeredProductCategories, settings.productCategories]
  );
  const categoryFilterOptions = useMemo(
    () => sortCategories(registeredProductCategories),
    [registeredProductCategories]
  );
  const formCategoryFields = useMemo(() => getCategoryConfig(formCategory).fields, [formCategory]);
  const showSolarFilmFields = isSolarFilmCategory(formCategory);
  const activeSelectedCategory =
    selectedCategory === 'Todos' || categoryFilterOptions.includes(selectedCategory) ? selectedCategory : 'Todos';
  const activeVersion = selectedVersion === 'Todos' ? undefined : selectedVersion;
  const activeYear = selectedYear === 'Todos' ? undefined : selectedYear;

  const filteredProducts = products
    .map((product) => {
      const visibleVariations =
        selectedModel === 'Todos'
          ? product.variations
          : product.variations.filter((variation) =>
              isVehicleCompatible(variation.compatibilities, selectedModel, activeVersion, activeYear)
            );
      return { ...product, variations: visibleVariations };
    })
    .filter((product) => {
    const text = `${product.name} ${product.description} ${product.variations.map((variation) => variation.name).join(' ')}`.toLowerCase();
    const matchesSearch = text.includes(searchTerm.toLowerCase());
    const matchesCategory = activeSelectedCategory === 'Todos' || product.category === activeSelectedCategory;
    return matchesSearch && matchesCategory && product.variations.length > 0;
  });

  const handleCatalogModelChange = (model: string) => {
    setSelectedModel(model);
    setSelectedVersion('Todos');
    setSelectedYear('Todos');
  };

  const handleCatalogVersionChange = (version: string) => {
    setSelectedVersion(version);
    setSelectedYear('Todos');
  };

  const openCatalogChecklistPrint = () => {
    if (!canPrintCatalogChecklist) {
      showAlert('Escolha o veículo', 'Selecione modelo, versão e ano para imprimir só o checklist do carro do cliente.');
      return;
    }
    setIsChecklistPrintOpen(true);
  };

  const openCreateForm = () => {
    setEditingId(null);
    setFormName('');
    setFormDescription('');
    setFormCategory(productCategoryOptions[0] || 'Outro');
    setFormImageUrl('');
    setFormActive(true);
    setFormVariations([emptyVariation()]);
    setExpandedCompatibilityModels({});
    setIsAddingCategory(false);
    setNewCategoryName('');
    setIsFormOpen(true);
  };

  const openEditForm = (product: Product) => {
    setEditingId(product.id);
    setFormName(product.name);
    setFormDescription(product.description);
    setFormCategory(product.category);
    setFormImageUrl(product.imageUrl || '');
    setFormActive(product.active);
    setFormVariations(product.variations.length > 0 ? product.variations : [emptyVariation()]);
    setExpandedCompatibilityModels({});
    setIsAddingCategory(false);
    setNewCategoryName('');
    setIsFormOpen(true);
  };

  const addProductCategory = (rawCategory: string): AccessoryCategory | null => {
    const category = rawCategory.trim();
    if (!category) {
      showAlert('Categoria obrigatória', 'Informe o nome da nova categoria.');
      return null;
    }

    const allKnownCategories = getUniqueCategories(settings.productCategories || [], registeredProductCategories);
    const existing = allKnownCategories.find((item) => normalizeText(item) === normalizeText(category));
    if (existing) return existing;

    updateSettings({
      productCategories: sortCategories(getUniqueCategories(settings.productCategories || [], [category])),
    });
    return category;
  };

  const handleAddCategoryFromForm = () => {
    const category = addProductCategory(newCategoryName);
    if (!category) return;
    setFormCategory(category);
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  const updateVariation = (id: string, patch: Partial<ProductVariation>) => {
    setFormVariations((current) => current.map((variation) => (variation.id === id ? { ...variation, ...patch } : variation)));
  };

  const updateVariationAttribute = (id: string, key: string, value: string | number | undefined) => {
    setFormVariations((current) =>
      current.map((variation) => {
        if (variation.id !== id) return variation;
        const attributes = { ...(variation.attributes || {}) };
        if (value === undefined || value === '') delete attributes[key];
        else attributes[key] = value;
        return { ...variation, attributes };
      })
    );
  };

  const handleVariationAttributeChange = (variationId: string, field: CategoryFieldConfig, value: string) => {
    if (field.type === 'number') {
      if (value === '') {
        updateVariationAttribute(variationId, field.key, undefined);
        return;
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return;
      updateVariationAttribute(variationId, field.key, clampNumber(parsed, field.min, field.max));
      return;
    }

    updateVariationAttribute(variationId, field.key, value || undefined);
  };

  const handleGlareReductionChange = (variationId: string, value: string) => {
    if (value === '') {
      updateVariationAttribute(variationId, 'visibleLightTransmission', undefined);
      return;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const glareReduction = clampNumber(parsed, 0, 99);
    updateVariationAttribute(variationId, 'visibleLightTransmission', clampNumber(100 - glareReduction, 1, 100));
  };

  const isModelChecked = (variation: ProductVariation, modelName: string) =>
    variation.compatibilities.some((compatibility) => compatibility.model === modelName && !compatibility.version && !compatibility.year);

  const isVersionChecked = (variation: ProductVariation, modelName: string, versionName: string) =>
    isModelChecked(variation, modelName) ||
    variation.compatibilities.some(
      (compatibility) => compatibility.model === modelName && compatibility.version === versionName && !compatibility.year
    );

  const isYearChecked = (variation: ProductVariation, modelName: string, versionName: string, year: string) =>
    isVersionChecked(variation, modelName, versionName) ||
    variation.compatibilities.some(
      (compatibility) =>
        compatibility.model === modelName && compatibility.version === versionName && compatibility.year === year
    );

  const isVersionIndeterminate = (variation: ProductVariation, modelName: string, versionName: string, years: string[]) =>
    !isVersionChecked(variation, modelName, versionName) &&
    years.some((year) =>
      variation.compatibilities.some(
        (compatibility) =>
          compatibility.model === modelName && compatibility.version === versionName && compatibility.year === year
      )
    );

  const isModelIndeterminate = (variation: ProductVariation, model: { name: string; versions: Array<{ name: string; years: string[] }> }) =>
    !isModelChecked(variation, model.name) &&
    model.versions.some((version) =>
      isVersionChecked(variation, model.name, version.name) ||
      isVersionIndeterminate(variation, model.name, version.name, version.years)
    );

  const setVariationCompatibilities = (variation: ProductVariation, compatibilities: VehicleCompatibility[]) => {
    updateVariation(variation.id, {
      compatibilities: compatibilities.filter((compatibility) => ALLOWED_CAR_MODELS.includes(compatibility.model)),
    });
  };

  const toggleModelCompatibility = (variation: ProductVariation, modelName: string) => {
    if (isModelChecked(variation, modelName)) {
      setVariationCompatibilities(
        variation,
        variation.compatibilities.filter((compatibility) => compatibility.model !== modelName)
      );
      return;
    }
    setVariationCompatibilities(
      variation,
      [
        ...variation.compatibilities.filter((compatibility) => compatibility.model !== modelName),
        { model: modelName },
      ]
    );
  };

  const toggleVersionCompatibility = (variation: ProductVariation, modelName: string, versionName: string) => {
    const versionChecked = isVersionChecked(variation, modelName, versionName);
    const withoutModelOrVersion = variation.compatibilities.filter(
      (compatibility) =>
        compatibility.model !== modelName ||
        (compatibility.version && compatibility.version !== versionName)
    );

    setVariationCompatibilities(
      variation,
      versionChecked
        ? withoutModelOrVersion
        : [
            ...variation.compatibilities.filter(
              (compatibility) => compatibility.model !== modelName || compatibility.version !== versionName
            ).filter((compatibility) => !(compatibility.model === modelName && !compatibility.version)),
            { model: modelName, version: versionName },
          ]
    );
  };

  const toggleYearCompatibility = (variation: ProductVariation, modelName: string, versionName: string, year: string) => {
    const yearChecked = isYearChecked(variation, modelName, versionName, year);
    if (yearChecked) {
      setVariationCompatibilities(
        variation,
        variation.compatibilities.filter(
          (compatibility) =>
            !(
              compatibility.model === modelName &&
              ((!compatibility.version && !compatibility.year) ||
                (compatibility.version === versionName && (!compatibility.year || compatibility.year === year)))
            )
        )
      );
      return;
    }
    setVariationCompatibilities(
      variation,
      [
        ...variation.compatibilities.filter(
          (compatibility) =>
            !(compatibility.model === modelName && !compatibility.version) &&
            !(compatibility.model === modelName && compatibility.version === versionName && !compatibility.year)
        ),
        { model: modelName, version: versionName, year },
      ]
    );
  };

  const isAllModelsChecked = (variation: ProductVariation) =>
    catalogCarModels.length > 0 && catalogCarModels.every((model) => isModelChecked(variation, model.name));

  const isAllModelsIndeterminate = (variation: ProductVariation) =>
    !isAllModelsChecked(variation) &&
    catalogCarModels.some((model) => isModelChecked(variation, model.name) || isModelIndeterminate(variation, model));

  const toggleAllModelsCompatibility = (variation: ProductVariation) => {
    setVariationCompatibilities(
      variation,
      isAllModelsChecked(variation) ? [] : catalogCarModels.map((model) => ({ model: model.name }))
    );
  };

  const saveForm = (event: React.FormEvent) => {
    event.preventDefault();
    const name = formName.trim();
    if (!name) {
      showAlert('Campos Obrigatórios', 'Informe o nome do produto principal.');
      return;
    }
    const duplicatedProduct = products.some(
      (product) =>
        product.id !== editingId &&
        normalizeText(product.name) === normalizeText(name) &&
        product.category === formCategory
    );
    if (duplicatedProduct) {
      showAlert('Produto duplicado', 'Já existe um produto com este nome nesta categoria. Adicione uma variação nele.');
      return;
    }

    const cleanedVariations = formVariations
      .map((variation) => ({
        ...variation,
        name: variation.name.trim(),
        description: variation.description.trim(),
        price: Number(variation.price),
        commissionBonusAmount: optionalPositiveNumber(variation.commissionBonusAmount),
        commissionBonusPercent: optionalPositiveNumber(variation.commissionBonusPercent),
        timeEstimate: Number(variation.timeEstimate),
        compatibilities: variation.compatibilities.filter((compatibility) => ALLOWED_CAR_MODELS.includes(compatibility.model)),
      }))
      .filter((variation) => variation.name);

    const variationNames = cleanedVariations.map((variation) => normalizeText(variation.name));
    if (cleanedVariations.length === 0 || cleanedVariations.some((variation) => variation.price <= 0)) {
      showAlert('Variações obrigatórias', 'Cadastre pelo menos uma variação com nome e preço válido.');
      return;
    }
    if (new Set(variationNames).size !== variationNames.length) {
      showAlert('Variação duplicada', 'A mesma variação não pode aparecer duas vezes dentro do produto.');
      return;
    }
    if (cleanedVariations.some((variation) => variation.compatibilities.length === 0)) {
      showAlert('Compatibilidade obrigatória', 'Cada variação deve estar vinculada a Tiggo 5, Tiggo 7 ou Tiggo 8.');
      return;
    }

    const payload: Omit<Product, 'id'> = {
      name,
      description: formDescription.trim(),
      category: formCategory,
      imageUrl: formImageUrl || undefined,
      compatibilities: unionCompatibilities(cleanedVariations),
      universal: false,
      active: formActive,
      variations: cleanedVariations,
    };

    if (editingId) updateProduct(editingId, payload);
    else addProduct(payload);
    setIsFormOpen(false);
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in relative font-sans text-slate-800">
      <MobilePageHeader
        title="Catálogo"
        description="Produtos, variações e compatibilidade por carro."
        actionLabel="Cadastrar produto"
        actionIcon={<Plus className="h-4 w-4" />}
        onAction={openCreateForm}
      />

      <div className="hidden md:flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-[#002C5F] uppercase">Catálogo de Produtos</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Produto principal, variações e compatibilidade restrita a Tiggo 5, Tiggo 7 e Tiggo 8.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openCatalogChecklistPrint}
            className={`flex items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-bold uppercase tracking-wide ${
              canPrintCatalogChecklist
                ? 'border-blue-100 bg-blue-50 text-[#002C5F] hover:bg-blue-100'
                : 'border-slate-200 bg-slate-50 text-slate-400'
            }`}
          >
            <Printer className="w-4 h-4" /> Imprimir checklist do carro
          </button>
          <button
            onClick={openCreateForm}
            className="bg-[#002C5F] hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md uppercase tracking-wide"
          >
            <Plus className="w-4 h-4" /> Cadastrar Produto
          </button>
        </div>
      </div>

      <div className="md:hidden space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative">
          <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar produto ou variação..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold text-slate-700 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowMobileFilters(true)}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 text-xs font-black uppercase tracking-wide text-[#002C5F]"
        >
          <Filter className="h-4 w-4" />
          {activeSelectedCategory === 'Todos' ? 'Todas categorias' : activeSelectedCategory} · {selectedModel === 'Todos' ? 'Todos modelos' : selectedModel}
          {selectedVersion !== 'Todos' ? ` · ${selectedVersion}` : ''}
          {selectedYear !== 'Todos' ? ` · ${selectedYear}` : ''}
        </button>
        <button
          type="button"
          onClick={openCatalogChecklistPrint}
          className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border text-xs font-black uppercase tracking-wide ${
            canPrintCatalogChecklist ? 'border-slate-200 bg-white text-slate-700' : 'border-slate-200 bg-slate-50 text-slate-400'
          }`}
        >
          <Printer className="h-4 w-4" />
          Imprimir checklist do carro
        </button>
      </div>

      <MobileFilterSheet title="Filtros do catálogo" open={showMobileFilters} onClose={() => setShowMobileFilters(false)}>
        <div className="space-y-4">
          <label className="space-y-2 text-xs font-black uppercase tracking-wide text-slate-500">
            <span>Categoria</span>
            <select
              value={activeSelectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold normal-case tracking-normal text-slate-700"
            >
              <option value="Todos">Todas Categorias</option>
              {categoryFilterOptions.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-xs font-black uppercase tracking-wide text-slate-500">
            <span>Carro</span>
            <select
              value={selectedModel}
              onChange={(event) => handleCatalogModelChange(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold normal-case tracking-normal text-slate-700"
            >
              <option value="Todos">Todos os modelos</option>
              {ALLOWED_CAR_MODELS.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-xs font-black uppercase tracking-wide text-slate-500">
            <span>Versão</span>
            <select
              value={selectedVersion}
              onChange={(event) => handleCatalogVersionChange(event.target.value)}
              disabled={selectedModel === 'Todos'}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold normal-case tracking-normal text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="Todos">Todas as versões</option>
              {catalogVersionOptions.map((version) => <option key={version.name} value={version.name}>{version.name}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-xs font-black uppercase tracking-wide text-slate-500">
            <span>Ano</span>
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              disabled={selectedVersion === 'Todos'}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold normal-case tracking-normal text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="Todos">Todos os anos</option>
              {catalogYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
        </div>
      </MobileFilterSheet>

      <div className="hidden md:grid bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid-cols-1 xl:grid-cols-[1fr_160px_130px_220px_110px] gap-4 items-center">
        <div className="relative">
          <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar produto ou variação..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-slate-700"
          />
        </div>
        <select
          value={activeSelectedCategory}
          onChange={(event) => setSelectedCategory(event.target.value)}
          className="text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-slate-700 font-bold"
        >
          <option value="Todos">Todas Categorias</option>
          {categoryFilterOptions.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <select
          value={selectedModel}
          onChange={(event) => handleCatalogModelChange(event.target.value)}
          className="text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-slate-700 font-bold"
        >
          <option value="Todos">Todos os modelos</option>
          {ALLOWED_CAR_MODELS.map((model) => <option key={model} value={model}>{model}</option>)}
        </select>
        <select
          value={selectedVersion}
          onChange={(event) => handleCatalogVersionChange(event.target.value)}
          disabled={selectedModel === 'Todos'}
          className="text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-slate-700 font-bold disabled:text-slate-400"
        >
          <option value="Todos">Todas as Versões</option>
          {catalogVersionOptions.map((version) => <option key={version.name} value={version.name}>{version.name}</option>)}
        </select>
        <select
          value={selectedYear}
          onChange={(event) => setSelectedYear(event.target.value)}
          disabled={selectedVersion === 'Todos'}
          className="text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-slate-700 font-bold disabled:text-slate-400"
        >
          <option value="Todos">Todos os Anos</option>
          {catalogYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredProducts.length > 0 ? (
          <div className="divide-y divide-slate-100 text-xs">
            {filteredProducts.map((product) => (
              <article key={product.id} className="p-4 hover:bg-slate-50/70">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-black uppercase leading-snug tracking-tight text-slate-800">{product.name}</h3>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{product.category}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${product.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                        {product.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    {product.description && <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-400">{product.description}</p>}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {product.compatibilities.map((compatibility) => (
                        <span key={compatibility.model} className="rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#002C5F]">
                          {compatibility.model}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => openEditForm(products.find((candidate) => candidate.id === product.id) || product)}
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100"
                      title="Editar"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => showConfirm('Arquivar Produto', `Arquivar "${product.name}" do catálogo ativo?`, () => deleteProduct(product.id))}
                      className="rounded-xl border border-rose-100 bg-rose-50 p-2 text-rose-600 hover:bg-rose-100"
                      title="Arquivar"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {product.variations.map((variation) => (
                    <div key={variation.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-800">{variation.name}</div>
                          <div className="mt-1 font-mono text-xs font-black text-slate-700">
                            {variation.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                        </div>
                        <span className="font-mono text-[10px] font-bold text-slate-400">{variation.timeEstimate}m</span>
                      </div>
                      {(variation.commissionBonusAmount || variation.commissionBonusPercent) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {variation.commissionBonusAmount ? (
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-100">
                              + {variation.commissionBonusAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          ) : null}
                          {variation.commissionBonusPercent ? (
                            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-[#002C5F] border border-blue-100">
                              + {variation.commissionBonusPercent}% comissão
                            </span>
                          ) : null}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {variation.compatibilities.map((compatibility) => (
                          <span key={compatibility.model} className="rounded bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-500 border border-slate-200">
                            {compatibility.model}
                          </span>
                        ))}
                        {isSolarFilmCategory(product.category) && getSolarFilmBadges(variation).map((badge) => (
                          <span key={badge} className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-[#002C5F] border border-blue-100">
                            {badge}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 font-bold">Nenhum produto encontrado.</div>
        )}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-start md:items-center justify-center p-0 md:p-4 z-[70] animate-fade-in text-slate-800 overflow-y-auto">
          <div className="bg-white rounded-none md:rounded-2xl max-w-3xl w-full h-[100dvh] md:h-auto p-4 md:p-6 shadow-xl border border-slate-200 space-y-4 md:my-8 max-h-[100dvh] md:max-h-[95vh] flex flex-col">
            <div className="sticky top-0 z-20 -mx-4 -mt-4 bg-white px-4 pt-4 md:static md:m-0 md:p-0">
              <h3 className="text-base md:text-lg font-bold text-slate-800 uppercase tracking-tight pb-3 border-b border-slate-100 flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#002C5F]" />
                {editingId ? 'Editar Produto' : 'Cadastrar Produto'}
              </h3>
            </div>
            <form onSubmit={saveForm} className="space-y-4 text-xs overflow-y-auto flex-1 pr-1 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Produto principal *</label>
                  <input value={formName} onChange={(event) => setFormName(event.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none text-xs text-slate-700 font-medium" placeholder="Ex. Película Automotiva" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-700">Categoria *</label>
                    <button
                      type="button"
                      onClick={() => setIsAddingCategory((current) => !current)}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#002C5F] hover:bg-blue-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nova
                    </button>
                  </div>
                  <select value={formCategory} onChange={(event) => setFormCategory(event.target.value)} className="w-full p-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none text-xs text-slate-700 font-bold">
                    {productCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                  {isAddingCategory && (
                    <div className="flex gap-1.5">
                      <input
                        value={newCategoryName}
                        onChange={(event) => setNewCategoryName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleAddCategoryFromForm();
                          }
                        }}
                        placeholder="Ex. Performance"
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-medium text-slate-700 focus:outline-none focus:border-slate-400"
                      />
                      <button
                        type="button"
                        onClick={handleAddCategoryFromForm}
                        className="rounded-lg bg-[#002C5F] p-1.5 text-white hover:bg-slate-800"
                        title="Adicionar categoria"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Descrição do produto</label>
                <textarea value={formDescription} onChange={(event) => setFormDescription(event.target.value)} rows={2} className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none text-xs text-slate-700" />
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-widest text-[#002C5F]">Variações</div>
                  <button type="button" onClick={() => setFormVariations((current) => [...current, emptyVariation()])} className="rounded-lg bg-[#002C5F] px-3 py-1.5 text-[10px] font-bold uppercase text-white">
                    Adicionar variação
                  </button>
                </div>

                {formVariations.map((variation, index) => (
                  <div key={variation.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Variação {index + 1}</span>
                      {formVariations.length > 1 && (
                        <button type="button" onClick={() => setFormVariations((current) => current.filter((item) => item.id !== variation.id))} className="text-rose-600">
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px] gap-3">
                      <input value={variation.name} onChange={(event) => updateVariation(variation.id, { name: event.target.value })} placeholder="G20, Antivandalismo, Nanocerâmica..." className="p-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700" />
                      <input type="number" step="0.01" value={variation.price || ''} onChange={(event) => updateVariation(variation.id, { price: Number(event.target.value) })} placeholder="Preço" className="p-2.5 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700" />
                      <input type="number" value={variation.timeEstimate || ''} onChange={(event) => updateVariation(variation.id, { timeEstimate: Number(event.target.value) })} placeholder="Minutos" className="p-2.5 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="space-y-1">
                        <span className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                          Comissão extra R$
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={variation.commissionBonusAmount ?? ''}
                          onChange={(event) => updateVariation(variation.id, { commissionBonusAmount: event.target.value === '' ? undefined : Number(event.target.value) })}
                          placeholder="Ex.: 50,00"
                          className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-700 focus:outline-none focus:border-[#002C5F]"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                          Comissão extra %
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.1"
                          value={variation.commissionBonusPercent ?? ''}
                          onChange={(event) => updateVariation(variation.id, { commissionBonusPercent: event.target.value === '' ? undefined : Number(event.target.value) })}
                          placeholder="Ex.: 2,5"
                          className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-700 focus:outline-none focus:border-[#002C5F]"
                        />
                      </label>
                    </div>
                    <textarea value={variation.description} onChange={(event) => updateVariation(variation.id, { description: event.target.value })} rows={2} placeholder="Descrição específica da variação" className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-700" />
                    {showSolarFilmFields && formCategoryFields.length > 0 && (
                      <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#002C5F]">
                          Índices técnicos da película
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {formCategoryFields.map((field) => (
                            <label key={`${variation.id}-${field.key}`} className="space-y-1">
                              <span className="block text-[10px] font-black uppercase tracking-wide text-slate-600">
                                {field.label}
                              </span>
                              <div className="relative">
                                <input
                                  type={field.type}
                                  min={field.min}
                                  max={field.max}
                                  step={field.step}
                                  value={getAttributeInputValue(variation, field)}
                                  onChange={(event) => handleVariationAttributeChange(variation.id, field, event.target.value)}
                                  placeholder={field.placeholder}
                                  className={`w-full rounded-lg border border-blue-100 bg-white px-2 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#002C5F] ${
                                    field.suffix ? 'pr-8' : ''
                                  }`}
                                />
                                {field.suffix && (
                                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
                                    {field.suffix}
                                  </span>
                                )}
                              </div>
                            </label>
                          ))}
                          <label className="space-y-1">
                            <span className="block text-[10px] font-black uppercase tracking-wide text-slate-600">
                              Redução de ofuscamento
                            </span>
                            <div className="relative">
                              <input
                                type="number"
                                min={0}
                                max={99}
                                step={1}
                                value={getGlareReduction(variation)}
                                onChange={(event) => handleGlareReductionChange(variation.id, event.target.value)}
                                placeholder="80"
                                className="w-full rounded-lg border border-blue-100 bg-white px-2 py-2 pr-8 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#002C5F]"
                              />
                              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
                                %
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>
                    )}
                    <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#002C5F]">
                          Compatibilidade por modelo, versão e ano
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-bold text-slate-500">
                          {variation.compatibilities.length} regra(s)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleAllModelsCompatibility(variation)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white px-3 py-2 text-left hover:bg-blue-50/50"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            isAllModelsChecked(variation)
                              ? 'border-[#002C5F] bg-[#002C5F] text-white'
                              : isAllModelsIndeterminate(variation)
                                ? 'border-[#002C5F] bg-blue-50 text-[#002C5F]'
                                : 'border-slate-300 bg-white'
                          }`}>
                            {isAllModelsChecked(variation) ? <Check className="h-3 w-3 stroke-[3.5]" /> : isAllModelsIndeterminate(variation) ? <span className="h-0.5 w-2 rounded bg-[#002C5F]" /> : null}
                          </span>
                          <span className="truncate text-xs font-black uppercase tracking-tight text-[#002C5F]">
                            Todos os modelos
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] font-bold text-slate-400">
                          todas versões e anos
                        </span>
                      </button>

                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {catalogCarModels.map((model) => {
                          const modelChecked = isModelChecked(variation, model.name);
                          const modelIndeterminate = isModelIndeterminate(variation, model);
                          const expandedKey = `${variation.id}:${model.id}`;
                          const isExpanded = expandedCompatibilityModels[expandedKey] ?? false;

                          return (
                            <div key={model.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                              <div className="flex items-center justify-between gap-2 bg-slate-100/70 px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => toggleModelCompatibility(variation, model.name)}
                                  className="flex min-w-0 items-center gap-2 text-left"
                                >
                                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                    modelChecked
                                      ? 'border-[#002C5F] bg-[#002C5F] text-white'
                                      : modelIndeterminate
                                        ? 'border-[#002C5F] bg-blue-50 text-[#002C5F]'
                                        : 'border-slate-300 bg-white'
                                  }`}>
                                    {modelChecked ? <Check className="h-3 w-3 stroke-[3.5]" /> : modelIndeterminate ? <span className="h-0.5 w-2 rounded bg-[#002C5F]" /> : null}
                                  </span>
                                  <span className="truncate text-xs font-black uppercase tracking-tight text-slate-800">
                                    {model.name}
                                  </span>
                                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                    Todas as versões
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExpandedCompatibilityModels((current) => ({ ...current, [expandedKey]: !isExpanded }))}
                                  className="rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                                >
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                              </div>

                              {isExpanded && (
                                <div className="divide-y divide-slate-100 border-t border-slate-200 bg-white px-3 py-1">
                                  {model.versions.map((version) => {
                                    const versionChecked = isVersionChecked(variation, model.name, version.name);
                                    const versionIndeterminate = isVersionIndeterminate(variation, model.name, version.name, version.years);

                                    return (
                                      <div key={version.name} className="py-2.5">
                                        <button
                                          type="button"
                                          onClick={() => toggleVersionCompatibility(variation, model.name, version.name)}
                                          className="flex items-center gap-2 text-left"
                                        >
                                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                            versionChecked
                                              ? 'border-[#002C5F] bg-[#002C5F] text-white'
                                              : versionIndeterminate
                                                ? 'border-[#002C5F] bg-blue-50 text-[#002C5F]'
                                                : 'border-slate-300 bg-white'
                                          }`}>
                                            {versionChecked ? <Check className="h-3 w-3 stroke-[3.5]" /> : versionIndeterminate ? <span className="h-0.5 w-2 rounded bg-[#002C5F]" /> : null}
                                          </span>
                                          <span className="text-xs font-bold text-slate-700">
                                            {version.name}
                                            <span className="ml-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
                                              Todos os anos
                                            </span>
                                          </span>
                                        </button>

                                        <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
                                          {version.years.map((year) => {
                                            const checked = isYearChecked(variation, model.name, version.name, year);

                                            return (
                                              <button
                                                key={year}
                                                type="button"
                                                onClick={() => toggleYearCompatibility(variation, model.name, version.name, year)}
                                                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold ${
                                                  checked
                                                    ? 'border-blue-200 bg-blue-50 text-[#002C5F]'
                                                    : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600'
                                                }`}
                                              >
                                                <span className={`flex h-3 w-3 items-center justify-center rounded-sm border ${
                                                  checked ? 'border-[#002C5F] bg-[#002C5F] text-white' : 'border-slate-300 bg-white'
                                                }`}>
                                                  {checked && <Check className="h-2.5 w-2.5 stroke-[4]" />}
                                                </span>
                                                {year}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {variation.compatibilities.map((compatibility) => (
                          <span
                            key={formatCompatibility(compatibility)}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-bold text-[#002C5F]"
                          >
                            <Check className="h-3 w-3" />
                            {formatCompatibility(compatibility)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <input type="checkbox" checked={formActive} onChange={(event) => setFormActive(event.target.checked)} className="rounded text-[#002C5F] border-slate-300 w-4 h-4" />
                Produto ativo para vendas
              </label>

              <div className="sticky bottom-0 -mx-1 flex justify-end gap-2 border-t border-slate-100 bg-white/95 px-1 pt-4 pb-2 backdrop-blur">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl text-xs font-bold bg-[#002C5F] text-white hover:bg-slate-800">
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isChecklistPrintOpen && (
        <AccessoryChecklistPrint
          pages={checklistPages}
          dealerName={settings.dealerName}
          onClose={() => setIsChecklistPrintOpen(false)}
        />
      )}
    </div>
  );
}
