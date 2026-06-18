import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { AlertCircle, HelpCircle } from 'lucide-react';
import {
  Accessory,
  Product,
  Sale,
  SaleItem,
  Followup,
  SaleEvent,
  Settings,
  SalesStatus,
  FollowupStatus,
  FollowupType,
  CommissionStatus,
  CarVersion,
  CarModel,
  CRMExportPayload,
  CRMExportSection,
} from '../types';
import {
  ALLOWED_CAR_MODELS,
  INITIAL_ACCESSORIES,
  INITIAL_PRODUCTS,
  flattenProductsToAccessories,
  isAllowedVehicleModel,
  isVehicleCompatible,
  normalizeVehicleModel,
} from '../data/accessories';
import {
  DEFAULT_SETTINGS,
  INITIAL_SALES,
  INITIAL_SALE_ITEMS,
  INITIAL_FOLLOWUPS,
  INITIAL_EVENTS,
} from '../data/seeds';
import { calculateSaleCommission, getMonthlyOpportunityCount, getMonthlyVolumeBeforeSale, getSaleMonthKey } from '../utils/commissions';
import { coerceSalesStatus } from '../utils/saleStatus';

export function isAccessoryCompatible(
  acc: Accessory,
  carModel: string | undefined,
  carVersion?: string,
  carYear?: string
): boolean {
  if (acc.universal) return true;
  const normalizedCarModel = normalizeVehicleModel(carModel);
  if (!normalizedCarModel) return false;

  // 1. Check if the accessory is compatible with any individual selected combination
  if (acc.compatibilities && acc.compatibilities.length > 0) {
    const hasMatch = acc.compatibilities.some((comp) => {
      const parts = comp.split('|');
      const compModel = parts[0];
      const compVersion = parts[1];
      const compYear = parts[2];

      const normalizedCompModel = normalizeVehicleModel(compModel);
      if (normalizedCompModel !== normalizedCarModel) return false;
      // If version is provided, they must match (unless the compatibility doesn't restrict version)
      if (compVersion && carVersion && compVersion !== carVersion) return false;
      // If year is provided, they must match (unless the compatibility doesn't restrict year)
      if (compYear && carYear && compYear !== carYear) return false;
      
      return true;
    });
    if (hasMatch) return true;
  }

  // 2. Fallback to older cascading fields for backward compatibility
  if (acc.compatibleModel) {
    if (normalizeVehicleModel(acc.compatibleModel) !== normalizedCarModel) return false;
    if (acc.compatibleVersion) {
      if (carVersion && acc.compatibleVersion !== carVersion) return false;
      if (acc.compatibleYear) {
        if (carYear && acc.compatibleYear !== carYear) return false;
      }
    }
    return true;
  }

  // 3. Fallback to older simple model list
  if (acc.compatibilities?.some((compatibility) => normalizeVehicleModel(compatibility) === normalizedCarModel)) {
    return true;
  }

  return false;
}

export const INITIAL_CAR_MODELS: CarModel[] = [
  {
    id: "m_1",
    name: "Tiggo 5",
    versions: [
      { name: "Geral", years: ["2025", "2026", "2027"] }
    ]
  },
  {
    id: "m_2",
    name: "Tiggo 7",
    versions: [
      { name: "SPORT/ PRO MAX DRIVE/ PRO HYBRID MAX DRIVE/ PRO PLUG-IN HYBRID", years: ["2025", "2026"] }
    ]
  },
  {
    id: "m_3",
    name: "Tiggo 8",
    versions: [
      { name: "PRO/ PRO PLUG-IN HYBRID", years: ["2025", "2026"] }
    ]
  }
];

// Helper to get formatted dates relative to June 17, 2026
export const getSimulatedToday = (): string => '2026-06-17';

export const getOffsetDate = (days: number): string => {
  const baseDate = new Date('2026-06-17T12:00:00');
  baseDate.setDate(baseDate.getDate() + days);
  return baseDate.toISOString().split('T')[0];
};

export const getNextBusinessDay = (): string => {
  const baseDate = new Date('2026-06-17T12:00:00');
  const dayOfWeek = baseDate.getDay(); // 0 is Sunday, 6 is Saturday
  let offset = 1;
  if (dayOfWeek === 5) {
    // Friday -> Monday
    offset = 3;
  } else if (dayOfWeek === 6) {
    // Saturday -> Monday
    offset = 2;
  }
  baseDate.setDate(baseDate.getDate() + offset);
  return baseDate.toISOString().split('T')[0];
};

interface CRMContextType {
  accessories: Accessory[];
  products: Product[];
  sales: Sale[];
  saleItems: SaleItem[];
  followups: Followup[];
  events: SaleEvent[];
  settings: Settings;
  currentUser: string;
  carModels: CarModel[];
  saveCarModels: (models: CarModel[]) => void;
  updateSettings: (newSettings: Partial<Settings>) => void;
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addAccessory: (acc: Omit<Accessory, 'id'>) => void;
  updateAccessory: (id: string, acc: Partial<Accessory>) => void;
  deleteAccessory: (id: string) => void;
  createSale: (saleData: Omit<Sale, 'id' | 'createdAt' | 'commissionPercent' | 'commissionAmount' | 'commissionStatus' | 'commissionPaidAt'>, items: Omit<SaleItem, 'id' | 'saleId'>[]) => string;
  updateSaleDetails: (saleId: string, saleData: Partial<Sale>, items?: Omit<SaleItem, 'id' | 'saleId'>[]) => void;
  updateSaleStatus: (saleId: string, newStatus: SalesStatus, lostReason?: string) => void;
  deleteSale: (saleId: string) => void;
  markCommissionReceived: (saleId: string) => void;
  addFollowup: (followupData: Omit<Followup, 'id' | 'createdAt'>) => void;
  updateFollowupStatus: (id: string, newStatus: FollowupStatus, notes?: string) => void;
  remarcalFollowup: (id: string, newDate: string, notes?: string) => void;
  addManualEvent: (saleId: string, type: string, description: string) => void;
  exportCRMData: (sections: CRMExportSection[]) => CRMExportPayload;
  importCRMData: (payload: CRMExportPayload, sections: CRMExportSection[]) => {
    importedSections: CRMExportSection[];
    skippedSections: CRMExportSection[];
  };
  clearProducts: () => void;
  clearSalesData: () => void;
  resetDatabase: () => void;
  showAlert: (title: string, message: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);
const ACCESSORY_CATALOG_VERSION = '2026-06-18-tiggo-products-variations-v1';

const normalizeSaleRecord = (sale: Sale): Sale => ({
  ...sale,
  carModel: normalizeVehicleModel(sale.carModel) || sale.carModel,
  status: coerceSalesStatus(sale.status),
  paymentStatus: sale.paymentStatus || 'Não paga',
  paymentForecastDate: sale.paymentForecastDate || '',
  partialPaidAmount: sale.partialPaidAmount ?? 0,
  installationStatus: sale.installationStatus || (sale.installationDate ? 'Agendada' : 'Sem data definida'),
  installationNotes: sale.installationNotes || '',
});

const TRACKED_SALE_FIELDS: Array<{ key: keyof Sale; label: string }> = [
  { key: 'installationDate', label: 'Data prevista de instalação' },
  { key: 'installationStatus', label: 'Status da instalação' },
  { key: 'paymentStatus', label: 'Status de pagamento' },
  { key: 'paymentForecastDate', label: 'Previsão de pagamento' },
  { key: 'partialPaidAmount', label: 'Valor pago parcialmente' },
  { key: 'installerName', label: 'Responsável pela instalação' },
  { key: 'installationNotes', label: 'Observações de instalação' },
];

const formatTrackedValue = (value: unknown) => {
  if (value === undefined || value === null || value === '') return 'Sem valor';
  if (typeof value === 'number') return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return String(value);
};
const SOLAR_FILM_TINT_COLOR = '#000000';

const normalizeSolarFilmTintColor = <T extends Pick<Accessory, 'category' | 'attributes'>>(accessory: T): T => {
  if (accessory.category !== 'Película Solar') return accessory;

  return {
    ...accessory,
    attributes: {
      ...(accessory.attributes || {}),
      tintColor: SOLAR_FILM_TINT_COLOR,
    },
  };
};

const normalizeSolarFilmTintColors = (list: Accessory[]): Accessory[] => list.map(normalizeSolarFilmTintColor);

const sanitizeProducts = (list: Product[]): Product[] =>
  list
    .map((product) => {
      const productCompatibilities = product.compatibilities
        .map((compatibility) => ({ ...compatibility, model: normalizeVehicleModel(compatibility.model) || compatibility.model }))
        .filter((compatibility) => isAllowedVehicleModel(compatibility.model));
      const variations = product.variations
        .map((variation) => ({
          ...variation,
          compatibilities: variation.compatibilities
            .map((compatibility) => ({ ...compatibility, model: normalizeVehicleModel(compatibility.model) || compatibility.model }))
            .filter((compatibility) => isAllowedVehicleModel(compatibility.model)),
        }))
        .filter((variation) => product.universal || variation.compatibilities.length > 0);

      return {
        ...product,
        compatibilities: productCompatibilities,
        variations,
      };
    })
    .filter((product) => product.universal || product.compatibilities.length > 0)
    .filter((product) => product.variations.length > 0);

const toProductAccessories = (list: Product[]) => normalizeSolarFilmTintColors(flattenProductsToAccessories(sanitizeProducts(list)));

export function CRMProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [events, setEvents] = useState<SaleEvent[]>([]);
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [carModels, setCarModels] = useState<CarModel[]>([]);
  const [remoteReady, setRemoteReady] = useState(false);
  const syncTimerRef = useRef<number | null>(null);
  const lastSyncedSnapshotRef = useRef('');
  const currentUser = 'Thayná';

  // State for Alert/Confirm modals
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: (() => void) | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  const showAlert = (title: string, message: string) => {
    setAlertState({
      isOpen: true,
      title,
      message,
    });
  };

  const showConfirm = (title: string, message: string, onConfirmAction: () => void) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirmAction();
        setConfirmState((prev) => ({ ...prev, isOpen: false, onConfirm: null }));
      },
    });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, isOpen: false }));
  };

  const closeConfirm = () => {
    setConfirmState((prev) => ({ ...prev, isOpen: false, onConfirm: null }));
  };

  const applyRemoteSnapshot = (data: Partial<CRMExportPayload['data'] & { accessories: Accessory[] }>) => {
    const nextProducts = sanitizeProducts(Array.isArray(data.products) ? data.products : INITIAL_PRODUCTS);
    const nextAccessories = Array.isArray(data.accessories)
      ? normalizeSolarFilmTintColors(data.accessories)
      : toProductAccessories(nextProducts);
    setProducts(nextProducts);
    setAccessories(nextAccessories);
    setSaleItems(Array.isArray(data.saleItems) ? data.saleItems : INITIAL_SALE_ITEMS);
    setFollowups(Array.isArray(data.followups) ? data.followups : INITIAL_FOLLOWUPS);
    setEvents(Array.isArray(data.events) ? data.events : INITIAL_EVENTS);
    setSettings({ ...DEFAULT_SETTINGS, ...(data.settings || {}) });
    setCarModels(Array.isArray(data.carModels) ? data.carModels : INITIAL_CAR_MODELS);
    setSales(Array.isArray(data.sales) ? data.sales.map(normalizeSaleRecord) : INITIAL_SALES);
  };

  // Load from LocalStorage or initialize with seed data
  useEffect(() => {
    const storedProducts = localStorage.getItem('crm_products');
    const storedAccessories = localStorage.getItem('crm_accessories');
    const storedSales = localStorage.getItem('crm_sales');
    const storedSaleItems = localStorage.getItem('crm_sale_items');
    const storedFollowups = localStorage.getItem('crm_followups');
    const storedEvents = localStorage.getItem('crm_events');
    const storedSettings = localStorage.getItem('crm_settings');
    const storedCarModels = localStorage.getItem('crm_car_models');
    const storedAccessoryCatalogVersion = localStorage.getItem('crm_accessory_catalog_version');
    let loadedProducts: Product[] = storedProducts ? JSON.parse(storedProducts) : INITIAL_PRODUCTS;
    let loadedAccessories: Accessory[] = storedAccessories ? JSON.parse(storedAccessories) : INITIAL_ACCESSORIES;
    const hasOutdatedSolarFilmData = loadedAccessories.some((accessory) => {
      const isSolarFilm = accessory.name.toUpperCase().includes('PELICULA SOLAR');
      const hasSolarSpecs =
        accessory.attributes?.visibleLightTransmission !== undefined &&
        accessory.attributes?.uvProtection !== undefined &&
        accessory.attributes?.heatRejection !== undefined &&
        accessory.attributes?.infraredRejection !== undefined;
      return isSolarFilm && (accessory.category !== 'Película Solar' || !hasSolarSpecs);
    });
    const shouldRefreshAccessories =
      !storedProducts ||
      !storedAccessories ||
      storedAccessoryCatalogVersion !== ACCESSORY_CATALOG_VERSION ||
      !loadedProducts.every((product) => product.compatibilities.every((compatibility) => isAllowedVehicleModel(compatibility.model))) ||
      loadedProducts.some((product) => product.variations.some((variation) => variation.price <= 0)) ||
      hasOutdatedSolarFilmData;
    let loadedSaleItems: SaleItem[] = storedSaleItems ? JSON.parse(storedSaleItems) : INITIAL_SALE_ITEMS;
    let loadedSales: Sale[] = storedSales ? JSON.parse(storedSales) : INITIAL_SALES;
    let loadedFollowups: Followup[] = storedFollowups ? JSON.parse(storedFollowups) : INITIAL_FOLLOWUPS;
    let loadedEvents: SaleEvent[] = storedEvents ? JSON.parse(storedEvents) : INITIAL_EVENTS;
    let activeSettings: Settings = { ...DEFAULT_SETTINGS };

    const normalizedLoadedSales = loadedSales.map(normalizeSaleRecord);
    if (JSON.stringify(normalizedLoadedSales) !== JSON.stringify(loadedSales)) {
      loadedSales = normalizedLoadedSales;
      localStorage.setItem('crm_sales', JSON.stringify(loadedSales));
    }

    if (shouldRefreshAccessories) {
      loadedProducts = INITIAL_PRODUCTS;
      loadedAccessories = flattenProductsToAccessories(loadedProducts);
    } else {
      loadedProducts = sanitizeProducts(loadedProducts);
      loadedAccessories = flattenProductsToAccessories(loadedProducts);
    }
    loadedAccessories = normalizeSolarFilmTintColors(loadedAccessories);
    setProducts(loadedProducts);
    setAccessories(loadedAccessories);
    localStorage.setItem('crm_products', JSON.stringify(loadedProducts));
    localStorage.setItem('crm_accessories', JSON.stringify(loadedAccessories));
    localStorage.setItem('crm_accessory_catalog_version', ACCESSORY_CATALOG_VERSION);

    setSaleItems(loadedSaleItems);
    setFollowups(loadedFollowups);
    setEvents(loadedEvents);
    localStorage.setItem('crm_sale_items', JSON.stringify(loadedSaleItems));
    localStorage.setItem('crm_followups', JSON.stringify(loadedFollowups));
    localStorage.setItem('crm_events', JSON.stringify(loadedEvents));

    if (storedSettings) {
      const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) };
      let shouldPersistSettings = false;
      if (parsed.commissionPlanVersion !== 2) {
        parsed.commissionPercent = 1.7;
        parsed.targetPerClient = 2000;
        parsed.monthlyStoreCarsSold = undefined;
        parsed.monthlyTargetAmount = undefined;
        parsed.goalBonusAmount = 0;
        parsed.goalExtraCommissionPercent = 0.5;
        parsed.commissionPlanVersion = 2;
        shouldPersistSettings = true;
      }
      if (
        shouldPersistSettings ||
        parsed.targetPerClient === undefined ||
        parsed.goalBonusAmount === undefined ||
        parsed.goalExtraCommissionPercent === undefined ||
        parsed.commissionPlanVersion === undefined
      ) {
        localStorage.setItem('crm_settings', JSON.stringify(parsed));
      }
      activeSettings = parsed;
      setSettings(parsed);
    } else {
      const initialSettings = { ...DEFAULT_SETTINGS };
      activeSettings = initialSettings;
      setSettings(initialSettings);
      localStorage.setItem('crm_settings', JSON.stringify(initialSettings));
    }

    const recalculatedSales = loadedSales.map((sale) => {
      const items = loadedSaleItems.filter((item) => item.saleId === sale.id);
      const breakdown = calculateSaleCommission({
        saleTotal: sale.total,
        commissionPercent: activeSettings.commissionPercent,
        items,
        accessories: loadedAccessories,
        settings: activeSettings,
        monthlyVolumeBeforeSale: getMonthlyVolumeBeforeSale(loadedSales, sale.id, sale.total, sale.createdAt),
        monthlyOpportunityCount: getMonthlyOpportunityCount(loadedSales, getSaleMonthKey(sale.createdAt)),
      });
      return {
        ...sale,
        commissionPercent: activeSettings.commissionPercent,
        baseCommissionAmount: breakdown.baseAmount,
        productBonusAmount: breakdown.productBonusAmount,
        goalExtraAmount: breakdown.goalExtraAmount,
        goalBonusAmount: breakdown.goalBonusAmount,
        commissionAmount: sale.commissionStatus === 'Cancelado' ? sale.commissionAmount : breakdown.commissionAmount,
      };
    });
    setSales(recalculatedSales);
    localStorage.setItem('crm_sales', JSON.stringify(recalculatedSales));

    if (storedCarModels) {
      const parsedCarModels: CarModel[] = JSON.parse(storedCarModels);
      const shouldRefreshCarModels =
        !ALLOWED_CAR_MODELS.every((modelName) => parsedCarModels.some((model) => model.name === modelName));
      if (shouldRefreshCarModels) {
        const withCoreModels = [
          ...INITIAL_CAR_MODELS,
          ...parsedCarModels.filter((model) => !ALLOWED_CAR_MODELS.includes(model.name)),
        ];
        setCarModels(withCoreModels);
        localStorage.setItem('crm_car_models', JSON.stringify(withCoreModels));
      } else {
        setCarModels(parsedCarModels);
      }
    } else {
      setCarModels(INITIAL_CAR_MODELS);
      localStorage.setItem('crm_car_models', JSON.stringify(INITIAL_CAR_MODELS));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/bootstrap', { credentials: 'include' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.message || 'Falha ao carregar dados do servidor.');
        if (cancelled) return;
        applyRemoteSnapshot(result);
        setRemoteReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        setRemoteReady(false);
        showAlert(
          'Servidor indisponível',
          error instanceof Error ? error.message : 'Não foi possível carregar os dados do servidor.'
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync state to local storage helper
  const syncToLocalStorage = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  useEffect(() => {
    if (!remoteReady) return;
    const snapshot = {
      products,
      sales,
      saleItems,
      followups,
      events,
      settings,
      carModels,
    };
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSyncedSnapshotRef.current) return;
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      fetch('/api/state', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: serialized,
      })
        .then((response) => {
          if (!response.ok) throw new Error('Falha ao salvar dados no servidor.');
          lastSyncedSnapshotRef.current = serialized;
        })
        .catch((error) => {
          showAlert(
            'Sincronização pendente',
            error instanceof Error ? error.message : 'Os dados não foram salvos no servidor.'
          );
        });
    }, 500);

    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [remoteReady, products, sales, saleItems, followups, events, settings, carModels]);

  const sanitizeCarModels = (models: CarModel[]) => {
    const coreModels = INITIAL_CAR_MODELS.map((base) => {
      const incoming = models.find((model) => model.name === base.name);
      return incoming ? { ...incoming, id: base.id, name: base.name } : base;
    });
    const extraModels = models.filter((model) => !ALLOWED_CAR_MODELS.includes(model.name));
    return [...coreModels, ...extraModels];
  };

  const saveCarModels = (models: CarModel[]) => {
    const sanitized = sanitizeCarModels(models);
    setCarModels(sanitized);
    syncToLocalStorage('crm_car_models', sanitized);
  };

  const updateSettings = (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    syncToLocalStorage('crm_settings', updated);
  };

  const clearProducts = () => {
    setProducts([]);
    setAccessories([]);
    syncToLocalStorage('crm_products', []);
    syncToLocalStorage('crm_accessories', []);
    syncToLocalStorage('crm_accessory_catalog_version', ACCESSORY_CATALOG_VERSION);
  };

  const clearSalesData = () => {
    setSales([]);
    setSaleItems([]);
    setFollowups([]);
    setEvents([]);
    syncToLocalStorage('crm_sales', []);
    syncToLocalStorage('crm_sale_items', []);
    syncToLocalStorage('crm_followups', []);
    syncToLocalStorage('crm_events', []);
  };

  const resetDatabase = () => {
    setProducts([]);
    setAccessories([]);
    setSales(INITIAL_SALES);
    setSaleItems(INITIAL_SALE_ITEMS);
    setFollowups(INITIAL_FOLLOWUPS);
    setEvents(INITIAL_EVENTS);
    const initialSettings = { ...DEFAULT_SETTINGS };
    setSettings(initialSettings);
    setCarModels(INITIAL_CAR_MODELS);

    localStorage.setItem('crm_accessories', JSON.stringify([]));
    localStorage.setItem('crm_products', JSON.stringify([]));
    localStorage.setItem('crm_sales', JSON.stringify(INITIAL_SALES));
    localStorage.setItem('crm_sale_items', JSON.stringify(INITIAL_SALE_ITEMS));
    localStorage.setItem('crm_followups', JSON.stringify(INITIAL_FOLLOWUPS));
    localStorage.setItem('crm_events', JSON.stringify(INITIAL_EVENTS));
    localStorage.setItem('crm_settings', JSON.stringify(initialSettings));
    localStorage.setItem('crm_car_models', JSON.stringify(INITIAL_CAR_MODELS));
    localStorage.setItem('crm_accessory_catalog_version', ACCESSORY_CATALOG_VERSION);
  };

  // Helper to record a sale event
  const recordEvent = (
    saleId: string,
    type: string,
    description: string,
    currentEventsList: SaleEvent[],
    metadata?: Pick<SaleEvent, 'field' | 'previousValue' | 'nextValue' | 'changedBy'>
  ) => {
    const newEvent: SaleEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      saleId,
      type,
      description,
      createdAt: new Date().toISOString(),
      ...metadata,
    };
    const updated = [newEvent, ...currentEventsList];
    setEvents(updated);
    syncToLocalStorage('crm_events', updated);
    return updated;
  };

  // 1. Accessory management
  const persistProducts = (nextProducts: Product[]) => {
    const sanitizedProducts = sanitizeProducts(nextProducts);
    const nextAccessories = toProductAccessories(sanitizedProducts);
    setProducts(sanitizedProducts);
    setAccessories(nextAccessories);
    syncToLocalStorage('crm_products', sanitizedProducts);
    syncToLocalStorage('crm_accessories', nextAccessories);
  };

  const addProduct = (product: Omit<Product, 'id'>) => {
    const newProduct: Product = {
      ...product,
      id: `prod_${Date.now()}`,
      variations: product.variations.map((variation, index) => ({
        ...variation,
        id: variation.id || `var_${Date.now()}_${index}`,
      })),
    };
    persistProducts([...products, newProduct]);
  };

  const updateProduct = (id: string, updatedProduct: Partial<Product>) => {
    persistProducts(products.map((product) => (product.id === id ? { ...product, ...updatedProduct } : product)));
  };

  const deleteProduct = (id: string) => {
    persistProducts(products.map((product) => (product.id === id ? { ...product, active: false } : product)));
  };

  const addAccessory = (acc: Omit<Accessory, 'id'>) => {
    const productId = `prod_${Date.now()}`;
    const variationId = `${productId}_var_padrao`;
    const newProduct: Product = {
      id: productId,
      name: acc.name,
      description: acc.description,
      category: acc.category,
      imageUrl: acc.imageUrl,
      attributes: acc.attributes,
      compatibilities: (acc.compatibilities || [])
        .map((entry) => ({ model: entry.split('|')[0], version: entry.split('|')[1], year: entry.split('|')[2] }))
        .filter((compatibility) => isAllowedVehicleModel(compatibility.model)),
      universal: acc.universal,
      active: acc.active,
      variations: [{
        id: variationId,
        name: 'Padrão',
        description: acc.description,
        imageUrl: acc.imageUrl,
        attributes: acc.attributes,
        price: acc.price,
        commissionBonusAmount: acc.commissionBonusAmount,
        commissionBonusPercent: acc.commissionBonusPercent,
        timeEstimate: acc.timeEstimate,
        compatibilities: (acc.compatibilities || [])
          .map((entry) => ({ model: entry.split('|')[0], version: entry.split('|')[1], year: entry.split('|')[2] }))
          .filter((compatibility) => isAllowedVehicleModel(compatibility.model)),
        active: acc.active,
      }],
    };
    persistProducts([...products, newProduct]);
  };

  const updateAccessory = (id: string, updatedAcc: Partial<Accessory>) => {
    const updatedProducts = products.map((product) => ({
      ...product,
      variations: product.variations.map((variation) => (
        variation.id === id
          ? {
              ...variation,
              name: updatedAcc.attributes?.variationName ? String(updatedAcc.attributes.variationName) : variation.name,
              description: updatedAcc.description ?? variation.description,
              imageUrl: updatedAcc.imageUrl ?? variation.imageUrl,
              attributes: updatedAcc.attributes ?? variation.attributes,
              price: updatedAcc.price ?? variation.price,
              commissionBonusAmount: updatedAcc.commissionBonusAmount ?? variation.commissionBonusAmount,
              commissionBonusPercent: updatedAcc.commissionBonusPercent ?? variation.commissionBonusPercent,
              timeEstimate: updatedAcc.timeEstimate ?? variation.timeEstimate,
              compatibilities: updatedAcc.compatibilities
                ? updatedAcc.compatibilities
                    .map((entry) => ({ model: entry.split('|')[0], version: entry.split('|')[1], year: entry.split('|')[2] }))
                    .filter((compatibility) => isAllowedVehicleModel(compatibility.model))
                : variation.compatibilities,
              active: updatedAcc.active ?? variation.active,
            }
          : variation
      )),
    }));
    persistProducts(updatedProducts);
  };

  const deleteAccessory = (id: string) => {
    const updatedProducts = products.map((product) => ({
      ...product,
      variations: product.variations.map((variation) => (
        variation.id === id ? { ...variation, active: false } : variation
      )),
    }));
    persistProducts(updatedProducts);
  };

  // 2. Sales and flow-up Automations
  const createSale = (
    saleData: Omit<Sale, 'id' | 'createdAt' | 'commissionPercent' | 'commissionAmount' | 'commissionStatus' | 'commissionPaidAt'>,
    items: Omit<SaleItem, 'id' | 'saleId'>[]
  ): string => {
    const saleId = `sale_${Date.now()}`;
    const newSale: Sale = {
      ...saleData,
      id: saleId,
      createdAt: new Date().toISOString(),
      commissionPercent: settings.commissionPercent,
      commissionAmount: 0,
      commissionStatus: 'A receber',
      commissionPaidAt: null,
      paymentStatus: saleData.paymentStatus || 'Não paga',
      paymentForecastDate: saleData.paymentForecastDate || '',
      partialPaidAmount: saleData.partialPaidAmount ?? 0,
      installationStatus: saleData.installationStatus || (saleData.installationDate ? 'Agendada' : 'Sem data definida'),
      installationNotes: saleData.installationNotes || '',
      status: coerceSalesStatus(saleData.status),
    };

    // Add items
    const newItems: SaleItem[] = items.map((item, index) => ({
      ...item,
      id: `item_${Date.now()}_${index}`,
      saleId,
    }));
    const commissionBreakdown = calculateSaleCommission({
      saleTotal: newSale.total,
      commissionPercent: newSale.commissionPercent,
      items: newItems,
      accessories,
      settings,
      monthlyVolumeBeforeSale: getMonthlyVolumeBeforeSale(sales, null, newSale.total, newSale.createdAt),
      monthlyOpportunityCount: getMonthlyOpportunityCount([...sales, newSale], getSaleMonthKey(newSale.createdAt)),
    });
    newSale.baseCommissionAmount = commissionBreakdown.baseAmount;
    newSale.productBonusAmount = commissionBreakdown.productBonusAmount;
    newSale.goalExtraAmount = commissionBreakdown.goalExtraAmount;
    newSale.goalBonusAmount = commissionBreakdown.goalBonusAmount;
    newSale.commissionAmount = commissionBreakdown.commissionAmount;

    // Update state
    const updatedSales = [newSale, ...sales];
    const updatedItems = [...saleItems, ...newItems];

    setSales(updatedSales);
    setSaleItems(updatedItems);

    syncToLocalStorage('crm_sales', updatedSales);
    syncToLocalStorage('crm_sale_items', updatedItems);

    // Automation: Create initial follow-up today
    const followId = `follow_${Date.now()}`;
    const initialFollowup: Followup = {
      id: followId,
      saleId,
      clientName: newSale.clientName,
      carModel: newSale.carModel,
      type: 'WhatsApp',
      status: 'Pendente',
      dueDate: getSimulatedToday(), // Initial contact today
      notes: `Primeiro contato pós recepção do cliente de ${newSale.carModel} para oferta de acessórios.`,
      createdAt: new Date().toISOString(),
    };
    const updatedFollowups = [initialFollowup, ...followups];
    setFollowups(updatedFollowups);
    syncToLocalStorage('crm_followups', updatedFollowups);

    // Record Event
    recordEvent(saleId, 'Venda criada', `Venda de acessórios iniciada para ${newSale.clientName}.`, events);

    return saleId;
  };

  const updateSaleDetails = (
    saleId: string,
    saleData: Partial<Sale>,
    items?: Omit<SaleItem, 'id' | 'saleId'>[]
  ) => {
    // Find current sale to check status transition
    const existing = sales.find((s) => s.id === saleId);
    if (!existing) return;

    let updatedSalesList = [...sales];
    const originalStatus = coerceSalesStatus(existing.status);
    const normalizedNextStatus = coerceSalesStatus(saleData.status, originalStatus);
    const isStatusChanged = normalizedNextStatus !== originalStatus;

    // Build the updated sale object
    const updatedSale: Sale = {
      ...existing,
      ...saleData,
      status: normalizedNextStatus,
    };

    // Update items if passed
    let updatedItemsList = saleItems;
    if (items) {
      const filteredItems = saleItems.filter((item) => item.saleId !== saleId);
      const newItems: SaleItem[] = items.map((item, index) => ({
        ...item,
        id: `item_${Date.now()}_${index}`,
        saleId,
      }));
      updatedItemsList = [...filteredItems, ...newItems];
      setSaleItems(updatedItemsList);
      syncToLocalStorage('crm_sale_items', updatedItemsList);
    }
    const activeItems = updatedItemsList.filter((item) => item.saleId === saleId);
    const activePercent = saleData.commissionPercent ?? existing.commissionPercent;
    const activeTotal = saleData.total ?? existing.total;
    const commissionBreakdown = calculateSaleCommission({
      saleTotal: activeTotal,
      commissionPercent: activePercent,
      items: activeItems,
      accessories,
      settings,
      monthlyVolumeBeforeSale: getMonthlyVolumeBeforeSale(sales, saleId, activeTotal, updatedSale.createdAt),
      monthlyOpportunityCount: getMonthlyOpportunityCount(sales, getSaleMonthKey(updatedSale.createdAt)),
    });
    updatedSale.commissionPercent = activePercent;
    updatedSale.baseCommissionAmount = commissionBreakdown.baseAmount;
    updatedSale.productBonusAmount = commissionBreakdown.productBonusAmount;
    updatedSale.goalExtraAmount = commissionBreakdown.goalExtraAmount;
    updatedSale.goalBonusAmount = commissionBreakdown.goalBonusAmount;
    updatedSale.commissionAmount = commissionBreakdown.commissionAmount;

    updatedSalesList = updatedSalesList.map((s) => (s.id === saleId ? updatedSale : s));
    setSales(updatedSalesList);
    syncToLocalStorage('crm_sales', updatedSalesList);

    let currentEventsList = events;
    if (items) {
      currentEventsList = recordEvent(
        saleId,
        'Itens atualizados',
        'A lista de acessórios da proposta foi modificada.',
        currentEventsList,
        { changedBy: currentUser }
      );
    }

    TRACKED_SALE_FIELDS.forEach(({ key, label }) => {
      const previousValue = formatTrackedValue(existing[key]);
      const nextValue = formatTrackedValue(updatedSale[key]);
      if (previousValue !== nextValue) {
        currentEventsList = recordEvent(
          saleId,
          'Campo alterado',
          `${label}: ${previousValue} → ${nextValue}.`,
          currentEventsList,
          {
            field: label,
            previousValue,
            nextValue,
            changedBy: currentUser,
          }
        );
      }
    });

    if (!items && currentEventsList === events) {
      currentEventsList = recordEvent(
        saleId,
        'Dados atualizados',
        'Dados da venda foram modificados.',
        currentEventsList,
        { changedBy: currentUser }
      );
    }

    // If status changed, invoke the state-machine rules
    if (isStatusChanged) {
      triggerStatusAutomations(saleId, normalizedNextStatus, saleData.lostReason, updatedSalesList, currentEventsList);
    }
  };

  // State trigger automations
  const triggerStatusAutomations = (
    saleId: string,
    newStatus: SalesStatus,
    lostReason?: string,
    currentSalesList?: Sale[],
    currentEventsList?: SaleEvent[]
  ) => {
    const activeSales = currentSalesList || sales;
    const sale = activeSales.find((s) => s.id === saleId);
    if (!sale) return;

    let currentFollowups = [...followups];
    let currentEvents = [...(currentEventsList || events)];

    // Formulate a standardized event helper
    const logEventLocal = (type: string, desc: string) => {
      const newEvent: SaleEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        saleId,
        type,
        description: desc,
        createdAt: new Date().toISOString(),
      };
      currentEvents = [newEvent, ...currentEvents];
    };

    if (newStatus === 'Orçamento enviado') {
      // Create follow-up next business day (or next day)
      const due = getNextBusinessDay();
      const follow: Followup = {
        id: `follow_${Date.now()}`,
        saleId,
        clientName: sale.clientName,
        carModel: sale.carModel,
        type: 'WhatsApp',
        status: 'Pendente',
        dueDate: due,
        notes: `Cobrar retorno do orçamento dos acessórios do seu ${sale.carModel}.`,
        createdAt: new Date().toISOString(),
      };
      currentFollowups = [follow, ...currentFollowups];
      logEventLocal('Orçamento gerado', `Orçamento enviado para ${sale.clientName}. Seguir amanhã útil.`);
    } else if (newStatus === 'Aprovado') {
      // Calculate commission status, follow-up to schedule/confirm installation
      logEventLocal('Status alterado', 'Status alterado para Aprovado pelo cliente. Comissão gerada.');
      const follow: Followup = {
        id: `follow_${Date.now()}`,
        saleId,
        clientName: sale.clientName,
        carModel: sale.carModel,
        type: 'WhatsApp',
        status: 'Pendente',
        dueDate: getSimulatedToday(),
        notes: 'Confirmar data e horário de instalação na oficina.',
        createdAt: new Date().toISOString(),
      };
      currentFollowups = [follow, ...currentFollowups];
    } else if (newStatus === 'Aguardando instalação') {
      logEventLocal('Status alterado', `Status alterado para Aguardando Instalação (Agendado em: ${sale.installationDate || 'Não definida'}).`);
      const follow: Followup = {
        id: `follow_${Date.now()}`,
        saleId,
        clientName: sale.clientName,
        carModel: sale.carModel,
        type: 'Instalação',
        status: 'Pendente',
        dueDate: sale.installationDate || getSimulatedToday(),
        notes: `Acompanhar instalação de acessórios com o montador ${sale.installerName || 'Não definido'}.`,
        createdAt: new Date().toISOString(),
      };
      currentFollowups = [follow, ...currentFollowups];
    } else if (newStatus === 'Pronto para entrega') {
      // Follow-up to call/notify client
      const follow: Followup = {
        id: `follow_${Date.now()}`,
        saleId,
        clientName: sale.clientName,
        carModel: sale.carModel,
        type: 'WhatsApp',
        status: 'Pendente',
        dueDate: getSimulatedToday(),
        notes: `Avisar retirada: Acessórios instalados no ${sale.carModel}. Combinar com o cliente.`,
        createdAt: new Date().toISOString(),
      };
      currentFollowups = [follow, ...currentFollowups];
      logEventLocal('Instalação pronta', `Os acessórios do ${sale.carModel} estão finalizados. Aguardando entrega.`);
    } else if (newStatus === 'Entregue') {
      // Follow-up: pós-venda em 2 dias
      logEventLocal('Instalação entregue', `Veículo entregue para o cliente ${sale.clientName}. Pós-venda agendado.`);
      const follow: Followup = {
        id: `follow_${Date.now()}`,
        saleId,
        clientName: sale.clientName,
        carModel: sale.carModel,
        type: 'Pós-venda',
        status: 'Pendente',
        dueDate: getOffsetDate(2),
        notes: `Pesquisa pós-venda de satisfação dos acessórios com o cliente.`,
        createdAt: new Date().toISOString(),
      };
      currentFollowups = [follow, ...currentFollowups];
    } else if (newStatus === 'Perdido') {
      // Cancel all pending followups, cancel commission status
      currentFollowups = currentFollowups.map((f) =>
        f.saleId === saleId && f.status === 'Pendente' ? { ...f, status: 'Cancelado' as const } : f
      );
      logEventLocal('Venda perdida', `Venda perdida. Motivo: ${lostReason || 'Não informado'}.`);
    }

    setFollowups(currentFollowups);
    setEvents(currentEvents);
    syncToLocalStorage('crm_followups', currentFollowups);
    syncToLocalStorage('crm_events', currentEvents);
  };

  const updateSaleStatus = (saleId: string, newStatus: SalesStatus, lostReason?: string) => {
    let updatedSalesList = [...sales];
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return;

    const updatedSale: Sale = {
      ...sale,
      status: coerceSalesStatus(newStatus),
      lostReason: coerceSalesStatus(newStatus) === 'Perdido' ? lostReason : sale.lostReason,
    };

    const normalizedStatus = coerceSalesStatus(newStatus);

    if (normalizedStatus === 'Perdido') {
      updatedSale.commissionStatus = 'Cancelado';
      updatedSale.installationStatus = 'Cancelada';
      updatedSale.paymentStatus = 'Cancelada';
    } else if (normalizedStatus === 'Aprovado' && sale.commissionStatus === 'Cancelado') {
      updatedSale.commissionStatus = 'A receber';
    } else if (normalizedStatus === 'Aguardando instalação') {
      updatedSale.installationStatus =
        sale.paymentStatus === 'Paga'
          ? (sale.installationDate ? 'Agendada' : 'Sem data definida')
          : 'Aguardando pagamento';
    } else if (normalizedStatus === 'Pronto para entrega' || normalizedStatus === 'Entregue') {
      updatedSale.installationStatus = 'Instalada';
    }

    updatedSalesList = updatedSalesList.map((s) => (s.id === saleId ? updatedSale : s));
    setSales(updatedSalesList);
    syncToLocalStorage('crm_sales', updatedSalesList);

    let currentEventsList = events;
    TRACKED_SALE_FIELDS.forEach(({ key, label }) => {
      const previousValue = formatTrackedValue(sale[key]);
      const nextValue = formatTrackedValue(updatedSale[key]);
      if (previousValue !== nextValue) {
        currentEventsList = recordEvent(
          saleId,
          'Campo alterado',
          `${label}: ${previousValue} → ${nextValue}.`,
          currentEventsList,
          {
            field: label,
            previousValue,
            nextValue,
            changedBy: currentUser,
          }
        );
      }
    });

    // Execute automations associated with this transition
    triggerStatusAutomations(saleId, normalizedStatus, lostReason, updatedSalesList, currentEventsList);
  };

  // 3. Commissions
  const deleteSale = (saleId: string) => {
    const updatedSales = sales.filter((s) => s.id !== saleId);
    setSales(updatedSales);
    syncToLocalStorage('crm_sales', updatedSales);

    const updatedItems = saleItems.filter((item) => item.saleId !== saleId);
    setSaleItems(updatedItems);
    syncToLocalStorage('crm_sale_items', updatedItems);

    const updatedFollowups = followups.filter((f) => f.saleId !== saleId);
    setFollowups(updatedFollowups);
    syncToLocalStorage('crm_followups', updatedFollowups);

    const updatedEvents = events.filter((evt) => evt.saleId !== saleId);
    setEvents(updatedEvents);
    syncToLocalStorage('crm_events', updatedEvents);
  };

  const markCommissionReceived = (saleId: string) => {
    const updated = sales.map((sale) => {
      if (sale.id === saleId) {
        return {
          ...sale,
          commissionStatus: 'Recebido' as const,
          commissionPaidAt: new Date().toISOString(),
        };
      }
      return sale;
    });
    setSales(updated);
    syncToLocalStorage('crm_sales', updated);
    recordEvent(saleId, 'Comissão recebida', 'Comissão foi paga para Thayná e marcada como Recebida.', events);
  };

  // 4. Followups
  const addFollowup = (followData: Omit<Followup, 'id' | 'createdAt'>) => {
    const newFollow: Followup = {
      ...followData,
      id: `follow_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [newFollow, ...followups];
    setFollowups(updated);
    syncToLocalStorage('crm_followups', updated);
  };

  const updateFollowupStatus = (id: string, newStatus: FollowupStatus, notes?: string) => {
    const followupTarget = followups.find((f) => f.id === id);
    if (!followupTarget) return;

    let updatedFollowupsList = [...followups];
    let currentEvents = [...events];

    updatedFollowupsList = updatedFollowupsList.map((f) => {
      if (f.id === id) {
        const appendedNotes = notes ? (f.notes ? `${f.notes} | Obs: ${notes}` : `Obs: ${notes}`) : f.notes;
        return { ...f, status: newStatus, notes: appendedNotes };
      }
      return f;
    });

    const statusNotesStr = notes ? ` (Obs: "${notes}")` : '';

    // Handle "Sem resposta" automation
    if (newStatus === 'Sem resposta') {
      // Sugere novo contato em 2 dias
      const newFollowDate = getOffsetDate(2);
      const automaticFollow: Followup = {
        id: `follow_${Date.now()}`,
        saleId: followupTarget.saleId,
        clientName: followupTarget.clientName,
        carModel: followupTarget.carModel,
        type: 'WhatsApp',
        status: 'Pendente',
        dueDate: newFollowDate,
        notes: `Segundo contato pós status de "Sem resposta" preliminar de ${followupTarget.clientName}.${notes ? ` Obs anterior: ${notes}` : ''}`,
        createdAt: new Date().toISOString(),
      };
      updatedFollowupsList = [automaticFollow, ...updatedFollowupsList];

      const newEvent: SaleEvent = {
        id: `evt_${Date.now()}`,
        saleId: followupTarget.saleId,
        type: 'Follow-up sem resposta',
        description: `Contato anterior sem resposta${statusNotesStr}. Novo follow-up agendado em 2 dias (${newFollowDate}).`,
        createdAt: new Date().toISOString(),
      };
      currentEvents = [newEvent, ...currentEvents];
    } else if (newStatus === 'Feito') {
      const newEvent: SaleEvent = {
        id: `evt_${Date.now()}`,
        saleId: followupTarget.saleId,
        type: 'Follow-up realizado',
        description: `Follow-up do tipo "${followupTarget.type}" realizado.${statusNotesStr}`,
        createdAt: new Date().toISOString(),
      };
      currentEvents = [newEvent, ...currentEvents];
    } else if (newStatus === 'Cancelado') {
      const newEvent: SaleEvent = {
        id: `evt_${Date.now()}`,
        saleId: followupTarget.saleId,
        type: 'Follow-up cancelado',
        description: `Follow-up do tipo "${followupTarget.type}" cancelado.${statusNotesStr}`,
        createdAt: new Date().toISOString(),
      };
      currentEvents = [newEvent, ...currentEvents];
    }

    setFollowups(updatedFollowupsList);
    setEvents(currentEvents);
    syncToLocalStorage('crm_followups', updatedFollowupsList);
    syncToLocalStorage('crm_events', currentEvents);
  };

  const remarcalFollowup = (id: string, newDate: string, notes?: string) => {
    const followupTarget = followups.find((f) => f.id === id);
    if (!followupTarget) return;

    const updated = followups.map((f) => {
      if (f.id === id) {
        const appendedNotes = notes ? (f.notes ? `${f.notes} | Obs: ${notes}` : `Obs: ${notes}`) : f.notes;
        return { ...f, dueDate: newDate, notes: appendedNotes };
      }
      return f;
    });
    setFollowups(updated);
    syncToLocalStorage('crm_followups', updated);

    recordEvent(
      followupTarget.saleId,
      'Follow-up remarcado',
      `Contato adiado para ${newDate}. Motivo: Solicitado pelo usuário.${notes ? ` Obs: "${notes}"` : ''}`,
      events
    );
  };

  const addManualEvent = (saleId: string, type: string, description: string) => {
    recordEvent(saleId, type, description, events);
  };

  const exportCRMData = (sections: CRMExportSection[]): CRMExportPayload => {
    const selectedSections = Array.from(new Set(sections));
    const payload: CRMExportPayload = {
      schema: 'crm-thayna-reis-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      source: 'CRM Thayná Reis',
      sections: selectedSections,
      data: {},
    };

    if (selectedSections.includes('products')) {
      payload.data.products = products;
      payload.data.accessories = accessories;
    }
    if (selectedSections.includes('sales')) {
      payload.data.sales = sales;
      payload.data.saleItems = saleItems;
    }
    if (selectedSections.includes('followups')) payload.data.followups = followups;
    if (selectedSections.includes('events')) payload.data.events = events;
    if (selectedSections.includes('settings')) payload.data.settings = settings;
    if (selectedSections.includes('vehicles')) payload.data.carModels = carModels;

    return payload;
  };

  const importCRMData = (payload: CRMExportPayload, sections: CRMExportSection[]) => {
    if (!payload || payload.schema !== 'crm-thayna-reis-export' || !payload.data) {
      throw new Error('Arquivo JSON inválido para este CRM.');
    }

    const selectedSections = Array.from(new Set(sections));
    const importedSections: CRMExportSection[] = [];
    const skippedSections: CRMExportSection[] = [];
    const data = payload.data;

    selectedSections.forEach((section) => {
      if (section === 'products') {
        if (!Array.isArray(data.products)) {
          skippedSections.push(section);
          return;
        }
        const nextProducts = sanitizeProducts(data.products);
        const nextAccessories = toProductAccessories(nextProducts);
        setProducts(nextProducts);
        setAccessories(nextAccessories);
        syncToLocalStorage('crm_products', nextProducts);
        syncToLocalStorage('crm_accessories', nextAccessories);
        syncToLocalStorage('crm_accessory_catalog_version', ACCESSORY_CATALOG_VERSION);
        importedSections.push(section);
        return;
      }

      if (section === 'sales') {
        if (!Array.isArray(data.sales) || !Array.isArray(data.saleItems)) {
          skippedSections.push(section);
          return;
        }
        const nextSales = data.sales.map(normalizeSaleRecord);
        setSales(nextSales);
        setSaleItems(data.saleItems);
        syncToLocalStorage('crm_sales', nextSales);
        syncToLocalStorage('crm_sale_items', data.saleItems);
        importedSections.push(section);
        return;
      }

      if (section === 'followups') {
        if (!Array.isArray(data.followups)) {
          skippedSections.push(section);
          return;
        }
        setFollowups(data.followups);
        syncToLocalStorage('crm_followups', data.followups);
        importedSections.push(section);
        return;
      }

      if (section === 'events') {
        if (!Array.isArray(data.events)) {
          skippedSections.push(section);
          return;
        }
        setEvents(data.events);
        syncToLocalStorage('crm_events', data.events);
        importedSections.push(section);
        return;
      }

      if (section === 'settings') {
        if (!data.settings) {
          skippedSections.push(section);
          return;
        }
        const nextSettings = { ...DEFAULT_SETTINGS, ...data.settings };
        setSettings(nextSettings);
        syncToLocalStorage('crm_settings', nextSettings);
        importedSections.push(section);
        return;
      }

      if (section === 'vehicles') {
        if (!Array.isArray(data.carModels)) {
          skippedSections.push(section);
          return;
        }
        const nextCarModels = sanitizeCarModels(data.carModels);
        setCarModels(nextCarModels);
        syncToLocalStorage('crm_car_models', nextCarModels);
        importedSections.push(section);
      }
    });

    if (remoteReady) {
      void fetch('/api/import/local-storage', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, sections: selectedSections }),
      }).catch(() => {
        showAlert('Importação local concluída', 'Dados aplicados na tela. A sincronização com o servidor será repetida automaticamente.');
      });
    }

    return { importedSections, skippedSections };
  };

  const safeSales = useMemo(() => sales.map(normalizeSaleRecord), [sales]);

  return (
    <CRMContext.Provider
      value={{
        accessories,
        products,
        sales: safeSales,
        saleItems,
        followups,
        events,
        settings,
        currentUser,
        carModels,
        saveCarModels,
        updateSettings,
        addProduct,
        updateProduct,
        deleteProduct,
        addAccessory,
        updateAccessory,
        deleteAccessory,
        createSale,
        updateSaleDetails,
        updateSaleStatus,
        deleteSale,
        markCommissionReceived,
        addFollowup,
        updateFollowupStatus,
        remarcalFollowup,
        addManualEvent,
        exportCRMData,
        importCRMData,
        clearProducts,
        clearSalesData,
        resetDatabase,
        showAlert,
        showConfirm,
      }}
    >
      {children}

      {/* Custom Branded Alert Overlay Modal */}
      {alertState.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-start sm:items-center justify-center p-3 sm:p-4 z-[9999] animate-fade-in no-print backdrop-blur-[2px] overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-sm w-full max-h-[calc(100vh-1.5rem)] overflow-y-auto p-4 sm:p-6 shadow-2xl border border-slate-100 space-y-4 my-3 sm:my-0">
            <div className="text-center space-y-2">
              <span className="p-3 bg-[#002C5F]/10 text-[#002C5F] rounded-2xl inline-block border border-[#002C5F]/20 shadow-xs">
                <AlertCircle className="w-6 h-6" />
              </span>
              <h3 className="text-base font-display font-medium text-slate-800 uppercase tracking-tight">
                {alertState.title}
              </h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                {alertState.message}
              </p>
            </div>
            <div className="flex items-center justify-center pt-2">
              <button
                onClick={closeAlert}
                className="text-xs bg-[#002C5F] hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-bold cursor-pointer transition-all w-full text-center"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Branded Confirm Overlay Modal */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-start sm:items-center justify-center p-3 sm:p-4 z-[9999] animate-fade-in no-print backdrop-blur-[2px] overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-sm w-full max-h-[calc(100vh-1.5rem)] overflow-y-auto p-4 sm:p-6 shadow-2xl border border-slate-100 space-y-4 my-3 sm:my-0">
            <div className="text-center space-y-2">
              <span className="p-3 bg-amber-50 text-amber-600 rounded-2xl inline-block border border-amber-100 shadow-xs">
                <HelpCircle className="w-6 h-6" />
              </span>
              <h3 className="text-base font-display font-medium text-slate-800 uppercase tracking-tight">
                {confirmState.title}
              </h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                {confirmState.message}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={closeConfirm}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-650 px-4 py-2.5 rounded-xl font-semibold cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (confirmState.onConfirm) {
                    confirmState.onConfirm();
                  }
                  closeConfirm();
                }}
                className="text-xs bg-[#002C5F] hover:bg-[#00214c] text-white px-5 py-2.5 rounded-xl font-bold cursor-pointer transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </CRMContext.Provider>
  );
}

export function useCRM() {
  const context = useContext(CRMContext);
  if (context === undefined) {
    throw new Error('useCRM deve ser usado dentro de CRMProvider');
  }
  return context;
}
