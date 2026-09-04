// Only production UI components live here; this file just replaces the
// next/navigation module the components import so they can mount outside
// Next's router. No auth bypass or test route is added to the deployed app.
export function useRouter() {
  return {
    push: (href: string) => { window.history.pushState({}, "", href); },
    replace: (href: string) => { window.history.replaceState({}, "", href); },
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => undefined,
    prefetch: async () => undefined,
  };
}

export function usePathname() {
  return window.location.pathname;
}

export function useSearchParams() {
  return new URLSearchParams(window.location.search);
}
