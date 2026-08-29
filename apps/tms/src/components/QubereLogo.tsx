import { cn } from "@/lib/utils";
import Image from "next/image";

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
    <Image
      aria-hidden="true"
      alt=""
      src="/qubere-mark.png"
      width={256}
      height={256}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

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
