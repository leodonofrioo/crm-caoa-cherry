export type AccessoryCategory = string;

export interface Accessory {
  id: string;
  name: string;
  description: string;
  category: AccessoryCategory;
  imageUrl?: string;
  attributes?: Record<string, string | number | boolean | undefined>;
  price: number;
  commissionBonusAmount?: number;
  commissionBonusPercent?: number;
  timeEstimate: number; // in minutes
  compatibilities: string[]; // list of models like ['Tiggo 5', 'Tiggo 7']
  universal: boolean;
  active: boolean;
  compatibleModel?: string; // e.g. "TIGGO 7"
  compatibleVersion?: string; // e.g. "SPORT"
  compatibleYear?: string; // e.g. "2024"
}

export interface VehicleCompatibility {
  model: string;
  version?: string;
  year?: string;
}

export interface ProductVariation {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  attributes?: Record<string, string | number | boolean | undefined>;
  price: number;
  commissionBonusAmount?: number;
  commissionBonusPercent?: number;
  timeEstimate: number;
  compatibilities: VehicleCompatibility[];
  active: boolean;
  sku?: string;
  legacyAccessoryIds?: string[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: AccessoryCategory;
  imageUrl?: string;
  attributes?: Record<string, string | number | boolean | undefined>;
  compatibilities: VehicleCompatibility[];
  universal: boolean;
  active: boolean;
  variations: ProductVariation[];
}

export type SalesStatus =
  | 'Novo cliente'
  | 'Orçamento enviado'
  | 'Aprovado'
  | 'Aguardando instalação'
  | 'Pronto para entrega'
  | 'Entregue'
  | 'Perdido';

export type CommissionStatus = 'A receber' | 'Recebido' | 'Cancelado';
export type PaymentStatus = 'Não paga' | 'Pagamento previsto' | 'Paga parcialmente' | 'Paga' | 'Cancelada';
export type InstallationStatus =
  | 'Sem data definida'
  | 'Agendada'
  | 'Aguardando pagamento'
  | 'Aguardando peça ou acessório'
  | 'Pronta para instalar'
  | 'Em instalação'
  | 'Instalada'
  | 'Reagendada'
  | 'Cancelada'
  | 'Atrasada';

export type FilmGlassPosition = 'windshield' | 'rearGlass' | 'frontSide' | 'rearSide' | 'sunroof';

export interface FilmGlassConfig {
  baseFilmId?: string;
  overlayFilmId?: string;
}

export type FilmConfiguration = Partial<Record<FilmGlassPosition, FilmGlassConfig>>;

export interface Sale {
  id: string;
  clientName: string;
  clientPhone: string;
  carModel: string;
  carVersion: string;
  carYear: string;
  carSalespersonName?: string;
  installerName: string;
  installationDate: string;
  discount: number;
  subtotal: number;
  total: number;
  status: SalesStatus;
  lostReason?: string;
  internalNotes: string;
  createdAt: string;
  commissionPercent: number;
  commissionAmount: number;
  baseCommissionAmount?: number;
  productBonusAmount?: number;
  goalExtraAmount?: number;
  goalBonusAmount?: number;
  filmConfiguration?: FilmConfiguration;
  commissionStatus: CommissionStatus;
  commissionPaidAt: string | null;
  paymentStatus: PaymentStatus;
  paymentForecastDate?: string;
  partialPaidAmount?: number;
  installationStatus: InstallationStatus;
  installationNotes?: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  accessoryId: string;
  productId?: string;
  variationId?: string;
  vehicleModel?: string;
  productName?: string;
  variationName?: string;
  description?: string;
  timeEstimate?: number;
  name: string;
  price: number;
}

export type FollowupType = 'WhatsApp' | 'Ligação' | 'Instalação' | 'Pós-venda' | 'Outro';
export type FollowupStatus = 'Pendente' | 'Feito' | 'Sem resposta' | 'Cancelado';

export interface Followup {
  id: string;
  saleId: string;
  clientName: string;
  carModel: string;
  type: FollowupType;
  status: FollowupStatus;
  dueDate: string; // YYYY-MM-DD
  notes: string;
  createdAt: string;
}

export interface SaleEvent {
  id: string;
  saleId: string;
  type: string;
  description: string;
  createdAt: string;
  field?: string;
  previousValue?: string;
  nextValue?: string;
  changedBy?: string;
}

export interface Settings {
  commissionPercent: number;
  dealerName: string;
  targetPerClient?: number; // default R$ 2000
  monthlyStoreCarsSold?: number;
  monthlyTargetAmount?: number;
  goalBonusAmount?: number;
  goalExtraCommissionPercent?: number;
  commissionPlanVersion?: number;
  carSalespeople?: string[];
  installers?: string[];
  productCategories?: AccessoryCategory[];
}

export type CRMExportSection = 'products' | 'sales' | 'followups' | 'events' | 'settings' | 'vehicles';

export interface CRMExportPayload {
  schema: 'crm-thayna-reis-export';
  version: number;
  exportedAt: string;
  source: 'CRM Thayná Reis';
  sections: CRMExportSection[];
  data: {
    products?: Product[];
    accessories?: Accessory[];
    sales?: Sale[];
    saleItems?: SaleItem[];
    followups?: Followup[];
    events?: SaleEvent[];
    settings?: Settings;
    carModels?: CarModel[];
  };
}

export interface CarVersion {
  name: string;
  years: string[];
}

export interface CarModel {
  id: string;
  name: string;
  versions: CarVersion[];
}
