import { cn } from "@/lib/utils";

interface QubereMarkProps {
  className?: string;
}

interface QubereWordmarkProps {
  className?: string;
  suffix?: string;
}

interface QubereLogoProps extends QubereWordmarkProps {
  markClassName?: string;
  showWordmark?: boolean;
}

/**
 * The Qubere mark combines an open modular cube/Q with an outward-expanding
 * isosceles triangle. Keep this geometry and the two brand colors in sync with
 * the public favicon assets.
 */
export function QubereMark({ className }: QubereMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={cn("shrink-0 overflow-visible", className)}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M13 5H35L46 24H35.5L30 15H18L12.5 24L18 33.5H30L35 43H13L2 24L13 5Z"
        fill="#1D1D1F"
      />
      <path d="M23 22L43.4 38.6L36.6 44.4L23 22Z" fill="#0071E3" />
    </svg>
  );
}

export function QubereWordmark({ className, suffix }: QubereWordmarkProps) {
  const accessibleName = suffix ? `Qubere ${suffix}` : "Qubere";

  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)} role="img" aria-label={accessibleName}>
      <span aria-hidden="true" className="font-bold tracking-tight leading-none whitespace-nowrap">Qubere</span>
      {suffix && (
        <span aria-hidden="true" className="font-semibold tracking-tight text-ink-muted">
          {suffix}
        </span>
      )}
    </span>
  );
}

export function QubereLogo({
  className,
  markClassName = "h-9 w-9",
  showWordmark = true,
  suffix,
}: QubereLogoProps) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <QubereMark className={markClassName} />
      {showWordmark && <QubereWordmark className={className} suffix={suffix} />}
    </span>
  );
}
