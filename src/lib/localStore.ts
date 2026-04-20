import { useSyncExternalStore } from "react";
import type { z } from "zod";

export interface LocalStore<T> {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  set: (value: T) => void;
  update: (updater: (prev: T) => T) => void;
}

/**
 * Module-level localStorage store with cached snapshot identity so
 * `useSyncExternalStore` can correctly diff reads.
 *
 * - Validates stored JSON through a Zod schema; invalid payloads are
 *   discarded (keys removed, default returned) with a dev-mode warning.
 * - Listens for cross-tab `storage` events and a custom same-tab event
 *   so writes propagate to every subscriber.
 */
export function createLocalStore<T>(
  key: string,
  schema: z.ZodType<T>,
  defaultValue: T,
): LocalStore<T> {
  const EVENT = `local-store-change:${key}`;
  let cachedRaw: string | null | undefined = undefined;
  let cachedValue: T = defaultValue;

  function read(): T {
    if (typeof window === "undefined") return defaultValue;
    const raw = window.localStorage.getItem(key);
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    if (raw === null) {
      cachedValue = defaultValue;
      return cachedValue;
    }
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`localStore "${key}": malformed JSON, resetting`);
      }
      window.localStorage.removeItem(key);
      cachedRaw = null;
      cachedValue = defaultValue;
      return cachedValue;
    }
    const result = schema.safeParse(parsedJson);
    if (!result.success) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `localStore "${key}": invalid shape, resetting`,
          result.error,
        );
      }
      window.localStorage.removeItem(key);
      cachedRaw = null;
      cachedValue = defaultValue;
      return cachedValue;
    }
    cachedValue = result.data;
    return cachedValue;
  }

  const listeners = new Set<() => void>();
  function notify() {
    for (const l of listeners) l();
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key === key) notify();
    });
    window.addEventListener(EVENT, notify);
  }

  function write(value: T) {
    if (typeof window === "undefined") return;
    const json = JSON.stringify(value);
    window.localStorage.setItem(key, json);
    cachedRaw = json;
    cachedValue = value;
    window.dispatchEvent(new Event(EVENT));
  }

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: read,
    getServerSnapshot: () => defaultValue,
    set: write,
    update: (updater) => {
      const prev = read();
      write(updater(prev));
    },
  };
}

export function useLocalStoreValue<T>(store: LocalStore<T>): T {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}
