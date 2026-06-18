import { Accessory, Product, ProductVariation, VehicleCompatibility } from '../types.js';
import { RUSSI_ACCESSORIES } from './russiAccessories.generated.js';

export const ALLOWED_CAR_MODELS = ['Tiggo 5', 'Tiggo 7', 'Tiggo 8'];

const MODEL_MAP: Record<string, string> = {
  [`TIGGO 5${'X'}`]: 'Tiggo 5',
  'TIGGO 5': 'Tiggo 5',
  'TIGGO 7': 'Tiggo 7',
  'TIGGO 8': 'Tiggo 8',
  'Tiggo 5': 'Tiggo 5',
  'Tiggo 7': 'Tiggo 7',
  'Tiggo 8': 'Tiggo 8',
};

const stripAccents = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const normalizeVehicleModel = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const normalized = stripAccents(value).trim().toUpperCase().replace(/\s+/g, ' ');
  return MODEL_MAP[normalized] || MODEL_MAP[value.trim()];
};

export const isAllowedVehicleModel = (value: string | undefined): boolean =>
  Boolean(normalizeVehicleModel(value));

const normalizeKey = (value: string) =>
  stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const uniqueCompatibilities = (compatibilities: VehicleCompatibility[]) => {
  const byKey = new Map<string, VehicleCompatibility>();
  compatibilities.forEach((compatibility) => {
    const model = normalizeVehicleModel(compatibility.model);
    if (!model) return;
    const key = [model, compatibility.version || '', compatibility.year || ''].join('|');
    byKey.set(key, { ...compatibility, model });
  });
  return Array.from(byKey.values()).sort((a, b) => a.model.localeCompare(b.model));
};

export const isVehicleCompatible = (
  compatibilities: VehicleCompatibility[] | undefined,
  carModel: string | undefined,
  carVersion?: string,
  carYear?: string
) => {
  const selectedModel = normalizeVehicleModel(carModel);
  if (!selectedModel) return false;

  return uniqueCompatibilities(compatibilities || []).some((compatibility) => {
    if (compatibility.model !== selectedModel) return false;
    if (compatibility.version && carVersion && compatibility.version !== carVersion) return false;
    if (compatibility.year && carYear && compatibility.year !== carYear) return false;
    return true;
  });
};

const getAccessoryCompatibilities = (accessory: Accessory): VehicleCompatibility[] =>
  uniqueCompatibilities(
    (accessory.compatibilities || []).map((entry) => {
      const [model, version, year] = entry.split('|');
      return { model, version, year };
    })
  );

const cleanBaseName = (name: string) =>
  name
    .replace(/\s*-\s*(TIGGO\s*5X?|TIGGO\s*7|TIGGO\s*8)\b/gi, '')
    .replace(/\bTIGGO\s*5X?\b/gi, '')
    .replace(/\bTIGGO\s*7\b/gi, '')
    .replace(/\bTIGGO\s*8\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+-\s+$/g, '')
    .trim();

const getProductName = (accessory: Accessory) => {
  const name = stripAccents(accessory.name).toUpperCase();
  if (accessory.category === 'Película Solar' || name.includes('PELICULA SOLAR')) return 'Película Automotiva';
  return cleanBaseName(accessory.name);
};

const getVariationName = (accessory: Accessory) => {
  const name = stripAccents(accessory.name).toUpperCase();
  if (accessory.category === 'Película Solar' || name.includes('PELICULA SOLAR')) {
    const parts = [
      name.includes('ANTIVANDALISMO') ? 'Antivandalismo' : undefined,
      name.match(/\bG\d{1,2}\b/)?.[0],
      name.includes('NANOCERAMICA') ? 'Nanocerâmica' : undefined,
      name.includes('TITANIUM') ? 'Titanium' : undefined,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : cleanBaseName(accessory.name).replace(/^PELICULA SOLAR\s*-?\s*/i, '');
  }
  return cleanBaseName(accessory.name) || 'Padrão';
};

const mergeProducts = (accessories: Accessory[]): Product[] => {
  const products = new Map<string, Product>();

  accessories.forEach((accessory) => {
    const compatibilities = getAccessoryCompatibilities(accessory);
    if (!accessory.universal && compatibilities.length === 0) return;

    const productName = getProductName(accessory);
    const productKey = `${accessory.category}:${normalizeKey(productName)}`;
    const variationName = getVariationName(accessory);
    const variationKey = normalizeKey([
      variationName,
      accessory.attributes?.codigo || '',
      accessory.price,
      accessory.timeEstimate,
    ].join('-'));

    const existingProduct = products.get(productKey);
    const product: Product = existingProduct || {
      id: `prod_${normalizeKey(productName)}`,
      name: productName,
      description: accessory.description.replace(/Compatível com .+?\.$/i, '').trim(),
      category: accessory.category,
      imageUrl: accessory.imageUrl,
      attributes: accessory.attributes,
      compatibilities: [],
      universal: false,
      active: true,
      variations: [],
    };

    const existingVariation = product.variations.find((variation) => variation.id === `${product.id}_var_${variationKey}`);
    if (existingVariation) {
      existingVariation.compatibilities = uniqueCompatibilities([...existingVariation.compatibilities, ...compatibilities]);
      existingVariation.legacyAccessoryIds = Array.from(new Set([...(existingVariation.legacyAccessoryIds || []), accessory.id]));
    } else {
      const variation: ProductVariation = {
        id: `${product.id}_var_${variationKey}`,
        name: variationName || 'Padrão',
        description: accessory.description,
        imageUrl: accessory.imageUrl,
        attributes: accessory.attributes,
        price: accessory.price,
        commissionBonusAmount: accessory.commissionBonusAmount,
        commissionBonusPercent: accessory.commissionBonusPercent,
        timeEstimate: accessory.timeEstimate,
        compatibilities,
        active: accessory.active,
        sku: accessory.attributes?.codigo ? String(accessory.attributes.codigo) : undefined,
        legacyAccessoryIds: [accessory.id],
      };
      product.variations.push(variation);
    }

    product.compatibilities = uniqueCompatibilities([...product.compatibilities, ...compatibilities]);
    product.active = product.active || accessory.active;
    products.set(productKey, product);
  });

  return Array.from(products.values())
    .map((product) => ({
      ...product,
      variations: product.variations.sort((a, b) => a.name.localeCompare(b.name) || a.price - b.price),
    }))
    .filter((product) => product.variations.length > 0)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
};

export const flattenProductsToAccessories = (products: Product[]): Accessory[] =>
  products.flatMap((product) =>
    product.variations.map((variation) => ({
      id: variation.id,
      name: variation.name === 'Padrão' ? product.name : `${product.name} - ${variation.name}`,
      description: variation.description || product.description,
      category: product.category,
      imageUrl: variation.imageUrl || product.imageUrl,
      attributes: {
        ...(product.attributes || {}),
        ...(variation.attributes || {}),
        productId: product.id,
        variationId: variation.id,
        productName: product.name,
        variationName: variation.name,
      },
      price: variation.price,
      commissionBonusAmount: variation.commissionBonusAmount,
      commissionBonusPercent: variation.commissionBonusPercent,
      timeEstimate: variation.timeEstimate,
      compatibilities: variation.compatibilities.map((compatibility) =>
        [compatibility.model, compatibility.version, compatibility.year].filter(Boolean).join('|')
      ),
      universal: product.universal,
      active: product.active && variation.active,
    }))
  );

export const INITIAL_PRODUCTS: Product[] = mergeProducts(RUSSI_ACCESSORIES);
export const INITIAL_ACCESSORIES: Accessory[] = flattenProductsToAccessories(INITIAL_PRODUCTS);

export const CAR_MODELS = ALLOWED_CAR_MODELS;
