import { Accessory, AccessoryCategory } from '../types.js';

export type CategoryFieldType = 'number' | 'text' | 'color';

export interface CategoryFieldConfig {
  key: string;
  label: string;
  type: CategoryFieldType;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export interface CategoryConfig {
  fields: CategoryFieldConfig[];
  features?: {
    filmTransparencySimulator?: boolean;
  };
}

export const CATEGORY_CONFIG: Partial<Record<AccessoryCategory, CategoryConfig>> = {
  'Película Solar': {
    fields: [
      {
        key: 'visibleLightTransmission',
        label: 'Grau de transparência',
        type: 'number',
        suffix: '%',
        min: 1,
        max: 100,
        step: 1,
        placeholder: '70',
      },
      {
        key: 'tintColor',
        label: 'Cor da película',
        type: 'color',
      },
      {
        key: 'uvProtection',
        label: 'Proteção UV',
        type: 'number',
        suffix: '%',
        min: 0,
        max: 100,
        step: 1,
        placeholder: '99',
      },
      {
        key: 'heatRejection',
        label: 'Rejeição térmica (TSER)',
        type: 'number',
        suffix: '%',
        min: 0,
        max: 100,
        step: 1,
        placeholder: '60',
      },
      {
        key: 'infraredRejection',
        label: 'Rejeição infravermelha (IR)',
        type: 'number',
        suffix: '%',
        min: 0,
        max: 100,
        step: 1,
        placeholder: '85',
      },
    ],
    features: {
      filmTransparencySimulator: true,
    },
  },
};

export const getCategoryConfig = (category: AccessoryCategory): CategoryConfig => {
  return CATEGORY_CONFIG[category] || { fields: [] };
};

export const getAccessoryNumberAttribute = (accessory: Accessory, key: string): number | undefined => {
  const value = accessory.attributes?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

export const getAccessoryStringAttribute = (accessory: Accessory, key: string): string | undefined => {
  const value = accessory.attributes?.[key];
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
};

export const clampVlt = (value: number | undefined): number => {
  if (value === undefined || Number.isNaN(value)) return 70;
  return Math.min(100, Math.max(1, value));
};

export const getFilmVlt = (accessory: Accessory): number => {
  return clampVlt(getAccessoryNumberAttribute(accessory, 'visibleLightTransmission'));
};

export const calculateStackedVlt = (first: Accessory, second?: Accessory): number => {
  const firstVlt = getFilmVlt(first) / 100;
  const secondVlt = second ? getFilmVlt(second) / 100 : 1;
  return Math.round(firstVlt * secondVlt * 100);
};

export const getAccessoryAttributeBadges = (accessory: Accessory): string[] => {
  if (accessory.category !== 'Película Solar') return [];

  const vlt = getAccessoryNumberAttribute(accessory, 'visibleLightTransmission');
  const uv = getAccessoryNumberAttribute(accessory, 'uvProtection');
  const heat = getAccessoryNumberAttribute(accessory, 'heatRejection');
  const infrared = getAccessoryNumberAttribute(accessory, 'infraredRejection');

  return [
    vlt !== undefined ? `Transparência: ${clampVlt(vlt)}%` : undefined,
    uv !== undefined ? `UV: ${Math.round(uv)}%` : undefined,
    heat !== undefined ? `TSER: ${Math.round(heat)}%` : undefined,
    infrared !== undefined ? `IR: ${Math.round(infrared)}%` : undefined,
  ].filter((item): item is string => Boolean(item));
};
