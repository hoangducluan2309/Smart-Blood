import type { BloodType, RhFactor } from '../types/domain.js';

/**
 * Gia tri tam thoi theo Overview.md muc 6.2; Truong bo phan y te phai doi chieu
 * voi Thong tu 26/2013/TT-BYT va van ban sua doi con hieu luc truoc khi dung that.
 */
export const MEDICAL_THRESHOLDS = {
  MIN_DONATION_INTERVAL_DAYS: 84,
  MIN_WEIGHT_KG: 45,
  SYSTOLIC_MIN_MMHG: 100,
  SYSTOLIC_MAX_MMHG: 140,
  DIASTOLIC_MIN_MMHG: 60,
  DIASTOLIC_MAX_MMHG: 90,
  HEART_RATE_MIN_BPM: 60,
  HEART_RATE_MAX_BPM: 90,
  MIN_HEMOGLOBIN_G_DL: 12.0,
  RED_CELL_SHELF_LIFE_DAYS: 35,
} as const;

export interface ClinicalVitalsInput {
  huyetApTamThu: number;
  huyetApTamTruong: number;
  nhipTim: number;
  canNang: number;
}

export function evaluateClinicalVitals(vitals: ClinicalVitalsInput): string[] {
  const reasons: string[] = [];

  if (vitals.canNang < MEDICAL_THRESHOLDS.MIN_WEIGHT_KG) {
    reasons.push(`Cân nặng dưới ngưỡng ${MEDICAL_THRESHOLDS.MIN_WEIGHT_KG} kg`);
  }
  if (
    vitals.huyetApTamThu < MEDICAL_THRESHOLDS.SYSTOLIC_MIN_MMHG ||
    vitals.huyetApTamThu > MEDICAL_THRESHOLDS.SYSTOLIC_MAX_MMHG
  ) {
    reasons.push('Huyết áp tâm thu ngoài ngưỡng an toàn');
  }
  if (
    vitals.huyetApTamTruong < MEDICAL_THRESHOLDS.DIASTOLIC_MIN_MMHG ||
    vitals.huyetApTamTruong > MEDICAL_THRESHOLDS.DIASTOLIC_MAX_MMHG
  ) {
    reasons.push('Huyết áp tâm trương ngoài ngưỡng an toàn');
  }
  if (
    vitals.nhipTim < MEDICAL_THRESHOLDS.HEART_RATE_MIN_BPM ||
    vitals.nhipTim > MEDICAL_THRESHOLDS.HEART_RATE_MAX_BPM
  ) {
    reasons.push('Nhịp tim ngoài ngưỡng an toàn');
  }

  return reasons;
}

export interface BloodGroup {
  nhomMau: BloodType;
  rhFactor: RhFactor;
}

const RBC_COMPATIBILITY: Record<string, readonly BloodGroup[]> = {
  'O-': [{ nhomMau: 'O', rhFactor: '-' }],
  'O+': [
    { nhomMau: 'O', rhFactor: '+' },
    { nhomMau: 'O', rhFactor: '-' },
  ],
  'A-': [
    { nhomMau: 'A', rhFactor: '-' },
    { nhomMau: 'O', rhFactor: '-' },
  ],
  'A+': [
    { nhomMau: 'A', rhFactor: '+' },
    { nhomMau: 'A', rhFactor: '-' },
    { nhomMau: 'O', rhFactor: '+' },
    { nhomMau: 'O', rhFactor: '-' },
  ],
  'B-': [
    { nhomMau: 'B', rhFactor: '-' },
    { nhomMau: 'O', rhFactor: '-' },
  ],
  'B+': [
    { nhomMau: 'B', rhFactor: '+' },
    { nhomMau: 'B', rhFactor: '-' },
    { nhomMau: 'O', rhFactor: '+' },
    { nhomMau: 'O', rhFactor: '-' },
  ],
  'AB-': [
    { nhomMau: 'AB', rhFactor: '-' },
    { nhomMau: 'A', rhFactor: '-' },
    { nhomMau: 'B', rhFactor: '-' },
    { nhomMau: 'O', rhFactor: '-' },
  ],
  'AB+': [
    { nhomMau: 'AB', rhFactor: '+' },
    { nhomMau: 'AB', rhFactor: '-' },
    { nhomMau: 'A', rhFactor: '+' },
    { nhomMau: 'A', rhFactor: '-' },
    { nhomMau: 'B', rhFactor: '+' },
    { nhomMau: 'B', rhFactor: '-' },
    { nhomMau: 'O', rhFactor: '+' },
    { nhomMau: 'O', rhFactor: '-' },
  ],
};

export function getCompatibleDonorBloodGroups(recipient: BloodGroup): readonly BloodGroup[] {
  const key = `${recipient.nhomMau}${recipient.rhFactor}`;
  return RBC_COMPATIBILITY[key] ?? [];
}
