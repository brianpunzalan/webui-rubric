/**
 * Abstract check registry for registering and looking up deterministic
 * check adapters.
 *
 * The registry stores adapters keyed by their `full_id`
 * (e.g., `'axe.color-contrast'`). Concrete adapters are implemented in the
 * `checks` package and registered here at startup.
 *
 * @module registry
 */

import type { CheckAdapter } from '../types/index.js';

export { ToolUnavailableError, applyFallback } from './fallback.js';

/**
 * Registry for deterministic check adapters.
 *
 * Stores adapters in a `Map` keyed by `full_id` and provides lookup
 * methods by exact ID or by family.
 */
export class CheckRegistry {
  /** @internal Adapter storage keyed by full_id. */
  private readonly adapters = new Map<string, CheckAdapter>();

  /**
   * Register a check adapter. Overwrites any previously registered
   * adapter with the same `full_id`.
   *
   * @param adapter - The adapter to register.
   *
   * @example
   * ```typescript
   * registry.registerCheck({
   *   check_family: 'axe',
   *   check_id: 'color-contrast',
   *   full_id: 'axe.color-contrast',
   *   execute: async (ctx) => ({ ... }),
   * });
   * ```
   */
  registerCheck(adapter: CheckAdapter): void {
    this.adapters.set(adapter.full_id, adapter);
  }

  /**
   * Look up an adapter by its full_id.
   *
   * @param full_id - The full identifier (e.g., `'axe.color-contrast'`).
   * @returns The registered adapter, or `undefined` if not found.
   */
  getCheck(full_id: string): CheckAdapter | undefined {
    return this.adapters.get(full_id);
  }

  /**
   * Return all registered adapters.
   *
   * @returns An array of all registered check adapters.
   */
  getAllChecks(): CheckAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Check whether an adapter is registered for the given full_id.
   *
   * @param full_id - The full identifier to look up.
   * @returns `true` if an adapter is registered, `false` otherwise.
   */
  hasCheck(full_id: string): boolean {
    return this.adapters.has(full_id);
  }

  /**
   * Return all adapters belonging to a specific check family.
   *
   * @param family - The check family (e.g., `'axe'`, `'lighthouse'`).
   * @returns An array of adapters whose `check_family` matches.
   *
   * @example
   * ```typescript
   * const axeChecks = registry.getChecksByFamily('axe');
   * // Returns all registered axe-core adapters
   * ```
   */
  getChecksByFamily(family: string): CheckAdapter[] {
    return Array.from(this.adapters.values()).filter((adapter) => adapter.check_family === family);
  }
}

/**
 * Create a new, empty `CheckRegistry` instance. Useful for testing
 * in isolation without affecting the singleton.
 *
 * @returns A fresh `CheckRegistry`.
 *
 * @example
 * ```typescript
 * const testRegistry = createRegistry();
 * testRegistry.registerCheck(myMockAdapter);
 * ```
 */
export function createRegistry(): CheckRegistry {
  return new CheckRegistry();
}

/**
 * Singleton registry instance shared across the application.
 *
 * Concrete adapters (axe, lighthouse, pixelmatch, structural) register
 * themselves with this instance at startup.
 *
 * @example
 * ```typescript
 * import { registry, registerCheck } from '@webui-rubric/core';
 * registerCheck(myAxeAdapter);
 * const check = registry.getCheck('axe.color-contrast');
 * ```
 */
export const registry = createRegistry();

/**
 * Convenience function to register a check adapter on the singleton registry.
 *
 * @param adapter - The adapter to register.
 */
export function registerCheck(adapter: CheckAdapter): void {
  registry.registerCheck(adapter);
}
