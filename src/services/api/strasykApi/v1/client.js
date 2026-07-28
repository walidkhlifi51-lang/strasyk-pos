import { strasykApiV1Contracts } from '@/services/api/strasykApi/v1/contracts';

export const createStrasykApiV1Client = (baseUrl = '') => ({
  baseUrl,
  contracts: strasykApiV1Contracts,
});
