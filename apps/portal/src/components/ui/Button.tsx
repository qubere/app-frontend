import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-xs",
        secondary: "bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5EA] shadow-xs",
        outline: "bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5EA] shadow-xs",
        danger: "bg-red-600 hover:bg-red-700 text-white shadow-xs",
        ghost: "text-[#1D1D1F] hover:bg-[#F5F5F7]",
      },
      size: {
        sm: "text-xs px-3 py-2 rounded-lg",
        md: "text-xs px-4 py-2.5 rounded-xl",
        lg: "text-sm px-5 py-3 rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
