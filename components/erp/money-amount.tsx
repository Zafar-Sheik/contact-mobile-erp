import * as React from "react";
import { cn } from "@/lib/utils";

// Numeric input validation function
const validateNumericInput = (value: string): string => {
  // Allow empty string, numbers, and single decimal point
  if (value === "") return value;

  // Remove any characters that aren't digits or decimal point
  const cleaned = value.replace(/[^0-9.]/g, "");

  // Ensure only one decimal point
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    return parts[0] + "." + parts.slice(1).join("");
  }

  return cleaned;
};

// Reusable NumericInput component
export function NumericInput({
  value,
  onChange,
  className,
  placeholder,
  min,
  max,
  step,
  ...props
}: {
  value: number | string;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const [inputValue, setInputValue] = React.useState(value.toString());

  React.useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const validatedValue = validateNumericInput(e.target.value);
    setInputValue(validatedValue);

    // Convert to number for onChange callback
    const numValue = parseFloat(validatedValue) || 0;

    // Apply min/max constraints if provided
    let finalValue = numValue;
    if (min !== undefined && finalValue < min) finalValue = min;
    if (max !== undefined && finalValue > max) finalValue = max;

    onChange(finalValue);
  };

  return (
    <input
      type="text"
      value={inputValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={cn("w-full px-3 py-2 border rounded-md", className)}
      {...props}
    />
  );
}

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
  return (
    <div className={cn("relative", className)}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R</span>
      <NumericInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="pl-7 pr-3 py-2"
        step={0.01}
      />
    </div>
  );
}
