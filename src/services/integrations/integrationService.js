import { accountingIntegrationService } from '@/services/billing/accountingIntegrationService';
import { eInvoicingService } from '@/services/billing/eInvoicingService';
import { deliveryIntegrationService } from '@/services/integrations/deliveryIntegrationService';
import { paymentProviderService } from '@/services/integrations/paymentProviderService';
import { notificationService } from '@/services/notifications/notificationService';

export const integrationService = {
  getAvailableContracts() {
    return {
      delivery: deliveryIntegrationService.getContract(),
      accounting: accountingIntegrationService.getContract(),
      eInvoicing: eInvoicingService.getContract(),
      paymentProvider: paymentProviderService.getContract(),
      notification: notificationService.getContract(),
    };
  },
};
