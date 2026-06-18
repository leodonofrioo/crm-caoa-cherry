import { describe, expect, it } from 'vitest';
import { ALLOWED_CAR_MODELS, isVehicleCompatible, normalizeVehicleModel } from '../../src/data/accessories.js';

describe('catalog vehicle scope', () => {
  it('normaliza Tiggo 5X legado para Tiggo 5', () => {
    expect(normalizeVehicleModel('TIGGO 5X')).toBe('Tiggo 5');
    expect(normalizeVehicleModel('Tiggo 5')).toBe('Tiggo 5');
  });

  it('mantem somente modelos Tiggo no escopo inicial', () => {
    expect(ALLOWED_CAR_MODELS).toEqual(['Tiggo 5', 'Tiggo 7', 'Tiggo 8']);
    expect(normalizeVehicleModel('HB20')).toBeUndefined();
    expect(normalizeVehicleModel('Creta')).toBeUndefined();
    expect(normalizeVehicleModel('Santa Fe')).toBeUndefined();
  });

  it('respeita compatibilidade por modelo, versao e ano', () => {
    const compatibilities = [{ model: 'Tiggo 7', version: 'Sport', year: '2026' }];
    expect(isVehicleCompatible(compatibilities, 'Tiggo 7', 'Sport', '2026')).toBe(true);
    expect(isVehicleCompatible(compatibilities, 'Tiggo 7', 'Sport', '2025')).toBe(false);
    expect(isVehicleCompatible(compatibilities, 'Tiggo 8', 'Sport', '2026')).toBe(false);
  });
});
