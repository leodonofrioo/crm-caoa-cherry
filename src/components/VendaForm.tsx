import React, { useMemo, useState, useEffect } from 'react';
import { useCRM, isAccessoryCompatible, getSimulatedToday } from '../context/CRMContext';
import {
  Sale,
  SaleItem,
  SalesStatus,
  Accessory,
  AccessoryCategory,
  Followup,
  FilmConfiguration,
  FilmGlassPosition,
  PaymentStatus,
  InstallationStatus,
} from '../types';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Calendar,
  CheckCircle,
  Clock,
  Printer,
  ChevronRight,
  Info,
  DollarSign,
  User,
  PlusCircle,
  FileText,
  MessageCircle,
  Trash,
  ImagePlus,
  Eye,
  Layers,
  Shield,
  KeyRound,
  Siren,
  PanelTop,
  CarFront,
  Package,
  DoorOpen,
  MonitorPlay,
  Lightbulb,
  Link,
  Sparkles,
  Wrench,
} from 'lucide-react';
import ProposalPrint from './ProposalPrint';
import AccessoryChecklistPrint, { buildAccessoryChecklistPages } from './AccessoryChecklistPrint';
import FilmSimulatorModal from './FilmSimulatorModal';
import { MobileActionBar, MobileEntityCard, MobileFilterSheet, MobilePageHeader } from './mobile';
import { getAccessoryAttributeBadges } from '../data/categoryConfig';
import { isVehicleCompatible } from '../data/accessories';
import { calculateSaleCommission, getMonthlyOpportunityCount, getMonthlyVolumeBeforeSale, getSaleMonthKey } from '../utils/commissions';
import {
  formatDateBR,
  getEffectiveInstallationStatus,
  getInstallationRadar,
  getPaymentSignal,
  INSTALLATION_STATUSES,
  PAYMENT_STATUSES,
} from '../utils/installationSchedule';
import { getPipelineAutomation } from '../utils/pipelineAutomation';
import { coerceSalesStatus } from '../utils/saleStatus';

interface VendaFormProps {
  selectedSaleId: string | null;
  onClearSelectedSale: () => void;
  createRequest?: { id: number; status: SalesStatus } | null;
  onCreateRequestConsumed?: () => void;
}

const getPhoneDigits = (value: string) => value.replace(/\D/g, '');

const normalizePhoneDigits = (value: string) => {
  const digits = getPhoneDigits(value);
  if (digits.length === 11 && !digits.startsWith('55')) return `55${digits}`;
  return digits.slice(0, 13);
};

const formatPhoneInput = (value: string) => {
  const digits = normalizePhoneDigits(value);
  const country = digits.slice(0, 2);
  const area = digits.slice(2, 4);
  const prefix = digits.slice(4, 9);
  const suffix = digits.slice(9, 13);

  let formatted = country ? `+${country}` : '';
  if (area) formatted += ` (${area}`;
  if (area.length === 2) formatted += ')';
  if (prefix) formatted += ` ${prefix}`;
  if (suffix) formatted += `-${suffix}`;

  return formatted;
};

const FILM_GLASS_POSITIONS: Array<{ key: FilmGlassPosition; label: string; hint: string }> = [
  { key: 'windshield', label: 'Frente / Para-brisa', hint: 'Visão principal do motorista' },
  { key: 'rearGlass', label: 'Atrás / Vidro traseiro', hint: 'Privacidade e estética traseira' },
  { key: 'frontSide', label: 'Laterais dianteiras', hint: 'Motorista e passageiro' },
  { key: 'rearSide', label: 'Laterais traseiras', hint: 'Banco traseiro' },
  { key: 'sunroof', label: 'Teto solar', hint: 'Controle de calor e luminosidade superior' },
];

interface AccessoryOfferSlotDefinition {
  key: string;
  title: string;
  section: string;
  priority: number;
}

interface AccessoryOfferSlot extends AccessoryOfferSlotDefinition {
  items: Accessory[];
  selectedId?: string;
}

interface CommercialSlotDefinition {
  key: string;
  title: string;
  description: string;
  priority: number;
  accent: string;
  required: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

interface CommercialSlotState extends CommercialSlotDefinition {
  optionCount: number;
  selectedAccessories: Accessory[];
  selectedAccessory?: Accessory;
  disabled: boolean;
  isFilmSlot?: boolean;
  status: 'configured' | 'required-missing' | 'optional-empty';
}

const GLASS_SECURITY_SLOT_KEY = 'glass-security';

const normalizeAccessoryName = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

const makeSlot = (key: string, title: string, section: string, priority: number): AccessoryOfferSlotDefinition => ({
  key,
  title,
  section,
  priority,
});

const getAccessoryOfferSlot = (accessory: Accessory): AccessoryOfferSlotDefinition => {
  const name = normalizeAccessoryName(accessory.name);

  if (name.includes('TAPETE PORTA MALA') || name.includes('BANDEJA PORTAMALA') || name.includes('PORTA MALA - BORRACHA')) {
    return makeSlot('cargo-liner', 'Proteção do porta-malas', 'Interior', 10);
  }
  if (name.includes('TAPETE')) return makeSlot('cabin-mats', 'Tapete da cabine', 'Interior', 20);
  if (name.includes('TAMPAO DE PORTA MALAS')) return makeSlot('cargo-cover', 'Tampão do porta-malas', 'Interior', 30);
  if (name.includes('REVESTIMENTO - BANCO')) return makeSlot('seat-upholstery', 'Revestimento dos bancos', 'Interior', 40);
  if (name.includes('APOIO DE PE')) return makeSlot('footrest-trim', 'Apoio de pé', 'Interior', 50);
  if (name.includes('PEDALEIRA')) return makeSlot('sport-pedal', 'Pedaleira esportiva', 'Interior', 60);
  if (name.includes('MULTIMIDIA')) return makeSlot('multimedia-protection', 'Proteção da multimídia', 'Proteção interna', 70);
  if (name.includes('CONSOLE CENTRAL')) return makeSlot('console-protection', 'Proteção do console', 'Proteção interna', 80);
  if (name.includes('VITRIFICACAO DE COURO')) return makeSlot('leather-coating', 'Vitrificação do couro', 'Serviços', 90);
  if (name.includes('VITRIFICACAO')) return makeSlot('paint-coating', 'Vitrificação da pintura', 'Serviços', 100);
  if (name.includes('RETIRADA - PELICULA')) return makeSlot('film-removal', 'Retirada de película', 'Serviços', 105);

  if (name.includes('FRISO PERSONALIZADO')) return makeSlot('body-side-molding', 'Friso lateral personalizado', 'Exterior', 110);
  if (name.includes('CALHA')) return makeSlot('rain-guard', 'Calha de chuva', 'Exterior', 120);
  if (name.includes('PROTETOR SOLEIRA') || name.includes('PROT SOLEIRA')) return makeSlot('door-sill-protector', 'Protetor de soleira', 'Exterior', 130);
  if (name.includes('PROTETOR PORTA')) return makeSlot('door-edge-protector', 'Protetor de porta', 'Exterior', 140);
  if (name.includes('PROTETOR MACANETA') || name.includes('CONCHA DAS MACANETA')) return makeSlot('door-handle-protector', 'Proteção de maçaneta', 'Exterior', 150);
  if (name.includes('RETROVISORES')) return makeSlot('mirror-finish', 'Retrovisores', 'Exterior', 160);
  if (name.includes('TAMPA COMBUSTIVEL')) return makeSlot('fuel-lid-protection', 'Tampa de combustível', 'Exterior', 170);
  if (name.includes('BATENTE DAS PORTAS')) return makeSlot('door-jamb-protection', 'Batente das portas', 'Exterior', 180);
  if (name.includes('PROTETOR CARTER') || name.includes('PROTETOR DE CARTER')) return makeSlot('underbody-protector', 'Protetor de cárter', 'Exterior', 190);
  if (name.includes('ENGATE')) return makeSlot('tow-hitch', 'Engate traseiro', 'Exterior', 200);
  if (name.includes('RACK TETO')) return makeSlot('roof-rack', 'Rack de teto', 'Teto e carga', 210);
  if (name.includes('SUPORTE BICICLETA') || name.includes('CAIXA BOX')) return makeSlot('roof-cargo', 'Carga no teto', 'Teto e carga', 220);

  if (name.includes('ALARME')) return makeSlot('alarm', 'Alarme', 'Segurança', 310);
  if (name.includes('PORCA ANTIFURTO')) return makeSlot('wheel-lock', 'Porca antifurto', 'Segurança', 320);
  if (name.includes('TRAVA ANTIFURTO ESTEPE')) return makeSlot('spare-wheel-lock', 'Trava antifurto do estepe', 'Segurança', 330);
  if (name.includes('SENSOR 4 PONTOS') || name.includes('SENSOR 8 PONTOS')) return makeSlot('parking-sensor', 'Sensor de estacionamento', 'Segurança', 340);
  if (name.includes('SUPAGLASS')) return makeSlot(GLASS_SECURITY_SLOT_KEY, 'Segurança dos vidros', 'Segurança', 350);
  if (name.includes('CINTO DE SEGURANCA PET')) return makeSlot('pet-seatbelt', 'Cinto pet', 'Segurança', 360);
  if (name.includes('TRAVAMENTO DAS PORTAS')) return makeSlot('speed-lock-module', 'Travamento das portas', 'Segurança', 370);

  if (name.includes('DRL') || name.includes('LUZ DIURNA')) return makeSlot('daytime-running-light', 'Luz diurna / DRL', 'Elétrica', 410);
  if (name.includes('LAMPADA') || name.includes('FAROL')) return makeSlot('headlight-bulb', 'Lâmpada do farol', 'Elétrica', 420);
  if (name.includes('LUZ PORTAMALA')) return makeSlot('trunk-light', 'Luz do porta-malas', 'Elétrica', 430);
  if (name.includes('INTERFACE - STREAMING')) return makeSlot('streaming-box', 'Streaming box', 'Tecnologia', 510);
  if (name.includes('PLAY TO AIR') || name.includes('BLUETOOTH')) return makeSlot('bluetooth-interface', 'Interface Bluetooth', 'Tecnologia', 515);
  if (name.includes('CARREGADOR POR INDUCAO')) return makeSlot('wireless-charger', 'Carregador por indução', 'Tecnologia', 520);
  if (name.includes('TOMADA USB')) return makeSlot('usb-outlet', 'Tomada USB', 'Tecnologia', 530);
  if (name.includes('SUPORTE MAGNETICO CELULAR')) return makeSlot('phone-holder', 'Suporte de celular', 'Tecnologia', 540);
  if (name.includes('DESBLOQUEIO IMAGEM')) return makeSlot('image-unlock', 'Desbloqueio de imagem', 'Tecnologia', 550);

  return makeSlot(`category-${accessory.category}`, accessory.category, 'Outros', 900);
};

const COMMERCIAL_SLOT_DEFINITIONS: CommercialSlotDefinition[] = [
  { key: 'pelicula', title: 'Película', description: 'Solar por vidro', priority: 5, accent: 'blue', required: true, icon: Layers },
  { key: 'vidros', title: 'Vidros', description: 'Antivandalismo e proteção', priority: 10, accent: 'cyan', required: true, icon: Shield },
  { key: 'chave-protecao', title: 'Chave / Proteção', description: 'Antifurto e travas', priority: 20, accent: 'slate', required: false, icon: KeyRound },
  { key: 'alarme', title: 'Alarme', description: 'Sensor e segurança', priority: 30, accent: 'red', required: false, icon: Siren },
  { key: 'frisos', title: 'Frisos', description: 'Laterais e acabamento', priority: 40, accent: 'indigo', required: false, icon: PanelTop },
  { key: 'tapetes', title: 'Tapetes', description: 'Cabine e proteção interna', priority: 50, accent: 'emerald', required: true, icon: CarFront },
  { key: 'porta-malas', title: 'Porta-malas', description: 'Bandeja e cobertura', priority: 60, accent: 'amber', required: true, icon: Package },
  { key: 'soleira', title: 'Soleira', description: 'Entrada das portas', priority: 70, accent: 'violet', required: false, icon: DoorOpen },
  { key: 'multimidia', title: 'Multimídia', description: 'Conectividade e tela', priority: 80, accent: 'sky', required: false, icon: MonitorPlay },
  { key: 'iluminacao', title: 'Iluminação', description: 'Lâmpadas e DRL', priority: 90, accent: 'yellow', required: false, icon: Lightbulb },
  { key: 'engate-rack', title: 'Engate / Rack', description: 'Carga e viagem', priority: 100, accent: 'orange', required: false, icon: Link },
  { key: 'estetica-vitrificacao', title: 'Estética', description: 'Vitrificação e acabamento', priority: 110, accent: 'fuchsia', required: false, icon: Sparkles },
  { key: 'outros', title: 'Outros', description: 'Itens complementares', priority: 999, accent: 'slate', required: false, icon: Wrench },
];

const COMMERCIAL_SLOT_BY_KEY = COMMERCIAL_SLOT_DEFINITIONS.reduce<Record<string, CommercialSlotDefinition>>(
  (slots, slot) => {
    slots[slot.key] = slot;
    return slots;
  },
  {}
);

const COMMERCIAL_SLOT_TONES: Record<string, { icon: string; selected: string; active: string }> = {
  blue: { icon: 'bg-blue-50 text-blue-800 border-blue-100', selected: 'bg-blue-50 text-blue-800 border-blue-100', active: 'border-blue-400 bg-blue-50/70 shadow-sm' },
  cyan: { icon: 'bg-cyan-50 text-cyan-800 border-cyan-100', selected: 'bg-cyan-50 text-cyan-800 border-cyan-100', active: 'border-cyan-400 bg-cyan-50/70 shadow-sm' },
  slate: { icon: 'bg-slate-100 text-slate-700 border-slate-200', selected: 'bg-slate-100 text-slate-700 border-slate-200', active: 'border-slate-400 bg-slate-50 shadow-sm' },
  red: { icon: 'bg-red-50 text-red-700 border-red-100', selected: 'bg-red-50 text-red-700 border-red-100', active: 'border-red-300 bg-red-50/70 shadow-sm' },
  indigo: { icon: 'bg-indigo-50 text-indigo-800 border-indigo-100', selected: 'bg-indigo-50 text-indigo-800 border-indigo-100', active: 'border-indigo-400 bg-indigo-50/70 shadow-sm' },
  emerald: { icon: 'bg-emerald-50 text-emerald-800 border-emerald-100', selected: 'bg-emerald-50 text-emerald-800 border-emerald-100', active: 'border-emerald-400 bg-emerald-50/70 shadow-sm' },
  amber: { icon: 'bg-amber-50 text-amber-800 border-amber-100', selected: 'bg-amber-50 text-amber-800 border-amber-100', active: 'border-amber-300 bg-amber-50/70 shadow-sm' },
  violet: { icon: 'bg-violet-50 text-violet-800 border-violet-100', selected: 'bg-violet-50 text-violet-800 border-violet-100', active: 'border-violet-400 bg-violet-50/70 shadow-sm' },
  sky: { icon: 'bg-sky-50 text-sky-800 border-sky-100', selected: 'bg-sky-50 text-sky-800 border-sky-100', active: 'border-sky-400 bg-sky-50/70 shadow-sm' },
  yellow: { icon: 'bg-yellow-50 text-yellow-800 border-yellow-100', selected: 'bg-yellow-50 text-yellow-800 border-yellow-100', active: 'border-yellow-300 bg-yellow-50/70 shadow-sm' },
  orange: { icon: 'bg-orange-50 text-orange-800 border-orange-100', selected: 'bg-orange-50 text-orange-800 border-orange-100', active: 'border-orange-300 bg-orange-50/70 shadow-sm' },
  fuchsia: { icon: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-100', selected: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-100', active: 'border-fuchsia-400 bg-fuchsia-50/70 shadow-sm' },
};

const COMMERCIAL_SLOT_STATUS_TONES: Record<CommercialSlotState['status'], { card: string; badge: string; label: string }> = {
  configured: {
    card: 'border-emerald-300 bg-emerald-50/70',
    badge: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    label: 'Configurado',
  },
  'required-missing': {
    card: 'border-red-300 bg-red-50/75',
    badge: 'border-red-100 bg-red-50 text-red-700',
    label: 'Obrigatório',
  },
  'optional-empty': {
    card: 'border-amber-300 bg-amber-50/70',
    badge: 'border-amber-100 bg-amber-50 text-amber-700',
    label: 'Opcional',
  },
};

const ACCESSORY_SLOT_TO_COMMERCIAL_SLOT: Record<string, string> = {
  'glass-security': 'vidros',
  'wheel-lock': 'chave-protecao',
  'spare-wheel-lock': 'chave-protecao',
  'speed-lock-module': 'chave-protecao',
  alarm: 'alarme',
  'parking-sensor': 'alarme',
  'body-side-molding': 'frisos',
  'rain-guard': 'frisos',
  'cabin-mats': 'tapetes',
  'cargo-liner': 'porta-malas',
  'cargo-cover': 'porta-malas',
  'door-sill-protector': 'soleira',
  'multimedia-protection': 'multimidia',
  'console-protection': 'multimidia',
  'streaming-box': 'multimidia',
  'bluetooth-interface': 'multimidia',
  'wireless-charger': 'multimidia',
  'usb-outlet': 'multimidia',
  'phone-holder': 'multimidia',
  'image-unlock': 'multimidia',
  'daytime-running-light': 'iluminacao',
  'headlight-bulb': 'iluminacao',
  'trunk-light': 'iluminacao',
  'tow-hitch': 'engate-rack',
  'roof-rack': 'engate-rack',
  'roof-cargo': 'engate-rack',
  'leather-coating': 'estetica-vitrificacao',
  'paint-coating': 'estetica-vitrificacao',
  'film-removal': 'estetica-vitrificacao',
  'door-edge-protector': 'estetica-vitrificacao',
  'door-handle-protector': 'estetica-vitrificacao',
  'mirror-finish': 'estetica-vitrificacao',
  'fuel-lid-protection': 'estetica-vitrificacao',
  'door-jamb-protection': 'estetica-vitrificacao',
  'underbody-protector': 'estetica-vitrificacao',
  'footrest-trim': 'estetica-vitrificacao',
  'sport-pedal': 'estetica-vitrificacao',
  'seat-upholstery': 'estetica-vitrificacao',
};

const getCommercialSlotForAccessory = (accessory: Accessory): CommercialSlotDefinition => {
  if (accessory.category === 'Película Solar') return COMMERCIAL_SLOT_BY_KEY.pelicula;
  const offerSlot = getAccessoryOfferSlot(accessory);
  const commercialKey = ACCESSORY_SLOT_TO_COMMERCIAL_SLOT[offerSlot.key] || 'outros';
  return COMMERCIAL_SLOT_BY_KEY[commercialKey] || COMMERCIAL_SLOT_BY_KEY.outros;
};

const buildAccessoryOfferSlots = (items: Accessory[], selectedIds: string[]): AccessoryOfferSlot[] => {
  const slots = new Map<string, AccessoryOfferSlot>();

  items.forEach((item) => {
    const definition = getAccessoryOfferSlot(item);
    const current = slots.get(definition.key);
    if (current) {
      current.items.push(item);
    } else {
      slots.set(definition.key, { ...definition, items: [item] });
    }
  });

  return Array.from(slots.values())
    .map((slot) => ({
      ...slot,
      items: slot.items.sort((a, b) => a.name.localeCompare(b.name) || a.price - b.price),
      selectedId: selectedIds.find((id) => slot.items.some((item) => item.id === id)),
    }))
    .sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
};

export default function VendaForm({ selectedSaleId, onClearSelectedSale, createRequest, onCreateRequestConsumed }: VendaFormProps) {
  const {
    sales,
    saleItems,
    accessories,
    products,
    events,
    followups,
    settings,
    updateSettings,
    createSale,
    updateSaleDetails,
    updateSaleStatus,
    deleteSale,
    carModels,
    showAlert,
    showConfirm,
  } = useCRM();

  // Selected view or form control
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [mobileFormStep, setMobileFormStep] = useState<'client' | 'accessories' | 'review'>('client');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  // Form Fields
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [carModel, setCarModel] = useState('Tiggo 5');
  const [carVersion, setCarVersion] = useState('');
  const [carYear, setCarYear] = useState('2025');
  const [carSalespersonName, setCarSalespersonName] = useState('');
  const [newCarSalespersonName, setNewCarSalespersonName] = useState('');
  const [isAddingCarSalesperson, setIsAddingCarSalesperson] = useState(false);
  const [installerName, setInstallerName] = useState('');
  const [newInstallerName, setNewInstallerName] = useState('');
  const [isAddingInstaller, setIsAddingInstaller] = useState(false);
  const [installationDate, setInstallationDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Não paga');
  const [paymentForecastDate, setPaymentForecastDate] = useState('');
  const [partialPaidAmount, setPartialPaidAmount] = useState<number>(0);
  const [installationStatus, setInstallationStatus] = useState<InstallationStatus>('Sem data definida');
  const [installationNotes, setInstallationNotes] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [internalNotes, setInternalNotes] = useState('');
  const [selectedAccessoryIds, setSelectedAccessoryIds] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariationId, setSelectedVariationId] = useState('');
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');
  const [selectedPackageSlotKey, setSelectedPackageSlotKey] = useState('tapetes');
  const [saleStatus, setSaleStatus] = useState<SalesStatus>('Novo cliente');
  const [customCommissionPercent, setCustomCommissionPercent] = useState<number>(settings.commissionPercent);
  const [filmConfiguration, setFilmConfiguration] = useState<FilmConfiguration>({});
  const [isPackageSlotModalOpen, setIsPackageSlotModalOpen] = useState(false);
  const [isFilmConfigModalOpen, setIsFilmConfigModalOpen] = useState(false);
  const [simulatorConfig, setSimulatorConfig] = useState<{
    title: string;
    baseFilm?: Accessory;
    overlayFilm?: Accessory;
  } | null>(null);

  // Proposal print view overlay
  const [printingSale, setPrintingSale] = useState<Sale | null>(null);
  const [isVehicleChecklistPrintOpen, setIsVehicleChecklistPrintOpen] = useState(false);

  // Load selected sale if passed from parent (Dashboard click or Kanban click)
  useEffect(() => {
    if (selectedSaleId) {
      const sale = sales.find((s) => s.id === selectedSaleId);
      if (sale) {
        handleOpenEdit(sale);
      }
      onClearSelectedSale(); // consume
    }
  }, [selectedSaleId, sales]);

  // Filter active accessories by car compatibility supporting cascading models, versions, and years
  const availableAccessories = accessories.filter((acc) => {
    if (!acc.active) return false;
    return isAccessoryCompatible(acc, carModel, carVersion, carYear);
  });
  const availableProducts = products
    .filter((product) => product.active)
    .map((product) => {
      const compatibleVariations = product.variations.filter((variation) => {
        if (!variation.active) return false;
        return isVehicleCompatible(variation.compatibilities, carModel, carVersion, carYear);
      });
      return { ...product, variations: compatibleVariations };
    })
    .filter((product) => product.variations.length > 0);
  const availableCategories = Array.from(new Set(availableProducts.map((product) => product.category))).sort() as AccessoryCategory[];
  const categoryProducts = availableProducts.filter((product) => !selectedCategory || product.category === selectedCategory);
  const normalizedCatalogSearchTerm = catalogSearchTerm.trim().toLowerCase();
  const filteredCategoryProducts = categoryProducts.filter((product) => {
    if (!normalizedCatalogSearchTerm) return true;
    const productMatches = `${product.name} ${product.description} ${product.category}`.toLowerCase().includes(normalizedCatalogSearchTerm);
    const variationMatches = product.variations.some((variation) =>
      `${variation.name} ${variation.description} ${variation.sku || ''}`.toLowerCase().includes(normalizedCatalogSearchTerm)
    );
    return productMatches || variationMatches;
  });
  const categoryProductCounts = availableCategories.reduce<Record<string, number>>((counts, category) => {
    counts[category] = availableProducts.filter((product) => product.category === category).length;
    return counts;
  }, {});
  const selectedProduct = categoryProducts.find((product) => product.id === selectedProductId);
  const selectedVariation = selectedProduct?.variations.find((variation) => variation.id === selectedVariationId);
  const selectedVariationAccessory = selectedVariation
    ? accessories.find((candidate) => candidate.id === selectedVariation.id)
    : undefined;
  const selectedVariationAlreadyAdded = Boolean(selectedVariation && selectedAccessoryIds.includes(selectedVariation.id));
  const selectedOfferAccessoryIds = selectedAccessoryIds.filter((id) => Boolean(accessories.find((acc) => acc.id === id)));
  const availableOfferAccessories = availableAccessories.filter((accessory) => accessory.category !== 'Película Solar');
  const availableSolarFilmAccessories = availableAccessories.filter((accessory) => accessory.category === 'Película Solar');
  const availableSolarFilmIds = availableSolarFilmAccessories.map((film) => film.id);
  const configuredFilmIds = Array.from(new Set(
    FILM_GLASS_POSITIONS.flatMap((position) => {
      const config = filmConfiguration[position.key];
      return [config?.baseFilmId, config?.overlayFilmId];
    }).filter((id): id is string => Boolean(id) && availableSolarFilmIds.includes(id))
  ));
  const configuredFilmAccessories = configuredFilmIds
    .map((id) => availableSolarFilmAccessories.find((film) => film.id === id))
    .filter((film): film is Accessory => Boolean(film));
  const proposalAccessoryIds = Array.from(new Set([...selectedOfferAccessoryIds, ...configuredFilmIds]));

  // Calculations
  const calculatedSubtotal = proposalAccessoryIds.reduce((sum, id) => {
    const acc = accessories.find((a) => a.id === id);
    return sum + (acc ? acc.price : 0);
  }, 0);

  const calculatedTotal = Math.max(0, calculatedSubtotal - discount);
  const remainingAfterPartialPayment = Math.max(0, calculatedTotal - partialPaidAmount);

  const calculatedTimeMinutes = proposalAccessoryIds.reduce((sum, id) => {
    const acc = accessories.find((a) => a.id === id);
    return sum + (acc ? acc.timeEstimate : 0);
  }, 0);

  const formattedHours = Math.floor(calculatedTimeMinutes / 60);
  const formattedMinutes = calculatedTimeMinutes % 60;
  const selectedPreviewItems = proposalAccessoryIds.map((id) => {
    const accessory = accessories.find((acc) => acc.id === id);
    return {
      accessoryId: id,
      price: accessory?.price ?? 0,
    };
  });
  const previewCommission = calculateSaleCommission({
    saleTotal: calculatedTotal,
    commissionPercent: customCommissionPercent,
    items: selectedPreviewItems,
    accessories,
    settings,
    monthlyVolumeBeforeSale: getMonthlyVolumeBeforeSale(
      sales,
      editingSale?.id ?? null,
      calculatedTotal,
      editingSale?.createdAt ?? new Date().toISOString()
    ),
    monthlyOpportunityCount: getMonthlyOpportunityCount(
      editingSale ? sales : [...sales, { createdAt: new Date().toISOString() }],
      getSaleMonthKey(editingSale?.createdAt ?? new Date().toISOString())
    ),
  });
  const pipelineAutomation = getPipelineAutomation({
    itemCount: proposalAccessoryIds.length,
    total: calculatedTotal,
    paymentStatus,
    installationStatus,
    installationDate,
    currentStatus: saleStatus,
  });
  const normalizedClientPhone = normalizePhoneDigits(clientPhone);
  const isClientPhoneValid = normalizedClientPhone.length === 13;
  const whatsappUrl = isClientPhoneValid ? `https://wa.me/${normalizedClientPhone}` : undefined;

  const availableAccessorySlots = buildAccessoryOfferSlots(availableOfferAccessories, selectedOfferAccessoryIds);
  const selectedAccessorySlotCount = availableAccessorySlots.filter((slot) => slot.selectedId).length;
  const configuredFilmGlassCount = FILM_GLASS_POSITIONS.filter((position) => {
    const config = filmConfiguration[position.key];
    return Boolean(
      (config?.baseFilmId && availableSolarFilmIds.includes(config.baseFilmId)) ||
      (config?.overlayFilmId && availableSolarFilmIds.includes(config.overlayFilmId))
    );
  }).length;
  const packageSlotCards: CommercialSlotState[] = COMMERCIAL_SLOT_DEFINITIONS
    .map((slot) => {
      const matchingAccessories =
        slot.key === 'pelicula'
          ? availableSolarFilmAccessories
          : availableOfferAccessories.filter((accessory) => getCommercialSlotForAccessory(accessory).key === slot.key);
      const selectedAccessories =
        slot.key === 'pelicula'
          ? configuredFilmAccessories
          : selectedOfferAccessoryIds
              .map((id) => accessories.find((accessory) => accessory.id === id))
              .filter((accessory): accessory is Accessory =>
                Boolean(accessory) && getCommercialSlotForAccessory(accessory).key === slot.key
              );

      const status: CommercialSlotState['status'] =
        selectedAccessories.length > 0 ? 'configured' : slot.required ? 'required-missing' : 'optional-empty';

      return {
        ...slot,
        optionCount: matchingAccessories.length,
        selectedAccessories,
        selectedAccessory: selectedAccessories[0],
        disabled: matchingAccessories.length === 0,
        isFilmSlot: slot.key === 'pelicula',
        status,
      };
    })
    .sort((a, b) => a.priority - b.priority);
  const filledPackageSlotCount = packageSlotCards.filter((slot) => slot.selectedAccessories.length > 0).length;
  const activePackageSlotCount = packageSlotCards.length;
  const selectedPackageSlot =
    packageSlotCards.find((slot) => slot.key === selectedPackageSlotKey && !slot.isFilmSlot) ||
    packageSlotCards.find((slot) => !slot.isFilmSlot);
  const selectedPackageSlotProducts = selectedPackageSlot
    ? availableProducts
        .map((product) => {
          const variations = product.variations.filter((variation) => {
            const accessory = accessories.find((candidate) => candidate.id === variation.id);
            if (!accessory || getCommercialSlotForAccessory(accessory).key !== selectedPackageSlot.key) return false;
            if (!normalizedCatalogSearchTerm) return true;
            return `${product.name} ${product.description} ${product.category} ${variation.name} ${variation.description} ${variation.sku || ''}`
              .toLowerCase()
              .includes(normalizedCatalogSearchTerm);
          });
          return { ...product, variations };
        })
        .filter((product) => product.variations.length > 0)
    : [];

  useEffect(() => {
    setFilmConfiguration((current) => {
      const next: FilmConfiguration = {};
      FILM_GLASS_POSITIONS.forEach((position) => {
        const config = current[position.key];
        const baseFilmId = config?.baseFilmId && availableSolarFilmIds.includes(config.baseFilmId) ? config.baseFilmId : undefined;
        const overlayFilmId = config?.overlayFilmId && availableSolarFilmIds.includes(config.overlayFilmId) ? config.overlayFilmId : undefined;
        if (baseFilmId || overlayFilmId) {
          next[position.key] = { baseFilmId, overlayFilmId };
        }
      });
      return next;
    });
  }, [availableSolarFilmIds.join('|')]);

  useEffect(() => {
    const currentSlot = packageSlotCards.find((slot) => slot.key === selectedPackageSlotKey);
    if (currentSlot && !currentSlot.isFilmSlot) return;
    const firstAvailableSlot = packageSlotCards.find((slot) => !slot.isFilmSlot);
    if (firstAvailableSlot && firstAvailableSlot.key !== selectedPackageSlotKey) {
      setSelectedPackageSlotKey(firstAvailableSlot.key);
    }
  }, [carModel, carVersion, carYear, availableProducts.length, selectedPackageSlotKey]);

  useEffect(() => {
    setSelectedCategory((current) => (current && availableCategories.includes(current as any) ? current : ''));
    setSelectedProductId('');
    setSelectedVariationId('');
  }, [carModel, carVersion, carYear]);

  useEffect(() => {
    setSelectedAccessoryIds((current) => {
      const next: string[] = [];
      let changed = false;

      current.forEach((id) => {
        const accessory = accessories.find((acc) => acc.id === id);
        if (!accessory) {
          changed = true;
          return;
        }
        if (!accessory.active || !isAccessoryCompatible(accessory, carModel, carVersion, carYear)) {
          changed = true;
          return;
        }

        const slot = getAccessoryOfferSlot(accessory);
        if (configuredFilmIds.length > 0 && slot.key === GLASS_SECURITY_SLOT_KEY) {
          changed = true;
          return;
        }
        next.push(id);
      });

      return changed ? next : current;
    });
  }, [accessories, carModel, carVersion, carYear, configuredFilmIds.join('|')]);

  // Filters for Main Sales Table
  const filteredSales = sales.filter((sale) => {
    const matchesSearch =
      sale.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.carModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.clientPhone.includes(searchTerm);
    const matchesStatus = statusFilter === 'Todos' || sale.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenCreate = (initialStatus?: unknown) => {
    const nextStatus = coerceSalesStatus(initialStatus);
    setEditingSale(null);
    setClientName('');
    setClientPhone('');

    // Setup cascading initial states in form using context catalog values
    const initialModel = carModels[0]?.name || 'Tiggo 5';
    const initialVersion = carModels[0]?.versions[0]?.name || '';
    const initialYear = carModels[0]?.versions[0]?.years[0] || '2025';

    setCarModel(initialModel);
    setCarVersion(initialVersion);
    setCarYear(initialYear);
    setCarSalespersonName(settings.carSalespeople?.[0] || '');
    setNewCarSalespersonName('');
    setIsAddingCarSalesperson(false);
    setInstallerName(settings.installers?.[0] || '');
    setNewInstallerName('');
    setIsAddingInstaller(false);
    setInstallationDate('');
    setPaymentStatus('Não paga');
    setPaymentForecastDate('');
    setPartialPaidAmount(0);
    setInstallationStatus('Sem data definida');
    setInstallationNotes('');
    setDiscount(0);
    setInternalNotes('');
    setSelectedAccessoryIds([]);
    setSelectedCategory('');
    setSelectedProductId('');
    setSelectedVariationId('');
    setCatalogSearchTerm('');
    setSelectedPackageSlotKey('tapetes');
    setFilmConfiguration({});
    setIsPackageSlotModalOpen(false);
    setIsFilmConfigModalOpen(false);
    setSaleStatus(nextStatus);
    setCustomCommissionPercent(settings.commissionPercent);
    setMobileFormStep('client');
    setIsFormOpen(true);
  };

  useEffect(() => {
    if (!createRequest) return;
    handleOpenCreate(createRequest.status);
    onCreateRequestConsumed?.();
  }, [createRequest?.id]);

  const handleOpenEdit = (sale: Sale) => {
    setEditingSale(sale);
    setClientName(sale.clientName);
    setClientPhone(sale.clientPhone);
    setCarModel(sale.carModel);
    setCarVersion(sale.carVersion);
    setCarYear(sale.carYear);
    setCarSalespersonName(sale.carSalespersonName || '');
    setNewCarSalespersonName('');
    setIsAddingCarSalesperson(false);
    setInstallerName(sale.installerName || '');
    setNewInstallerName('');
    setIsAddingInstaller(false);
    setInstallationDate(sale.installationDate || '');
    setPaymentStatus(sale.paymentStatus || 'Não paga');
    setPaymentForecastDate(sale.paymentForecastDate || '');
    setPartialPaidAmount(sale.partialPaidAmount || 0);
    setInstallationStatus(sale.installationStatus || (sale.installationDate ? 'Agendada' : 'Sem data definida'));
    setInstallationNotes(sale.installationNotes || '');
    setDiscount(sale.discount || 0);
    setInternalNotes(sale.internalNotes || '');
    setSaleStatus(sale.status);
    setCustomCommissionPercent(sale.commissionPercent || 5);

    // Get current items for this sale
    const currentItems = saleItems.filter((it) => it.saleId === sale.id);
    setSelectedAccessoryIds(currentItems.map((it) => it.accessoryId));
    setSelectedCategory('');
    setSelectedProductId('');
    setSelectedVariationId('');
    setCatalogSearchTerm('');
    setSelectedPackageSlotKey('tapetes');
    setFilmConfiguration(sale.filmConfiguration || {});
    setIsPackageSlotModalOpen(false);
    setIsFilmConfigModalOpen(false);
    setMobileFormStep('client');

    setIsFormOpen(true);
  };

  const handleAccessoryToggle = (accessory: Accessory) => {
    const slot = getAccessoryOfferSlot(accessory);
    const isSelected = selectedAccessoryIds.includes(accessory.id);

    if (!isSelected && slot.key === GLASS_SECURITY_SLOT_KEY && configuredFilmIds.length > 0) {
      showAlert(
        'Conflito de acessórios',
        'Segurança dos vidros conflita com a película solar já configurada. Remova a película solar antes de escolher este item.'
      );
      return;
    }

    setSelectedAccessoryIds((current) => {
      if (current.includes(accessory.id)) {
        return current.filter((accId) => accId !== accessory.id);
      }

      const withoutSlotConflicts = current.filter((accId) => {
        const currentAccessory = accessories.find((candidate) => candidate.id === accId);
        if (!currentAccessory || currentAccessory.category === 'Película Solar') return false;
        return getAccessoryOfferSlot(currentAccessory).key !== slot.key;
      });

      return [...withoutSlotConflicts, accessory.id];
    });
  };

  const handleAddSelectedVariation = () => {
    if (!selectedProduct || !selectedVariation) {
      showAlert('Seleção incompleta', 'Escolha categoria, produto e variação antes de adicionar à proposta.');
      return;
    }
    const accessory = accessories.find((candidate) => candidate.id === selectedVariation.id);
    if (!accessory || !isAccessoryCompatible(accessory, carModel, carVersion, carYear)) {
      showAlert('Incompatível', 'Esta variação não é compatível com o Tiggo selecionado.');
      return;
    }
    if (selectedAccessoryIds.includes(selectedVariation.id)) {
      showAlert('Item já adicionado', 'Esta variação já está na proposta.');
      return;
    }
    setSelectedAccessoryIds((current) => [...current, selectedVariation.id]);
    setSelectedProductId('');
    setSelectedVariationId('');
  };

  const handleAddVariationToProposal = (variationId: string) => {
    const accessory = accessories.find((candidate) => candidate.id === variationId);
    if (!accessory || !isAccessoryCompatible(accessory, carModel, carVersion, carYear)) {
      showAlert('Incompatível', 'Esta variação não é compatível com o veículo selecionado.');
      return false;
    }
    const packageSlot = getCommercialSlotForAccessory(accessory);
    if (packageSlot.key === 'vidros' && configuredFilmIds.length > 0) {
      showAlert(
        'Conflito de acessórios',
        'Vidros e antivandalismo conflitam com a película solar já configurada. Remova a película antes de escolher este slot.'
      );
      return false;
    }
    if (selectedAccessoryIds.includes(variationId)) {
      showAlert('Item já adicionado', 'Esta variação já está na proposta.');
      return false;
    }
    setSelectedAccessoryIds((current) => {
      const withoutSameSlot = current.filter((currentId) => {
        const currentAccessory = accessories.find((candidate) => candidate.id === currentId);
        if (!currentAccessory || currentAccessory.category === 'Película Solar') return true;
        return getCommercialSlotForAccessory(currentAccessory).key !== packageSlot.key;
      });
      return [...withoutSameSlot, variationId];
    });
    return true;
  };

  const handleRemovePackageSlot = (slotKey: string) => {
    if (slotKey === 'pelicula') {
      setFilmConfiguration({});
      return;
    }

    setSelectedAccessoryIds((current) =>
      current.filter((currentId) => {
        const currentAccessory = accessories.find((candidate) => candidate.id === currentId);
        if (!currentAccessory || currentAccessory.category === 'Película Solar') return true;
        return getCommercialSlotForAccessory(currentAccessory).key !== slotKey;
      })
    );
  };

  const handleAddCarSalesperson = () => {
    const name = newCarSalespersonName.trim();
    if (!name) return;

    const existingSalespeople = settings.carSalespeople || [];
    const alreadyExists = existingSalespeople.some((person) => person.toLowerCase() === name.toLowerCase());
    if (alreadyExists) {
      setCarSalespersonName(name);
      setNewCarSalespersonName('');
      setIsAddingCarSalesperson(false);
      return;
    }

    updateSettings({
      carSalespeople: [...existingSalespeople, name].sort((a, b) => a.localeCompare(b)),
    });
    setCarSalespersonName(name);
    setNewCarSalespersonName('');
    setIsAddingCarSalesperson(false);
  };

  const handleAddInstaller = () => {
    const name = newInstallerName.trim();
    if (!name) return;

    const existingInstallers = settings.installers || [];
    const alreadyExists = existingInstallers.some((installer) => installer.toLowerCase() === name.toLowerCase());
    if (alreadyExists) {
      setInstallerName(name);
      setNewInstallerName('');
      setIsAddingInstaller(false);
      return;
    }

    updateSettings({
      installers: [...existingInstallers, name].sort((a, b) => a.localeCompare(b)),
    });
    setInstallerName(name);
    setNewInstallerName('');
    setIsAddingInstaller(false);
  };

  const updateFilmGlassConfig = (
    position: FilmGlassPosition,
    field: 'baseFilmId' | 'overlayFilmId',
    value: string
  ) => {
    if (value) {
      setSelectedAccessoryIds((current) =>
        current.filter((accId) => {
          const accessory = accessories.find((candidate) => candidate.id === accId);
          return accessory ? getAccessoryOfferSlot(accessory).key !== GLASS_SECURITY_SLOT_KEY : false;
        })
      );
    }
    setFilmConfiguration((current) => ({
      ...current,
      [position]: {
        ...(current[position] || {}),
        [field]: value || undefined,
      },
    }));
  };

  const openFilmGlassSimulator = (position: FilmGlassPosition) => {
    const config = filmConfiguration[position];
    const baseFilm = availableSolarFilmAccessories.find((film) => film.id === config?.baseFilmId);
    const overlayFilm = availableSolarFilmAccessories.find((film) => film.id === config?.overlayFilmId);
    const positionLabel = FILM_GLASS_POSITIONS.find((item) => item.key === position)?.label || 'Vidro';

    if (!baseFilm && !overlayFilm) {
      showAlert('Selecione uma película', `Escolha pelo menos uma película para ${positionLabel} antes de visualizar.`);
      return;
    }

    setSimulatorConfig({
      title: `Visualização do Insulfilm · ${positionLabel}`,
      baseFilm: baseFilm || overlayFilm,
      overlayFilm: baseFilm ? overlayFilm : undefined,
    });
  };

  const handleInstallationDateChange = (value: string) => {
    setInstallationDate(value);
    if (!value) {
      setInstallationStatus('Sem data definida');
      return;
    }
    if (installationStatus === 'Sem data definida') {
      setInstallationStatus('Agendada');
    }
  };

  const handlePaymentStatusChange = (value: PaymentStatus) => {
    setPaymentStatus(value);
    if (value !== 'Pagamento previsto') setPaymentForecastDate('');
    if (value !== 'Paga parcialmente') setPartialPaidAmount(0);
  };

  const renderFilmConfigurationPanel = () => (
    <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h5 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#002C5F]">
            <Layers className="h-3.5 w-3.5" />
            Insulfilm por vidro
          </h5>
          <p className="text-[10px] font-semibold text-slate-500">
            Escolha a película principal e a composição por cima em cada vidro.
          </p>
        </div>
        <span className="rounded-full border border-blue-100 bg-white px-2 py-0.5 text-[9px] font-bold text-slate-500">
          {availableSolarFilmAccessories.length} opções
        </span>
      </div>

      <div className="space-y-2">
        {availableSolarFilmAccessories.length === 0 && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-[10px] font-semibold text-amber-800">
            Nenhuma película solar compatível encontrada para o modelo/versão/ano selecionado.
          </div>
        )}
        {FILM_GLASS_POSITIONS.map((position) => {
          const config = filmConfiguration[position.key] || {};
          const hasSelection = Boolean(config.baseFilmId || config.overlayFilmId);

          return (
            <div key={position.key} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-800">{position.label}</div>
                  <div className="text-[10px] font-medium text-slate-400">{position.hint}</div>
                </div>
                <button
                  type="button"
                  onClick={() => openFilmGlassSimulator(position.key)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all ${
                    hasSelection
                      ? 'border-blue-100 bg-blue-50 text-[#002C5F] hover:bg-blue-100'
                      : 'border-slate-200 bg-slate-50 text-slate-400'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Visualizar
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Principal
                  </label>
                  <select
                    value={config.baseFilmId || ''}
                    onChange={(e) => updateFilmGlassConfig(position.key, 'baseFilmId', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-[11px] font-bold text-slate-700"
                  >
                    <option value="">Sem película</option>
                    {availableSolarFilmAccessories.map((film) => (
                      <option key={film.id} value={film.id}>
                        {film.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Composição
                  </label>
                  <select
                    value={config.overlayFilmId || ''}
                    onChange={(e) => updateFilmGlassConfig(position.key, 'overlayFilmId', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-[11px] font-bold text-slate-700"
                  >
                    <option value="">Sem composição</option>
                    {availableSolarFilmAccessories.map((film) => (
                      <option key={film.id} value={film.id}>
                        {film.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const handleSaveSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim()) {
       showAlert('Campos Obrigatórios', 'Nome do cliente e telefone de contato são obrigatórios para registrar uma proposta.');
       return;
    }
    if (!isClientPhoneValid) {
      showAlert('Telefone Inválido', 'Informe o WhatsApp no padrão +55 (11) 99999-8888 antes de registrar a proposta.');
      return;
    }

    // Build the list of chosen items structure
    const itemsPayload = proposalAccessoryIds.reduce<Omit<SaleItem, 'id' | 'saleId'>[]>((payload, id) => {
        const acc = accessories.find((a) => a.id === id);
        if (!acc) return payload;
        payload.push({
          accessoryId: acc.id,
          productId: acc.attributes?.productId ? String(acc.attributes.productId) : undefined,
          variationId: acc.attributes?.variationId ? String(acc.attributes.variationId) : acc.id,
          vehicleModel: carModel,
          productName: acc.attributes?.productName ? String(acc.attributes.productName) : acc.name,
          variationName: acc.attributes?.variationName ? String(acc.attributes.variationName) : undefined,
          description: acc.description,
          timeEstimate: acc.timeEstimate,
          name: acc.name,
          price: acc.price,
        });
        return payload;
      }, []);
    const normalizedFilmConfiguration: FilmConfiguration = {};
    FILM_GLASS_POSITIONS.forEach((position) => {
      const config = filmConfiguration[position.key];
      const baseFilmId = config?.baseFilmId && availableSolarFilmIds.includes(config.baseFilmId) ? config.baseFilmId : undefined;
      const overlayFilmId = config?.overlayFilmId && availableSolarFilmIds.includes(config.overlayFilmId) ? config.overlayFilmId : undefined;
      if (baseFilmId || overlayFilmId) {
        normalizedFilmConfiguration[position.key] = { baseFilmId, overlayFilmId };
      }
    });

    const salePayload = {
      clientName,
      clientPhone: formatPhoneInput(clientPhone),
      carModel,
      carVersion,
      carYear,
      carSalespersonName,
      installerName,
      installationDate,
      paymentStatus,
      paymentForecastDate: paymentStatus === 'Pagamento previsto' ? paymentForecastDate : '',
      partialPaidAmount: paymentStatus === 'Paga parcialmente' ? partialPaidAmount : 0,
      installationStatus,
      installationNotes,
      discount,
      subtotal: calculatedSubtotal,
      total: calculatedTotal,
      status: pipelineAutomation.status,
      internalNotes,
      filmConfiguration: Object.keys(normalizedFilmConfiguration).length > 0 ? normalizedFilmConfiguration : undefined,
    };

    if (editingSale) {
      updateSaleDetails(
        editingSale.id,
        {
          ...salePayload,
          commissionPercent: customCommissionPercent,
        },
        itemsPayload
      );
    } else {
      createSale(salePayload, itemsPayload);
    }

    setIsFormOpen(false);
  };

  const getSaleFilteredItems = (saleId: string) => {
    return saleItems.filter((item) => item.saleId === saleId);
  };

  const goMobileFormStep = (step: 'client' | 'accessories' | 'review') => {
    setMobileFormStep(step);
    requestAnimationFrame(() => {
      document.getElementById(`sale-step-${step}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };

  // Cascade references for form selection
  const currentModelObj = carModels.find((m) => m.name === carModel);
  const activeVersionsList = currentModelObj?.versions || [];
  const currentVersionObj = activeVersionsList.find((v) => v.name === carVersion);
  const activeYearsList = currentVersionObj?.years || [];
  const vehicleChecklistPages = useMemo(
    () =>
      carModel && carVersion && carYear
        ? buildAccessoryChecklistPages(products, [{ model: carModel, version: carVersion, year: carYear }])
        : [],
    [carModel, carVersion, carYear, products]
  );
  const openVehicleChecklistPrint = () => {
    if (!carModel || !carVersion || !carYear) {
      showAlert('Veículo incompleto', 'Selecione modelo, versão e ano para imprimir só o checklist do carro do cliente.');
      return;
    }
    setIsVehicleChecklistPrintOpen(true);
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in relative text-slate-800">
      <MobilePageHeader
        title="Minhas Vendas"
        description="Criar proposta, acompanhar agenda e fechar acessórios."
        actionLabel="Nova proposta"
        actionIcon={<Plus className="h-4 w-4" />}
        onAction={() => handleOpenCreate()}
      />

      <div className="hidden md:flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-3xl font-display font-medium tracking-tight text-slate-800">
            Minhas Vendas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Lance novas propostas, adicione acessórios compatíveis e emita propostas impressas para fechamento.
          </p>
        </div>
        <button
          onClick={() => handleOpenCreate()}
          className="bg-blue-900 hover:bg-blue-950 text-white font-medium text-sm px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Nova Proposta / Venda
        </button>
      </div>

      {/* Tables filter controls */}
      <div className="md:hidden space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative">
          <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cliente, telefone ou modelo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold text-slate-700 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowMobileFilters(true)}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 text-xs font-black uppercase tracking-wide text-[#002C5F]"
        >
          <Filter className="h-4 w-4" />
          Etapa: {statusFilter === 'Todos' ? 'Todas' : statusFilter}
        </button>
      </div>

      <MobileFilterSheet title="Filtros de vendas" open={showMobileFilters} onClose={() => setShowMobileFilters(false)}>
        <label className="space-y-2 text-xs font-black uppercase tracking-wide text-slate-500">
          <span>Etapa comercial</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold normal-case tracking-normal text-slate-700"
          >
            <option value="Todos">Todas as Etapas</option>
            <option value="Novo cliente">Novo Cliente</option>
            <option value="Orçamento enviado">Orçamento Enviado</option>
            <option value="Aprovado">Aprovado</option>
            <option value="Aguardando instalação">Aguardando Instalação</option>
            <option value="Pronto para entrega">Pronto para Entrega</option>
            <option value="Entregue">Entregues</option>
            <option value="Perdido">Perdidos</option>
          </select>
        </label>
      </MobileFilterSheet>

      <div className="hidden md:flex bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex-col md:flex-row gap-4 items-center">
        {/* Search */}
        <div className="w-full md:flex-1 relative">
          <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, telefone ou modelo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white text-slate-700"
          />
        </div>

        {/* Status filter */}
        <div className="w-full md:w-auto flex items-center gap-2">
          <label className="text-xs text-slate-500 font-semibold shrink-0">Etapa Comercial:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none w-full md:w-48 text-slate-700 font-medium"
          >
            <option value="Todos">Todas as Etapas</option>
            <option value="Novo cliente">Novo Cliente</option>
            <option value="Orçamento enviado">Orçamento Enviado</option>
            <option value="Aprovado">Aprovado</option>
            <option value="Aguardando instalação">Aguardando Instalação</option>
            <option value="Pronto para entrega">Pronto para Entrega</option>
            <option value="Entregue">Entregues</option>
            <option value="Perdido">Perdidos</option>
          </select>
        </div>
      </div>

      <div className="md:hidden space-y-3">
        {filteredSales.length > 0 ? filteredSales.map((sale) => {
          const itemsCount = getSaleFilteredItems(sale.id).length;
          const radar = getInstallationRadar(sale, getSimulatedToday());
          const effectiveInstallationStatus = getEffectiveInstallationStatus(sale, getSimulatedToday());
          const paymentSignal = getPaymentSignal(sale, radar, getSimulatedToday());
          const tone = sale.status === 'Perdido'
            ? 'red'
            : paymentSignal.critical || radar.level === 'red'
              ? 'amber'
              : 'default';

          return (
            <MobileEntityCard key={sale.id} tone={tone}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-slate-900">{sale.clientName}</div>
                  <div className="mt-1 text-[11px] font-bold text-[#002C5F]">
                    {sale.carModel} {sale.carVersion ? `· ${sale.carVersion}` : ''} {sale.carYear ? `· ${sale.carYear}` : ''}
                  </div>
                  <div className="mt-1 font-mono text-[11px] font-semibold text-slate-400">{sale.clientPhone}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-black text-[#002C5F]">
                    {sale.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <div className="mt-1 text-[10px] font-black uppercase text-slate-400">{itemsCount} item(ns)</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-black uppercase text-slate-600">
                  {sale.status}
                </span>
                <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${radar.badgeClass}`}>
                  {formatDateBR(sale.installationDate)} · {effectiveInstallationStatus}
                </span>
                <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${paymentSignal.badgeClass}`}>
                  {paymentSignal.label}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(sale)}
                  className="rounded-xl bg-[#002C5F] px-3 py-2.5 text-[10px] font-black uppercase text-white"
                >
                  Ver e editar
                </button>
                <button
                  type="button"
                  onClick={() => setPrintingSale(sale)}
                  className="rounded-xl border border-slate-200 bg-white p-2.5 text-[#002C5F]"
                  title="Imprimir proposta"
                >
                  <Printer className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    showConfirm(
                      'Excluir Oportunidade',
                      `Tem certeza que deseja apagar permanentemente a proposta/venda de ${sale.clientName}? Todos os itens, follow-ups e histórico correspondentes serão excluídos do sistema.`,
                      () => deleteSale(sale.id)
                    );
                  }}
                  className="rounded-xl border border-red-100 bg-red-50 p-2.5 text-red-600"
                  title="Excluir proposta"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </MobileEntityCard>
          );
        }) : (
          <MobileEntityCard className="text-center">
            <FileText className="mx-auto h-8 w-8 text-slate-300" />
            <div className="mt-2 text-xs font-black uppercase tracking-wide text-slate-500">Nenhuma proposta cadastrada</div>
            <button
              type="button"
              onClick={() => handleOpenCreate()}
              className="mt-3 w-full rounded-xl bg-[#002C5F] px-4 py-3 text-xs font-black uppercase text-white"
            >
              Criar primeira proposta
            </button>
          </MobileEntityCard>
        )}
      </div>

      {/* Main Grid: list of sales */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {filteredSales.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                  <th className="p-4">Cliente / Contato</th>
                  <th className="p-4">Veículo</th>
                  <th className="p-4">Itens</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Fase Atual</th>
                  <th className="p-4">Agenda</th>
                  <th className="p-4 text-center font-bold">Imprimir</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSales.map((sale) => {
                  const itemsCount = getSaleFilteredItems(sale.id).length;

                  let styleClass = 'bg-slate-100 text-slate-700';
                  if (sale.status === 'Aprovado') styleClass = 'bg-green-150 text-green-800 font-medium';
                  else if (sale.status === 'Orçamento enviado') styleClass = 'bg-purple-100 text-purple-800';
                  else if (sale.status === 'Aguardando instalação') styleClass = 'bg-amber-100 text-amber-800';
                  else if (sale.status === 'Pronto para entrega') styleClass = 'bg-indigo-100 text-indigo-800';
                  else if (sale.status === 'Entregue') styleClass = 'bg-teal-100 text-teal-800';
                  else if (sale.status === 'Perdido') styleClass = 'bg-rose-100 text-rose-800';

                  const radar = getInstallationRadar(sale, getSimulatedToday());
                  const effectiveInstallationStatus = getEffectiveInstallationStatus(sale, getSimulatedToday());
                  const paymentSignal = getPaymentSignal(sale, radar, getSimulatedToday());

                  return (
                    <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-slate-800">{sale.clientName}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{sale.clientPhone}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-blue-900">{sale.carModel}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {sale.carVersion} ({sale.carYear})
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-semibold bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
                          {itemsCount} {itemsCount === 1 ? 'item' : 'itens'}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-800">
                        {sale.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="p-4">
                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${styleClass}`}>
                          {sale.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1.5 min-w-[150px]">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${radar.badgeClass}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${radar.dotClass}`} />
                            {formatDateBR(sale.installationDate)}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-600">
                              {effectiveInstallationStatus}
                            </span>
                            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${paymentSignal.badgeClass}`}>
                              {paymentSignal.label}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => setPrintingSale(sale)}
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-600 border border-slate-200"
                          title="Imprimir visualizador de proposta original"
                        >
                          <Printer className="w-4 h-4 text-blue-900" />
                        </button>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(sale)}
                            className="bg-blue-50 text-blue-900 hover:bg-blue-100 font-semibold px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all"
                          >
                            Ver e Editar
                          </button>
                          <button
                            onClick={() => {
                              showConfirm(
                                'Excluir Oportunidade',
                                `Tem certeza que deseja apagar permanentemente a proposta/venda de ${sale.clientName}? Todos os itens, follow-ups e histórico correspondentes serão excluídos do sistema.`,
                                () => deleteSale(sale.id)
                              );
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-650 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-all cursor-pointer"
                            title="Excluir Oportunidade / Cliente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400">
            Nenhuma proposta cadastrada para esta pesquisa.
          </div>
        )}
      </div>

      {/* Sale Creator Modal Overlay */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-start justify-center p-0 md:p-2 z-[70] animate-fade-in no-print overflow-y-auto">
          <div className="bg-white rounded-none md:rounded-2xl w-full max-w-[min(1500px,calc(100vw-12px))] h-[100dvh] max-h-[100dvh] md:h-auto md:max-h-[calc(100vh-0.75rem)] p-3 pb-0 md:p-5 shadow-xl border border-slate-100 space-y-4 md:my-1.5 overflow-y-auto">
            <div className="sticky top-0 z-20 -mx-3 -mt-3 bg-white px-3 pt-3 md:static md:m-0 md:p-0">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base md:text-xl font-display font-bold text-slate-800">
                {editingSale ? `Proposta Comercial de Acessórios • ${clientName}` : 'Nova Oportunidade / Proposta'}
                </h3>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-2.5 py-1 rounded"
                >
                  X
                </button>
              </div>
              <div className="md:hidden grid grid-cols-3 gap-1.5 border-b border-slate-100 py-2">
                {[
                  ['client', 'Cliente'],
                  ['accessories', 'Acessórios'],
                  ['review', 'Revisão'],
                ].map(([step, label]) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => goMobileFormStep(step as 'client' | 'accessories' | 'review')}
                    className={`rounded-xl px-2 py-2 text-[10px] font-black uppercase ${
                      mobileFormStep === step ? 'bg-[#002C5F] text-white' : 'bg-slate-50 text-slate-500'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveSale} className="space-y-6 pb-3 md:pb-0 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Client data section */}
                <div id="sale-step-client" className="space-y-4 scroll-mt-24">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-l-2 border-blue-900 pl-2">
                    Informações do Cliente e Concessionária
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Nome do Cliente *</label>
                      <input
                        type="text"
                        required
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Ex. Roberto da Silva"
                        className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 text-xs text-slate-700"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">WhatsApp / Telefone *</label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <input
                            type="tel"
                            required
                            value={clientPhone}
                            onChange={(e) => setClientPhone(formatPhoneInput(e.target.value))}
                            placeholder="+55 (11) 99999-8888"
                            maxLength={19}
                            className={`w-full p-2.5 border rounded-xl focus:outline-none text-xs text-slate-700 font-mono ${
                              clientPhone && !isClientPhoneValid
                                ? 'border-red-300 focus:border-red-500 bg-red-50/40'
                                : isClientPhoneValid
                                  ? 'border-emerald-300 focus:border-emerald-500 bg-emerald-50/30'
                                  : 'border-slate-200 focus:border-slate-400'
                            }`}
                            aria-invalid={clientPhone ? !isClientPhoneValid : undefined}
                          />
                          {clientPhone && !isClientPhoneValid && (
                            <span className="text-[10px] text-red-600 font-semibold mt-1 block">
                              Complete no padrão +55 (11) 99999-8888
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={!whatsappUrl}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!whatsappUrl) return;
                            window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
                          }}
                          className={`h-[38px] w-10 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
                            whatsappUrl
                              ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                              : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                          }`}
                          title={whatsappUrl ? 'Abrir WhatsApp do cliente' : 'Informe um telefone válido para abrir WhatsApp'}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-slate-700">
                        Vendedor que vendeu o carro
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsAddingCarSalesperson((value) => !value)}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#002C5F] hover:bg-blue-100"
                      >
                        <Plus className="h-3 w-3" />
                        Adicionar
                      </button>
                    </div>
                    <div>
                      <select
                        value={carSalespersonName}
                        onChange={(e) => setCarSalespersonName(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none text-xs text-slate-700 font-bold"
                      >
                        <option value="">Selecionar vendedor</option>
                        {(settings.carSalespeople || []).map((person) => (
                          <option key={person} value={person}>
                            {person}
                          </option>
                        ))}
                      </select>
                    </div>

                    {isAddingCarSalesperson && (
                      <div className="flex gap-2">
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
                          placeholder="Nome do vendedor"
                          className="flex-1 p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 text-xs text-slate-700"
                        />
                        <button
                          type="button"
                          onClick={handleAddCarSalesperson}
                          className="rounded-xl bg-[#002C5F] px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                        >
                          Salvar
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* 1. Model selection */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Modelo Carro *</label>
                      <select
                        value={carModel}
                        onChange={(e) => {
                          const mVal = e.target.value;
                          setCarModel(mVal);
                          const mObj = carModels.find((m) => m.name === mVal);
                          const defaultVer = mObj?.versions[0]?.name || '';
                          setCarVersion(defaultVer);
                          const vObj = mObj?.versions.find((v) => v.name === defaultVer);
                          const defaultYear = vObj?.years[0] || '';
                          setCarYear(defaultYear);
                        }}
                        className="w-full p-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none text-xs text-slate-700 font-bold"
                      >
                        {carModels.map((m) => (
                          <option key={m.id} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 2. Version selection */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Versão *</label>
                      <select
                        value={carVersion}
                        onChange={(e) => {
                          const vVal = e.target.value;
                          setCarVersion(vVal);
                          const vObj = activeVersionsList.find((v) => v.name === vVal);
                          const defaultYear = vObj?.years[0] || '';
                          setCarYear(defaultYear);
                        }}
                        className="w-full p-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none text-xs text-slate-700 font-medium"
                      >
                        <option value="">Geral / Sem Versão</option>
                        {activeVersionsList.map((v) => (
                          <option key={v.name} value={v.name}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 3. Year selection */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Ano Faturamento *</label>
                      <select
                        value={carYear}
                        onChange={(e) => setCarYear(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none text-xs text-slate-700 font-mono font-bold"
                      >
                        <option value="">Geral / Sem Ano</option>
                        {activeYearsList.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={openVehicleChecklistPrint}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-[#002C5F] hover:bg-blue-100"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir checklist deste carro
                  </button>

                  <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h5 className="text-xs font-bold uppercase tracking-widest text-[#002C5F]">
                          Instalação
                        </h5>
                        <p className="text-[10px] font-semibold text-slate-500">
                          Técnico, agenda e status operacional da instalação.
                        </p>
                      </div>
                      <span className="rounded-full border border-blue-100 bg-white px-2 py-0.5 text-[9px] font-black uppercase text-slate-500">
                        Agenda
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Instalador Técnico / Montadora
                          </label>
                          <button
                            type="button"
                            onClick={() => setIsAddingInstaller((value) => !value)}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-100 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#002C5F] hover:bg-blue-50"
                          >
                            <Plus className="h-3 w-3" />
                            Adicionar
                          </button>
                        </div>
                        <select
                          value={installerName}
                          onChange={(e) => setInstallerName(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700 focus:border-slate-400 focus:outline-none"
                        >
                          <option value="">Selecionar instalador</option>
                          {(settings.installers || []).map((installer) => (
                            <option key={installer} value={installer}>
                              {installer}
                            </option>
                          ))}
                        </select>
                        {isAddingInstaller && (
                          <div className="flex gap-2">
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
                              placeholder="Nome do instalador"
                              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-700 focus:border-slate-400 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleAddInstaller}
                              className="rounded-xl bg-[#002C5F] px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                            >
                              Salvar
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Previsão Entrega Instalação</label>
                        <input
                          type="date"
                          value={installationDate}
                          onChange={(e) => handleInstallationDateChange(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-mono text-slate-700 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          Status instalação
                        </label>
                        <select
                          value={installationStatus}
                          onChange={(e) => setInstallationStatus(e.target.value as InstallationStatus)}
                          className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700 focus:outline-none"
                        >
                          {INSTALLATION_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Observações de instalação
                      </label>
                      <textarea
                        value={installationNotes}
                        onChange={(e) => setInstallationNotes(e.target.value)}
                        placeholder="Peças pendentes, horário combinado, restrições da oficina..."
                        rows={2}
                        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-700 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 space-y-3">
                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-widest text-emerald-900">
                        Pagamento
                      </h5>
                      <p className="text-[10px] font-semibold text-slate-500">
                        Controle financeiro separado da agenda de instalação.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          Status pagamento
                        </label>
                        <select
                          value={paymentStatus}
                          onChange={(e) => handlePaymentStatusChange(e.target.value as PaymentStatus)}
                          className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700 focus:outline-none"
                        >
                          {PAYMENT_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>

                      {paymentStatus === 'Pagamento previsto' && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Previsão pagamento
                          </label>
                          <input
                            type="date"
                            value={paymentForecastDate}
                            onChange={(e) => setPaymentForecastDate(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-mono text-slate-700 focus:outline-none"
                          />
                        </div>
                      )}

                      {paymentStatus === 'Paga parcialmente' && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Valor parcial pago
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={partialPaidAmount}
                            onChange={(e) => setPartialPaidAmount(Math.max(0, Number(e.target.value)))}
                            className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-mono text-slate-700 focus:outline-none"
                          />
                          <span className="block text-[10px] font-bold text-slate-500">
                            Restante: {remainingAfterPartialPayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Observações de Negociação Interna</label>
                    <textarea
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      placeholder="Espaço para histórico interno sobre descontos, agendamentos..."
                      rows={2}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 text-xs text-slate-700 font-sans"
                    />
                  </div>

                  {editingSale && (
                    <div className="border border-indigo-100 bg-indigo-50/20 p-3.5 rounded-xl space-y-2.5">
                      <div className="text-xs font-bold text-indigo-900">Configurações de Fluxo Comercial</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                        <div>
                          <label className="text-slate-500 block mb-1">Mudar Funil Comercial:</label>
                          <select
                            value={saleStatus}
                            onChange={(e) => setSaleStatus(e.target.value as SalesStatus)}
                            className="bg-white border text-xs border-slate-200 p-2.5 w-full rounded-xl focus:outline-none font-semibold text-slate-700"
                          >
                            <option value="Novo cliente">Novo Cliente</option>
                            <option value="Orçamento enviado">Orçamento Enviado</option>
                            <option value="Aprovado">Aprovado</option>
                            <option value="Aguardando instalação">Aguardando Instalação</option>
                            <option value="Pronto para entrega">Pronto para Entrega</option>
                            <option value="Entregue">Entregues</option>
                            <option value="Perdido">Perdidos</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-slate-500 block mb-1">Minha comissão modificada (%):</label>
                          <input
                            type="number"
                            step="0.1"
                            value={customCommissionPercent}
                            onChange={(e) => setCustomCommissionPercent(Number(e.target.value))}
                            className="bg-white border text-xs border-slate-200 p-2.5 w-full rounded-xl focus:outline-none font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Product catalogue selection with automatic compatibility filters */}
                <div id="sale-step-accessories" className="space-y-4 scroll-mt-24">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1 flex-wrap gap-1">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-l-2 border-blue-900 pl-2">
                      Catálogo compatível com {carModel}
                    </h4>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono">
                        {activePackageSlotCount} slots
                      </span>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-mono border border-emerald-100">
                        {filledPackageSlotCount} preenchidos
                      </span>
                      <span className="text-[10px] bg-blue-50 text-blue-800 px-2 py-0.5 rounded font-mono border border-blue-100">
                        {calculatedSubtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4">
                      {packageSlotCards.map((slot) => {
                        const Icon = slot.icon;
                        const tone = COMMERCIAL_SLOT_TONES[slot.accent] || COMMERCIAL_SLOT_TONES.slate;
                        const statusTone = COMMERCIAL_SLOT_STATUS_TONES[slot.status];
                        const selectedPrice = slot.selectedAccessories.reduce((sum, accessory) => sum + accessory.price, 0);
                        const selectedLabel = slot.isFilmSlot && configuredFilmGlassCount > 0
                          ? `${configuredFilmGlassCount} vidro(s)`
                          : slot.selectedAccessory?.name;

                        return (
                          <div
                            key={slot.key}
                            className={`flex min-h-[168px] flex-col rounded-xl border transition-all ${statusTone.card} hover:shadow-sm`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (slot.isFilmSlot) {
                                  setIsFilmConfigModalOpen(true);
                                  return;
                                }
                                setSelectedPackageSlotKey(slot.key);
                                setCatalogSearchTerm('');
                                setIsPackageSlotModalOpen(true);
                              }}
                              className="flex min-h-0 flex-1 flex-col p-2.5 text-left"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${tone.icon}`}>
                                  <Icon className="h-4 w-4" />
                                </span>
                                <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase ${statusTone.badge}`}>
                                  {statusTone.label}
                                </span>
                              </div>
                              <div className="mt-2 flex-1">
                                <div className="text-xs font-black leading-tight text-slate-900">{slot.title}</div>
                                <div className="mt-0.5 text-[10px] font-semibold leading-snug text-slate-400">{slot.description}</div>
                                {selectedLabel ? (
                                  <div className="mt-1.5">
                                    <div className="line-clamp-1 text-[10px] font-bold text-slate-700">{selectedLabel}</div>
                                    <div className="font-mono text-[10px] font-black text-blue-900">
                                      {selectedPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-1.5 text-[10px] font-black uppercase text-slate-400">
                                    + {slot.title}
                                  </div>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span className="rounded-full border border-white/70 bg-white/70 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-500">
                                  {slot.optionCount} opção(ns)
                                </span>
                                {slot.required && slot.selectedAccessories.length === 0 && (
                                  <span className="rounded-full border border-red-100 bg-white/70 px-1.5 py-0.5 text-[9px] font-black uppercase text-red-700">
                                    falta
                                  </span>
                                )}
                              </div>
                            </button>
                            {slot.selectedAccessories.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 border-t border-white/60 px-2.5 py-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (slot.isFilmSlot) {
                                      setIsFilmConfigModalOpen(true);
                                      return;
                                    }
                                    setSelectedPackageSlotKey(slot.key);
                                    setIsPackageSlotModalOpen(true);
                                  }}
                                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-black uppercase text-slate-600 hover:bg-slate-50"
                                >
                                  Trocar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePackageSlot(slot.key)}
                                  className="rounded-lg border border-rose-100 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                                  title={`Remover ${slot.title}`}
                                >
                                  <Trash className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="rounded-xl border border-slate-150 bg-slate-50/70 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wide">
                        <span className="rounded-full border border-red-100 bg-red-50 px-2 py-1 text-red-700">
                          Vermelho: obrigatório sem configurar
                        </span>
                        <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-1 text-amber-700">
                          Amarelo: opcional
                        </span>
                        <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 text-emerald-700">
                          Verde: configurado
                        </span>
                      </div>
                    </div>

                    {proposalAccessoryIds.length > 0 ? (
                      <div className="overflow-hidden rounded-xl border border-slate-150 bg-slate-50">
                        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-3 py-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Slots preenchidos
                          </span>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                            {filledPackageSlotCount} slot(s), {proposalAccessoryIds.length} item(ns)
                          </span>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {packageSlotCards
                            .filter((slot) => slot.selectedAccessories.length > 0)
                            .map((slot) => {
                              const Icon = slot.icon;
                              const tone = COMMERCIAL_SLOT_TONES[slot.accent] || COMMERCIAL_SLOT_TONES.slate;
                              const slotTotal = slot.selectedAccessories.reduce((sum, accessory) => sum + accessory.price, 0);
                              return (
                                <div key={slot.key} className="flex items-center justify-between gap-3 p-3">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${tone.icon}`}>
                                      <Icon className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0">
                                      <div className="text-xs font-black text-slate-800">{slot.title}</div>
                                      <div className="text-[10px] font-semibold text-slate-400 line-clamp-1">
                                        {slot.isFilmSlot
                                          ? `${configuredFilmGlassCount} vidro(s), ${slot.selectedAccessories.length} produto(s)`
                                          : slot.selectedAccessory?.name}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-slate-700">
                                      {slotTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (slot.isFilmSlot) {
                                          setIsFilmConfigModalOpen(true);
                                          return;
                                        }
                                        setSelectedPackageSlotKey(slot.key);
                                      }}
                                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-black uppercase text-slate-600 hover:bg-slate-50"
                                    >
                                      Trocar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePackageSlot(slot.key)}
                                      className="rounded-lg border border-rose-100 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                                      title={`Remover ${slot.title}`}
                                    >
                                      <Trash className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs font-bold text-slate-400">
                        Nenhum slot preenchido na proposta.
                      </div>
                    )}
                  </div>

                  {/* Financial calculation box */}
                  <div id="sale-step-review" className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-3.5 scroll-mt-24">
                    <div className="text-xs font-bold text-slate-800 uppercase tracking-widest">
                      Resumo Financeiro da Proposta
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Subtotal dos itens selecionados:</span>
                        <span className="font-bold font-mono">
                          {calculatedSubtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Desconto aplicado:</span>
                        <div className="flex items-center gap-1 w-28 text-xs font-mono font-bold">
                          <span className="text-slate-400">R$</span>
                          <input
                            type="number"
                            min="0"
                            max={calculatedSubtotal}
                            value={discount || ''}
                            onChange={(e) => setDiscount(Number(e.target.value))}
                            className="w-full p-1 border border-slate-300 bg-white rounded text-center text-xs"
                          />
                        </div>
                      </div>

                      <div className="border-t border-slate-150 pt-2.5 flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-800">Total Líquido do Cliente:</span>
                        <span className="font-mono text-base font-bold text-blue-900">
                          {calculatedTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span>Tempo Total Montagem:</span>
                        <span>{formattedHours}h {formattedMinutes}m</span>
                      </div>

                      <div className="space-y-1 border-t border-dashed border-slate-250 pt-2 text-[10px] text-emerald-800">
                        <div className="flex justify-between items-center">
                          <span>Comissão fixa ({customCommissionPercent}%):</span>
                          <span className="font-mono font-bold">
                            {previewCommission.baseAmount.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Bônus por produtos:</span>
                          <span className="font-mono font-bold">
                            {previewCommission.productBonusAmount.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Extra por meta:</span>
                          <span className="font-mono font-bold">
                            {(previewCommission.goalBonusAmount + previewCommission.goalExtraAmount).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs font-bold border-t border-slate-200 pt-2 text-emerald-900">
                        <span>Minha Comissão Estimada:</span>
                        <span className="font-mono font-bold">
                          {previewCommission.commissionAmount.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50/35 p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#002C5F]">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Kanban automático
                        </div>
                        <div className="mt-1 text-xs font-bold text-slate-800">
                          Ao salvar: <span className="text-[#002C5F]">{pipelineAutomation.status}</span>
                        </div>
                        <p className="mt-1 text-[10px] font-semibold leading-relaxed text-slate-500">
                          {pipelineAutomation.trigger} Próximo passo: {pipelineAutomation.nextAction}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-blue-100 bg-white px-2.5 py-1 text-[10px] font-black uppercase text-blue-900">
                        {pipelineAutomation.locked ? 'Manual' : `${pipelineAutomation.progress}%`}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white border border-blue-100">
                      <div
                        className="h-full rounded-full bg-[#002C5F] transition-all"
                        style={{ width: `${pipelineAutomation.progress}%` }}
                      />
                    </div>
                    {pipelineAutomation.status !== saleStatus && (
                      <div className="rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-2 text-[10px] font-bold text-amber-800">
                        Status manual atual: {saleStatus}. Automação moverá para {pipelineAutomation.status} ao salvar.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Actions bar */}
              <div className="hidden md:flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {editingSale && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPrintingSale(editingSale)}
                        className="w-full sm:w-auto bg-slate-105 hover:bg-slate-150 text-slate-700 px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer transition-all"
                      >
                        <Printer className="w-4 h-4 text-blue-900" /> Imprimir Proposta em PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          showConfirm(
                            'Excluir Oportunidade',
                            `Tem certeza que deseja apagar permanentemente a proposta/venda de ${clientName}? Todos os itens, follow-ups e histórico correspondentes serão excluídos do sistema.`,
                            () => {
                              deleteSale(editingSale.id);
                              setIsFormOpen(false);
                            }
                          );
                        }}
                        className="w-full sm:w-auto bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all font-bold"
                      >
                        <Trash2 className="w-4 h-4" /> Excluir Cliente / Proposta
                      </button>
                    </>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-medium"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto bg-blue-900 hover:bg-blue-950 text-white px-5 py-2.5 rounded-xl font-bold"
                  >
                    {editingSale ? 'Atualizar Proposta' : 'Gerar Proposta Genuína'}
                  </button>
                </div>
              </div>

              <MobileActionBar
                summary={
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-500">Total</span>
                    <span className="font-mono text-base font-black text-[#002C5F]">
                      {calculatedTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                }
              >
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase text-slate-600"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#002C5F] px-4 py-3 text-xs font-black uppercase text-white"
                >
                  {editingSale ? 'Atualizar' : 'Salvar'}
                </button>
              </MobileActionBar>
            </form>

            {/* Display timeline events and historical contact entries of sale if editing */}
            {editingSale && (
              <div className="border-t border-slate-100 pt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* timeline / follow-ups list */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Follow-ups Agendados
                  </h5>
                  <div className="space-y-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100 max-h-48 overflow-y-auto">
                    {followups.filter((f) => f.saleId === editingSale.id).length > 0 ? (
                      followups
                        .filter((f) => f.saleId === editingSale.id)
                        .map((f) => (
                          <div key={f.id} className="bg-white p-2.5 rounded-lg border border-slate-100 text-xs flex items-center justify-between">
                            <div>
                              <div className="font-semibold flex items-center gap-1.5">
                                <span>{f.type}</span>
                                <span className={`text-[9px] px-1.5 rounded uppercase font-bold ${
                                  f.status === 'Feito' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {f.status}
                                </span>
                              </div>
                              <p className="text-slate-500 mt-1 text-[11px] font-sans">{f.notes}</p>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Prazo: {f.dueDate}
                            </div>
                          </div>
                        ))
                    ) : (
                      <p className="text-[11px] text-slate-400 text-center py-4">Nenhum follow-up cadastrado para este cliente.</p>
                    )}
                  </div>
                </div>

                {/* operations events / timeline history */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Linha do Tempo de Eventos (Histórico)
                  </h5>
                  <div className="space-y-2.5 bg-slate-50/50 p-3 rounded-xl border border-slate-100 max-h-48 overflow-y-auto">
                    {events.filter((e) => e.saleId === editingSale.id).length > 0 ? (
                      events
                        .filter((e) => e.saleId === editingSale.id)
                        .map((evt) => (
                          <div key={evt.id} className="text-[11px] border-l border-slate-300 pl-2.5 leading-relaxed">
                            <div className="flex items-center justify-between font-semibold text-slate-700">
                              <span>{evt.type}</span>
                              <span className="text-[9px] text-slate-400">
                                {new Date(evt.createdAt).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            <p className="text-slate-500 mt-0.5">{evt.description}</p>
                            {evt.field && (
                              <div className="mt-1 rounded-lg border border-slate-200 bg-white p-2 text-[10px] text-slate-600">
                                <div className="font-bold text-slate-700">{evt.field}</div>
                                <div className="font-mono">
                                  {evt.previousValue || 'Sem valor'} → {evt.nextValue || 'Sem valor'}
                                </div>
                                <div className="mt-0.5 text-slate-400">
                                  Usuário: {evt.changedBy || 'Thayná'}
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                    ) : (
                      <p className="text-[11px] text-slate-400 text-center py-4">Nenhum evento histórico registrado.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isPackageSlotModalOpen && selectedPackageSlot && (
        <div
          className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-slate-900/55 p-2 sm:p-4 animate-fade-in overflow-y-auto"
          onClick={() => setIsPackageSlotModalOpen(false)}
        >
          <div
            className="flex max-h-[calc(100vh-1rem)] sm:max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-5 sm:py-4">
              <div className="pr-12">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                      (COMMERCIAL_SLOT_TONES[selectedPackageSlot.accent] || COMMERCIAL_SLOT_TONES.slate).icon
                    }`}>
                      {React.createElement(selectedPackageSlot.icon, { className: 'h-4 w-4' })}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black uppercase tracking-widest text-[#002C5F]">
                        {selectedPackageSlot.title}
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-500">
                        {selectedPackageSlot.description}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                      COMMERCIAL_SLOT_STATUS_TONES[selectedPackageSlot.status].badge
                    }`}>
                      {COMMERCIAL_SLOT_STATUS_TONES[selectedPackageSlot.status].label}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-500">
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                      Limite: 1 item neste espaço do carro
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                      {selectedPackageSlotProducts.reduce((sum, product) => sum + product.variations.length, 0)} opção(ns)
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPackageSlotModalOpen(false)}
                className="absolute right-3 top-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-100"
                title="Fechar"
              >
                X
              </button>
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={catalogSearchTerm}
                  onChange={(e) => setCatalogSearchTerm(e.target.value)}
                  placeholder={`Buscar em ${selectedPackageSlot.title}`}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-300"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              {selectedPackageSlotProducts.length > 0 ? (
                <div className="space-y-3">
                  {selectedPackageSlotProducts.map((product) => (
                    <div key={product.id} className="rounded-xl border border-slate-150 bg-white p-3 shadow-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h5 className="text-xs font-black leading-snug text-slate-900">{product.name}</h5>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500">
                              {product.category}
                            </span>
                          </div>
                          {product.description && (
                            <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-snug text-slate-400">
                              {product.description}
                            </p>
                          )}
                        </div>
                        <span className="w-fit shrink-0 rounded-full bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500 border border-slate-200">
                          {product.variations.length} variação(ões)
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2">
                        {product.variations.map((variation) => {
                          const alreadyAdded = selectedAccessoryIds.includes(variation.id);
                          const isReplacing = Boolean(selectedPackageSlot.selectedAccessory && !alreadyAdded);
                          const accessory = accessories.find((candidate) => candidate.id === variation.id);
                          const bonusAmount = variation.commissionBonusAmount || accessory?.commissionBonusAmount || 0;
                          const bonusPercent = variation.commissionBonusPercent || accessory?.commissionBonusPercent || 0;
                          return (
                            <div key={variation.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="text-xs font-bold leading-snug text-slate-800">{variation.name}</div>
                                  <div className="mt-1 flex flex-wrap gap-1.5 text-[9px] font-bold">
                                    {variation.sku && <span className="rounded bg-white px-1.5 py-0.5 text-slate-500">{variation.sku}</span>}
                                    <span className="rounded bg-white px-1.5 py-0.5 text-slate-500">{variation.timeEstimate} min</span>
                                    {bonusAmount > 0 && (
                                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                                        Bônus {bonusAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                      </span>
                                    )}
                                    {bonusPercent > 0 && (
                                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">
                                        Bônus {bonusPercent}%
                                      </span>
                                    )}
                                    {alreadyAdded && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">No slot</span>}
                                  </div>
                                </div>
                                <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto sm:flex-col sm:items-end">
                                  <div className="font-mono text-xs font-black text-blue-900">
                                    {variation.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (handleAddVariationToProposal(variation.id)) {
                                        setIsPackageSlotModalOpen(false);
                                      }
                                    }}
                                    disabled={alreadyAdded}
                                    className="min-w-[96px] rounded-lg bg-[#002C5F] px-3 py-2 text-[9px] font-black uppercase tracking-wide text-white hover:bg-blue-950 disabled:bg-slate-200 disabled:text-slate-400"
                                  >
                                    {alreadyAdded ? 'Adicionado' : isReplacing ? 'Trocar' : 'Adicionar'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Nenhuma opção compatível neste slot.
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    Verifique compatibilidade do veículo ou cadastro do produto.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              {selectedPackageSlot.selectedAccessory ? (
                <div className="min-w-0 text-[11px] font-semibold text-slate-500">
                  Atual: <span className="font-bold text-slate-700">{selectedPackageSlot.selectedAccessory.name}</span>
                </div>
              ) : (
                <div className="text-[11px] font-semibold text-slate-500">Nenhum item escolhido neste slot.</div>
              )}
              <button
                type="button"
                onClick={() => setIsPackageSlotModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-black uppercase text-slate-600 hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {isFilmConfigModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-slate-900/55 p-3 sm:p-4 animate-fade-in overflow-y-auto"
          onClick={() => setIsFilmConfigModalOpen(false)}
        >
          <div
            className="flex max-h-[calc(100vh-1.5rem)] sm:max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 px-5 py-4">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[#002C5F]">
                  <Layers className="h-4 w-4" />
                  Configurar Película Solar
                </h3>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                  Defina principal, composição e visualização por vidro.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFilmConfigModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-100"
                title="Fechar"
              >
                X
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              {renderFilmConfigurationPanel()}
            </div>
            <div className="flex justify-end border-t border-slate-100 bg-white px-5 py-3">
              <button
                type="button"
                onClick={() => setIsFilmConfigModalOpen(false)}
                className="rounded-xl bg-[#002C5F] px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-950"
              >
                Concluir Configuração
              </button>
            </div>
          </div>
        </div>
      )}

      {/* proposal print overlay */}
      {printingSale && (
        <ProposalPrint
          sale={printingSale}
          items={getSaleFilteredItems(printingSale.id)}
          accessories={accessories}
          onClose={() => setPrintingSale(null)}
        />
      )}

      {isVehicleChecklistPrintOpen && (
        <AccessoryChecklistPrint
          pages={vehicleChecklistPages}
          dealerName={settings.dealerName}
          clientName={clientName}
          clientWhatsapp={clientPhone}
          onClose={() => setIsVehicleChecklistPrintOpen(false)}
        />
      )}

      {simulatorConfig && (
        <FilmSimulatorModal
          films={availableSolarFilmAccessories}
          initialFilm={simulatorConfig.baseFilm}
          initialSecondFilm={simulatorConfig.overlayFilm}
          title={simulatorConfig.title}
          onClose={() => setSimulatorConfig(null)}
        />
      )}
    </div>
  );
}
