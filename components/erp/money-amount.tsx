import * as React from "react";
import { cn } from "@/lib/utils";

interface MoneyAmountProps {
  cents: number;
  className?: string;
  showSign?: boolean;
  size?: "sm" | "md" | "lg";
  color?: "default" | "success" | "warning" | "danger";
}

// Format currency - using ZAR as default
const formatCurrency = (cents: number, locale = "en-ZA"): string => {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "ZAR",
  }).format(cents / 100);
};

const sizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

const colorClasses = {
  default: "",
  success: "text-green-600",
  warning: "text-yellow-600",
  danger: "text-red-600",
};

export function MoneyAmount({ 
  cents, 
  className, 
  showSign = false, 
  size = "md",
  color = "default",
}: MoneyAmountProps) {
  const formatted = formatCurrency(Math.abs(cents));
  const sign = cents < 0 ? "-" : showSign && cents > 0 ? "+" : "";
  
  // Determine color based on amount
  const resolvedColor = color === "default" 
    ? (cents < 0 ? "danger" : cents > 0 ? "success" : "default")
    : color;

  return (
    <span
      className={cn(
        "font-medium",
        sizeClasses[size],
        colorClasses[resolvedColor],
        className
      )}
    >
      {sign}{formatted}
    </span>
  );
}

// For inline display with currency symbol
export function MoneyInput({ 
  value, 
  onChange, 
  className,
  placeholder = "0.00",
}: {
  value: number | string;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Allow empty, decimal numbers
    const numValue = parseFloat(inputValue) || 0;
    onChange(numValue);
  };

  return (
    <div className={cn("relative", className)}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R</span>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full pl-7 pr-3 py-2 border rounded-md"
      />
    </div>
  );
}
