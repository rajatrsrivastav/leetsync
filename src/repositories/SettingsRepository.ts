import type { Settings } from '../types';
import type { StorageService } from '../services/StorageService';
export class SettingsRepository {
  constructor(private storage: StorageService) {}
  async get() {
    return (await this.storage.read()).settings;
  }
  save(settings: Settings) {
    return this.storage.transaction((state) => {
      state.settings = structuredClone(settings);
    });
  }
}
