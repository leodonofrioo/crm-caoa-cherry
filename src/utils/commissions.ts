import { Accessory, Sale, SaleItem, Settings } from '../types.js';

type SaleItemInput = Pick<SaleItem, 'accessoryId' | 'price'>;

export const isCommissionEligibleSale = (sale: Pick<Sale, 'status'>) =>
  sale.status !== 'Perdido' && sale.status !== 'Novo cliente';

export const getSaleMonthKey = (createdAt: string) => createdAt.slice(0, 7);

export const getMonthlyOpportunityCount = (sales: Array<Pick<Sale, 'createdAt'>>, monthKey: string) =>
  sales.filter((sale) => getSaleMonthKey(sale.createdAt) === monthKey).length;

export const getMonthlyTargetAmount = (settings: Settings, monthlyOpportunityCount = 0) => {
  const perCarTarget = settings.targetPerClient ?? 2000;
  return perCarTarget * monthlyOpportunityCount;
};

export const calculateProductBonus = (items: SaleItemInput[], accessories: Accessory[]) =>
  items.reduce((total, item) => {
    const accessory = accessories.find((acc) => acc.id === item.accessoryId);
    if (!accessory) return total;
    const fixedBonus = accessory.commissionBonusAmount ?? 0;
    const percentBonus = ((accessory.commissionBonusPercent ?? 0) * item.price) / 100;
    return total + fixedBonus + percentBonus;
  }, 0);

export function calculateSaleCommission(params: {
  saleTotal: number;
  commissionPercent: number;
  items: SaleItemInput[];
  accessories: Accessory[];
  settings: Settings;
  monthlyVolumeBeforeSale: number;
  monthlyOpportunityCount: number;
}) {
  const {
    saleTotal,
    commissionPercent,
    items,
    accessories,
    settings,
    monthlyVolumeBeforeSale,
    monthlyOpportunityCount,
  } = params;
  const baseAmount = (saleTotal * commissionPercent) / 100;
  const productBonusAmount = calculateProductBonus(items, accessories);
  const monthlyTarget = getMonthlyTargetAmount(settings, monthlyOpportunityCount);
  const goalWasAlreadyReached = monthlyTarget > 0 && monthlyVolumeBeforeSale >= monthlyTarget;
  const goalReachedByThisSale =
    monthlyTarget > 0 && monthlyVolumeBeforeSale < monthlyTarget && monthlyVolumeBeforeSale + saleTotal >= monthlyTarget;
  const goalExtraPercent = goalWasAlreadyReached || goalReachedByThisSale ? settings.goalExtraCommissionPercent ?? 0 : 0;
  const goalExtraAmount = (saleTotal * goalExtraPercent) / 100;
  const goalBonusAmount = goalReachedByThisSale ? settings.goalBonusAmount ?? 0 : 0;
  const commissionAmount = baseAmount + productBonusAmount + goalExtraAmount + goalBonusAmount;

  return {
    baseAmount: Number(baseAmount.toFixed(2)),
    productBonusAmount: Number(productBonusAmount.toFixed(2)),
    goalExtraAmount: Number(goalExtraAmount.toFixed(2)),
    goalBonusAmount: Number(goalBonusAmount.toFixed(2)),
    commissionAmount: Number(commissionAmount.toFixed(2)),
  };
}

export function getMonthlyVolumeBeforeSale(sales: Sale[], saleId: string | null, saleTotal: number, createdAt: string) {
  const monthKey = getSaleMonthKey(createdAt);
  return sales
    .filter((sale) => sale.id !== saleId && getSaleMonthKey(sale.createdAt) === monthKey && isCommissionEligibleSale(sale))
    .reduce((sum, sale) => sum + sale.total, 0);
}
