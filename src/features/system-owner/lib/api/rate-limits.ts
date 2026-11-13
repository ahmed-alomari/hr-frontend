import { apiRequest } from '@/features/hr/lib/api/client';

/** Mirrors `RateLimitsViewDto` (hr-backend system-owner-rate-limits.controller.ts). */
export type RateLimitRuleView = {
  limit: number;
  windowSeconds: number;
  per: 'address' | 'account';
};

export type RateLimitPolicyView = {
  key: string;
  labelAr: string;
  routes: string[];
  rules: RateLimitRuleView[];
};

export type RateLimitsView = {
  enabled: boolean;
  defaultPerMinute: number;
  policies: RateLimitPolicyView[];
};

export const rateLimitsApi = {
  view() {
    return apiRequest<RateLimitsView>('/system-owner/rate-limits');
  },
};
