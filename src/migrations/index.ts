import * as migration_20260914_184237_initial from './20260914_184237_initial';
import * as migration_20260914_204423_site_settings from './20260914_204423_site_settings';
import * as migration_20260914_213000_eur_currency from './20260914_213000_eur_currency';
import * as migration_20260914_222556_shipping_payments from './20260914_222556_shipping_payments';
import * as migration_20260914_230139_content_management from './20260914_230139_content_management';
import * as migration_20260915_055133_x1_commerce_schema from './20260915_055133_x1_commerce_schema';
import * as migration_20260915_061505_x3_oauth_identity from './20260915_061505_x3_oauth_identity';
import * as migration_20260915_070154_y1_product_data from './20260915_070154_y1_product_data';
import * as migration_20260915_072334_y2_feeds_tracking from './20260915_072334_y2_feeds_tracking';
import * as migration_20260915_090333_z1_search_recommended from './20260915_090333_z1_search_recommended';
import * as migration_20260915_101321_z2_address_kind from './20260915_101321_z2_address_kind';
import * as migration_20260915_101412_z3_push_subscriptions from './20260915_101412_z3_push_subscriptions';
import * as migration_20260915_102919_z5_topbar from './20260915_102919_z5_topbar';

export const migrations = [
  {
    up: migration_20260914_184237_initial.up,
    down: migration_20260914_184237_initial.down,
    name: '20260914_184237_initial',
  },
  {
    up: migration_20260914_204423_site_settings.up,
    down: migration_20260914_204423_site_settings.down,
    name: '20260914_204423_site_settings',
  },
  {
    up: migration_20260914_213000_eur_currency.up,
    down: migration_20260914_213000_eur_currency.down,
    name: '20260914_213000_eur_currency',
  },
  {
    up: migration_20260914_222556_shipping_payments.up,
    down: migration_20260914_222556_shipping_payments.down,
    name: '20260914_222556_shipping_payments',
  },
  {
    up: migration_20260914_230139_content_management.up,
    down: migration_20260914_230139_content_management.down,
    name: '20260914_230139_content_management',
  },
  {
    up: migration_20260915_055133_x1_commerce_schema.up,
    down: migration_20260915_055133_x1_commerce_schema.down,
    name: '20260915_055133_x1_commerce_schema',
  },
  {
    up: migration_20260915_061505_x3_oauth_identity.up,
    down: migration_20260915_061505_x3_oauth_identity.down,
    name: '20260915_061505_x3_oauth_identity',
  },
  {
    up: migration_20260915_070154_y1_product_data.up,
    down: migration_20260915_070154_y1_product_data.down,
    name: '20260915_070154_y1_product_data',
  },
  {
    up: migration_20260915_072334_y2_feeds_tracking.up,
    down: migration_20260915_072334_y2_feeds_tracking.down,
    name: '20260915_072334_y2_feeds_tracking',
  },
  {
    up: migration_20260915_090333_z1_search_recommended.up,
    down: migration_20260915_090333_z1_search_recommended.down,
    name: '20260915_090333_z1_search_recommended',
  },
  {
    up: migration_20260915_101321_z2_address_kind.up,
    down: migration_20260915_101321_z2_address_kind.down,
    name: '20260915_101321_z2_address_kind',
  },
  {
    up: migration_20260915_101412_z3_push_subscriptions.up,
    down: migration_20260915_101412_z3_push_subscriptions.down,
    name: '20260915_101412_z3_push_subscriptions',
  },
  {
    up: migration_20260915_102919_z5_topbar.up,
    down: migration_20260915_102919_z5_topbar.down,
    name: '20260915_102919_z5_topbar'
  },
];
