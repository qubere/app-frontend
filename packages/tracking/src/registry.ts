import type { TrackingProviderAdapter } from "./types";

export class UnknownTrackingAdapterError extends Error {
  constructor(adapterKey: string) {
    super(`Tracking adapter "${adapterKey}" is not registered.`);
    this.name = "UnknownTrackingAdapterError";
  }
}

export class TrackingProviderRegistry {
  private readonly adapters = new Map<string, TrackingProviderAdapter>();

  register(adapter: TrackingProviderAdapter): this {
    if (this.adapters.has(adapter.adapterKey)) {
      throw new Error(`Tracking adapter "${adapter.adapterKey}" is already registered.`);
    }
    this.adapters.set(adapter.adapterKey, adapter);
    return this;
  }

  get(adapterKey: string): TrackingProviderAdapter {
    const adapter = this.adapters.get(adapterKey);
    if (!adapter) throw new UnknownTrackingAdapterError(adapterKey);
    return adapter;
  }

  has(adapterKey: string): boolean {
    return this.adapters.has(adapterKey);
  }

  keys(): string[] {
    return [...this.adapters.keys()].sort();
  }
}
