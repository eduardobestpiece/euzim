import { AsyncLocalStorage } from "node:async_hooks";

export type UsageAttribution = {
  jobId?: string | null;
  storyId?: string | null;
  generationKey?: string | null;
};

const storage = new AsyncLocalStorage<UsageAttribution>();

/** Escopo de atribuição para todos os recordUsageEvent / meteredChat no call stack. */
export function runWithUsageContext<T>(
  ctx: UsageAttribution,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run({ ...ctx }, fn);
}

export function getUsageContext(): UsageAttribution {
  return storage.getStore() ?? {};
}

export function mergeUsageContext(patch: UsageAttribution): void {
  const cur = storage.getStore();
  if (!cur) return;
  Object.assign(cur, patch);
}
