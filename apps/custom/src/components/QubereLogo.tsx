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
        d="M28 38.5L24 41L8 32V16L24 7L40 16V28.5"
        stroke="#1D1D1F"
        strokeWidth="7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M22.5 26.5L45.7 37.9L40.3 45.1L22.5 26.5Z" fill="#0071E3" />
    </svg>
  );
}

/**
 * Visual wordmark uses a restrained blue grave accent to cue "Q-bear".
 * The accessible name remains the canonical, unaccented company name.
 */
export function QubereWordmark({ className, suffix }: QubereWordmarkProps) {
  const accessibleName = suffix ? `Qubere ${suffix}` : "Qubere";

  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)} role="img" aria-label={accessibleName}>
      <span aria-hidden="true" className="font-bold tracking-tight leading-none whitespace-nowrap">
        Qub
        <span className="relative inline-block">
          e
          <span className="absolute left-[48%] -top-[0.08em] h-[0.1em] w-[0.34em] -translate-x-1/2 rotate-[35deg] rounded-full bg-brand" />
        </span>
        re
      </span>
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
