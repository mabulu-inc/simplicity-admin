// packages/core/src/providers/registry.ts — Provider Registry

import type { ProjectConfig } from '../config/types.js';
import type { Provider } from './types.js';
import { ProviderError } from '../errors.js';

export class ProviderRegistry {
  private providers = new Map<string, Provider>();

  register<T extends Provider>(type: string, provider: T): void {
    this.providers.set(type, provider);
  }

  get<T extends Provider>(type: string): T {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new ProviderError(
        `no provider registered for '${type}'`,
        'CORE_004',
      );
    }
    return provider as T;
  }

  has(type: string): boolean {
    return this.providers.has(type);
  }

  async initAll(config: ProjectConfig): Promise<void> {
    for (const provider of this.providers.values()) {
      if (provider.init) {
        try {
          await provider.init(config);
        } catch (error) {
          throw new ProviderError(
            `failed to initialize provider '${provider.name}': ${(error as Error).message}`,
            'CORE_005',
            error as Error,
          );
        }
      }
    }
  }

  async shutdownAll(): Promise<void> {
    for (const provider of this.providers.values()) {
      if (provider.shutdown) {
        await provider.shutdown();
      }
    }
  }
}

export function createRegistry(_config: ProjectConfig): ProviderRegistry {
  return new ProviderRegistry();
}
