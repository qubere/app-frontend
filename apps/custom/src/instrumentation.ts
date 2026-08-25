export async function register() {
  // Next.js's gzip middleware adds a 'drain' listener per concurrent streaming
  // response; the default of 10 triggers a false-positive memory-leak warning
  // when several document-proxy or SSE requests are in flight at the same time.
  const { EventEmitter } = await import("events");
  EventEmitter.defaultMaxListeners = 25;

  // Node-only: edge runtime re-invokes register() without these globals.
  // Dynamically imported (not a top-level import) so the edge bundler never
  // statically parses this module's process.pid/require() usage — a static
  // scan flags those even inside a runtime-guarded branch of the same file.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logBootConnections } = await import("./lib/bootLog");
    logBootConnections();
  }
}
