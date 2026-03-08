// packages/core/src/plugins/manager.ts — Plugin lifecycle manager

import type { Plugin } from './types.js';
import { PluginError } from '../errors.js';

type PluginHookFn = (...args: never[]) => Promise<unknown>;

export class PluginManager {
  private readonly plugins: Plugin[];

  constructor(plugins: Plugin[]) {
    this.plugins = plugins;
  }

  async runHook(hook: keyof Plugin, ...args: unknown[]): Promise<unknown> {
    // onSchemaLoaded is a chaining hook — each plugin's output feeds the next
    if (hook === 'onSchemaLoaded') {
      return this.runChainHook(hook, args[0]);
    }

    // All other hooks are fire-in-order (no chaining)
    for (const plugin of this.plugins) {
      const fn = plugin[hook];
      if (typeof fn !== 'function') continue;

      try {
        await (fn as PluginHookFn).apply(plugin, args as never[]);
      } catch (err) {
        throw new PluginError(
          `Plugin "${plugin.name}" failed on hook "${String(hook)}": ${(err as Error).message}`,
          'CORE_006',
          err as Error,
        );
      }
    }

    return undefined;
  }

  private async runChainHook(hook: keyof Plugin, initial: unknown): Promise<unknown> {
    let result = initial;

    for (const plugin of this.plugins) {
      const fn = plugin[hook];
      if (typeof fn !== 'function') continue;

      try {
        result = await (fn as PluginHookFn).apply(plugin, [result] as never[]);
      } catch (err) {
        throw new PluginError(
          `Plugin "${plugin.name}" failed on hook "${String(hook)}": ${(err as Error).message}`,
          'CORE_006',
          err as Error,
        );
      }
    }

    return result;
  }
}
