import { createPageUrl } from '@/utils';

export const CUSTOMER_DISPLAY_HEARTBEAT_PREFIX = 'customer_display_active';
export const CUSTOMER_DISPLAY_CART_ID_PREFIX = 'customer_display_cart_id';
export const CUSTOMER_DISPLAY_LIVE_CART_PREFIX = 'customer_display_live_cart';
export const CUSTOMER_DISPLAY_CONTROL_PREFIX = 'customer_display_live_control';

export const getCustomerDisplayHeartbeatKey = (tenantId) => `${CUSTOMER_DISPLAY_HEARTBEAT_PREFIX}:${tenantId || 'global'}`;
export const getCustomerDisplayCartIdKey = (tenantId) => `${CUSTOMER_DISPLAY_CART_ID_PREFIX}:${tenantId || 'global'}`;
export const getCustomerDisplayLiveCartKey = (tenantId) => `${CUSTOMER_DISPLAY_LIVE_CART_PREFIX}:${tenantId || 'global'}`;
export const getCustomerDisplayLiveControlKey = (tenantId) => `${CUSTOMER_DISPLAY_CONTROL_PREFIX}:${tenantId || 'global'}`;
export const getCustomerDisplayChannelName = (tenantId) => `customer-display-live-${tenantId || 'global'}`;
export const getCustomerDisplayControlChannelName = (tenantId) => `customer-display-control-${tenantId || 'global'}`;
export const CUSTOMER_DISPLAY_RUNTIME_VERSION = 'customer-display-v2';

export const buildCustomerDisplayUrl = ({ tenantId, setup = false } = {}) => {
  const url = new URL(createPageUrl('CustomerDisplay'), window.location.origin);
  if (tenantId) url.searchParams.set('tenant', tenantId);
  if (setup) url.searchParams.set('setup', '1');
  return url.toString();
};

export const openCustomerDisplayWindow = ({ tenantId, setup = false } = {}) => (
  window.open(buildCustomerDisplayUrl({ tenantId, setup }), '_blank', 'width=1920,height=1080')
);

export const postCustomerDisplayLocalMessage = ({ tenantId, channelName, storageKey, payload }) => {
  if (typeof window === 'undefined') return;

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(channelName);
    channel.postMessage(payload);
    channel.close();
  }

  window.localStorage.setItem(storageKey, JSON.stringify(payload));
};

export const sendCustomerDisplayControlMessage = ({ tenantId, type, payload = {} }) => {
  postCustomerDisplayLocalMessage({
    tenantId,
    channelName: getCustomerDisplayControlChannelName(tenantId),
    storageKey: getCustomerDisplayLiveControlKey(tenantId),
    payload: {
      type,
      tenantId: tenantId || null,
      emittedAt: new Date().toISOString(),
      ...payload,
    },
  });
};
