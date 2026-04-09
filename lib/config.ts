import { getStageColor as _getStageColor } from './festivals';

// Legacy CONFIG for backward compat during migration
export const CONFIG = {
  festival: 'Ultra Music Festival Miami',
  festivalShort: 'Ultra Miami',
  years: { min: 1999, max: 2026 },
} as const;

export function getStageColor(stage: string, festival?: string): string {
  return _getStageColor(festival || 'ultra-miami', stage);
}
