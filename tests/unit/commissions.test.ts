import { describe, expect, it } from 'vitest';
import { calculateSaleCommission, getMonthlyVolumeBeforeSale, isCommissionEligibleSale } from '../../src/utils/commissions.js';
import { Accessory, Sale, Settings } from '../../src/types.js';

const settings: Settings = {
  commissionPercent: 1.7,
  dealerName: 'CAOA Chery',
  targetPerClient: 2000,
  goalBonusAmount: 0,
  goalExtraCommissionPercent: 0.5,
  commissionPlanVersion: 2,
};

describe('commissions', () => {
  it('nao considera proposta perdida como elegivel', () => {
    expect(isCommissionEligibleSale({ status: 'Perdido' })).toBe(false);
    expect(isCommissionEligibleSale({ status: 'Novo cliente' })).toBe(false);
    expect(isCommissionEligibleSale({ status: 'Aprovado' })).toBe(true);
  });

  it('calcula base, bonus de produto e extra de meta', () => {
    const accessories: Accessory[] = [{
      id: 'acc_1',
      name: 'Película',
      description: '',
      category: 'Película',
      price: 1000,
      commissionBonusAmount: 25,
      commissionBonusPercent: 1,
      timeEstimate: 60,
      compatibilities: ['Tiggo 5'],
      universal: false,
      active: true,
    }];

    const result = calculateSaleCommission({
      saleTotal: 2000,
      commissionPercent: 1.7,
      items: [{ accessoryId: 'acc_1', price: 1000 }],
      accessories,
      settings,
      monthlyVolumeBeforeSale: 0,
      monthlyOpportunityCount: 1,
    });

    expect(result.baseAmount).toBe(34);
    expect(result.productBonusAmount).toBe(35);
    expect(result.goalExtraAmount).toBe(10);
    expect(result.commissionAmount).toBe(79);
  });

  it('volume mensal ignora venda perdida', () => {
    const sales = [
      { id: 'a', total: 1000, createdAt: '2026-06-01T00:00:00.000Z', status: 'Aprovado' },
      { id: 'b', total: 9999, createdAt: '2026-06-02T00:00:00.000Z', status: 'Perdido' },
      { id: 'c', total: 500, createdAt: '2026-05-02T00:00:00.000Z', status: 'Aprovado' },
    ] as Sale[];

    expect(getMonthlyVolumeBeforeSale(sales, null, 0, '2026-06-18T00:00:00.000Z')).toBe(1000);
  });
});
