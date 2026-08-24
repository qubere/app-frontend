import Link from "next/link";

const PRODUCTS = ["ALL", "CUSTOMS", "TMS", "WMS"] as const;

export function ProductLineFilter({ basePath, active }: { basePath: string; active: string }) {
  return <div className="inline-flex p-1 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA]" aria-label="Product module filter">
    {PRODUCTS.map((product) => <Link
      key={product}
      href={product === "ALL" ? basePath : `${basePath}?productLine=${product}`}
      aria-current={active === product ? "page" : undefined}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${active === product ? "bg-white text-brand shadow-sm" : "text-ink-muted hover:text-ink"}`}
    >{product === "ALL" ? "All modules" : product}</Link>)}
  </div>;
}
