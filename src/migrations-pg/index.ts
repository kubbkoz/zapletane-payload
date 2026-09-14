import * as migration_20260914_194522_initial from './20260914_194522_initial';
import * as migration_20260914_194649_seed_admin from './20260914_194649_seed_admin';
import * as migration_20260914_201800_reset_admin_password from './20260914_201800_reset_admin_password';
import * as migration_20260914_204453_site_settings from './20260914_204453_site_settings';
import * as migration_20260914_210500_reset_admin_password_2 from './20260914_210500_reset_admin_password_2';
import * as migration_20260914_213000_eur_currency from './20260914_213000_eur_currency';
import * as migration_20260914_222406_shipping_payments from './20260914_222406_shipping_payments';
import * as migration_20260914_223000_mcp_shipping_payment_grants from './20260914_223000_mcp_shipping_payment_grants';
import * as migration_20260914_230125_content_management from './20260914_230125_content_management';
import * as migration_20260914_231500_content_defaults from './20260914_231500_content_defaults';

export const migrations = [
  {
    up: migration_20260914_194522_initial.up,
    down: migration_20260914_194522_initial.down,
    name: '20260914_194522_initial',
  },
  {
    up: migration_20260914_194649_seed_admin.up,
    down: migration_20260914_194649_seed_admin.down,
    name: '20260914_194649_seed_admin',
  },
  {
    up: migration_20260914_201800_reset_admin_password.up,
    down: migration_20260914_201800_reset_admin_password.down,
    name: '20260914_201800_reset_admin_password',
  },
  {
    up: migration_20260914_204453_site_settings.up,
    down: migration_20260914_204453_site_settings.down,
    name: '20260914_204453_site_settings',
  },
  {
    up: migration_20260914_210500_reset_admin_password_2.up,
    down: migration_20260914_210500_reset_admin_password_2.down,
    name: '20260914_210500_reset_admin_password_2',
  },
  {
    up: migration_20260914_213000_eur_currency.up,
    down: migration_20260914_213000_eur_currency.down,
    name: '20260914_213000_eur_currency',
  },
  {
    up: migration_20260914_222406_shipping_payments.up,
    down: migration_20260914_222406_shipping_payments.down,
    name: '20260914_222406_shipping_payments',
  },
  {
    up: migration_20260914_223000_mcp_shipping_payment_grants.up,
    down: migration_20260914_223000_mcp_shipping_payment_grants.down,
    name: '20260914_223000_mcp_shipping_payment_grants',
  },
  {
    up: migration_20260914_230125_content_management.up,
    down: migration_20260914_230125_content_management.down,
    name: '20260914_230125_content_management',
  },
  {
    up: migration_20260914_231500_content_defaults.up,
    down: migration_20260914_231500_content_defaults.down,
    name: '20260914_231500_content_defaults',
  },
];
