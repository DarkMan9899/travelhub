/**
 * StorageProvider factory — P0.7 (Master Roadmap).
 *
 * Before this, every module that needed a StorageProvider
 * (`modules/listings`, `modules/messaging`, `modules/users`) constructed
 * its own `new LocalStorageProvider()` independently — three separate
 * hardcoded instantiation points that would each need updating to add a
 * real provider. This is the single composition point instead, selected
 * by `config.storage.provider` — every caller changes from
 * `new LocalStorageProvider()` to `createStorageProvider()` and never
 * needs to change again when the provider does.
 */

import config from '../../config/index.js';
import { LocalStorageProvider } from './localStorageProvider.js';
import { S3StorageProvider } from './s3StorageProvider.js';

export function createStorageProvider() {
  if (config.storage.provider === 's3') {
    return new S3StorageProvider(config.storage.s3);
  }
  return new LocalStorageProvider();
}

export default createStorageProvider;
