import * as migration_20260914_184237_initial from './20260914_184237_initial';
import * as migration_20260914_204423_site_settings from './20260914_204423_site_settings';
import * as migration_20260914_213000_eur_currency from './20260914_213000_eur_currency';
import * as migration_20260914_222556_shipping_payments from './20260914_222556_shipping_payments';

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
    name: '20260914_222556_shipping_payments'
  },
];
