import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  evaluateClinicalVitals,
  getCompatibleDonorBloodGroups,
} from '../../backend/src/config/medical-thresholds.js';

describe('medical-logic', () => {
  it('should accept vitals within configured safety thresholds', () => {
    const reasons = evaluateClinicalVitals({
      huyetApTamThu: 120,
      huyetApTamTruong: 80,
      nhipTim: 75,
      canNang: 58,
    });
    assert.deepEqual(reasons, []);
  });

  it('should reject donor when weight or blood pressure is out of range', () => {
    const reasons = evaluateClinicalVitals({
      huyetApTamThu: 165,
      huyetApTamTruong: 95,
      nhipTim: 75,
      canNang: 42,
    });
    assert.equal(reasons.length, 3);
  });

  it('should restrict O- recipient strictly to O- donor bags', () => {
    const compatible = getCompatibleDonorBloodGroups({ nhomMau: 'O', rhFactor: '-' });
    assert.deepEqual(compatible, [{ nhomMau: 'O', rhFactor: '-' }]);
  });

  it('should allow all 8 blood groups for AB+ recipient', () => {
    const compatible = getCompatibleDonorBloodGroups({ nhomMau: 'AB', rhFactor: '+' });
    assert.equal(compatible.length, 8);
  });
});
