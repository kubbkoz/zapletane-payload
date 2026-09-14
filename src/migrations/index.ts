import * as migration_20260914_184237_initial from './20260914_184237_initial';

export const migrations = [
  {
    up: migration_20260914_184237_initial.up,
    down: migration_20260914_184237_initial.down,
    name: '20260914_184237_initial'
  },
];
