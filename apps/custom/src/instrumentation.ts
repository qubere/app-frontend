export async function register() {
  // Node-only: edge runtime re-invokes register() without node globals.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const events = await import("events");
      const EE = events?.EventEmitter || (events as any)?.default?.EventEmitter;
      if (EE && typeof EE === "function" && "defaultMaxListeners" in EE) {
        EE.defaultMaxListeners = 25;
      }
    } catch {
      // Ignore listener setup if events module structure differs in bundler
    }

    const { logBootConnections } = await import("./lib/bootLog");
    logBootConnections();
  }
}
