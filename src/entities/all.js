import { createEntity } from './entityFactory';
import { Customer } from './Customer';
import { RestaurantProfile } from './RestaurantProfile';

export const Order = createEntity('Order');
export const CagnotteHistory = createEntity('CagnotteHistory');
export const CagnotteRule = createEntity('CagnotteRule');
export { Customer, RestaurantProfile };

