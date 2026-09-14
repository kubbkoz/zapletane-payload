import * as migration_20260914_194522_initial from './20260914_194522_initial';
import * as migration_20260914_194649_seed_admin from './20260914_194649_seed_admin';
import * as migration_20260914_201800_reset_admin_password from './20260914_201800_reset_admin_password';
import * as migration_20260914_204453_site_settings from './20260914_204453_site_settings';
import * as migration_20260914_210500_reset_admin_password_2 from './20260914_210500_reset_admin_password_2';
import * as migration_20260914_213000_eur_currency from './20260914_213000_eur_currency';

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
    name: '20260914_204453_site_settings'
  },
  {
    up: migration_20260914_210500_reset_admin_password_2.up,
    down: migration_20260914_210500_reset_admin_password_2.down,
    name: '20260914_210500_reset_admin_password_2'
  },
  {
    up: migration_20260914_213000_eur_currency.up,
    down: migration_20260914_213000_eur_currency.down,
    name: '20260914_213000_eur_currency'
  },
];
