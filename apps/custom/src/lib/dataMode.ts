// Deliberately the narrow "@qubere/db/dataMode" subpath, not the package root:
// dataMode is imported by client components (e.g. Sidebar, DataModeBanner), and
// the root "@qubere/db" entrypoint also pulls in the Prisma client and
// node:async_hooks, which cannot be bundled into client code.
export * from "@qubere/db/dataMode";
