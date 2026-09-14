import * as migration_20260914_194522_initial from './20260914_194522_initial';
import * as migration_20260914_194649_seed_admin from './20260914_194649_seed_admin';

export const migrations = [
  {
    up: migration_20260914_194522_initial.up,
    down: migration_20260914_194522_initial.down,
    name: '20260914_194522_initial',
  },
  {
    up: migration_20260914_194649_seed_admin.up,
    down: migration_20260914_194649_seed_admin.down,
    name: '20260914_194649_seed_admin'
  },
];
