import * as React from "react";
import { cn } from "@/lib/utils";

// Document types for DocNumberChip
export type DocType = "po" | "grv" | "bill" | "payment" | "quote" | "invoice" | "supplier" | "client";

interface DocNumberChipProps {
  type: DocType;
  number: string;
  className?: string;
  onClick?: () => void;
}

// Color mapping for document types
const docTypeConfig: Record<DocType, { bg: string; text: string; label: string }> = {
  po: { bg: "bg-purple-100", text: "text-purple-700", label: "PO" },
  grv: { bg: "bg-blue-100", text: "text-blue-700", label: "GRV" },
  bill: { bg: "bg-orange-100", text: "text-orange-700", label: "BILL" },
  payment: { bg: "bg-green-100", text: "text-green-700", label: "PAY" },
  quote: { bg: "bg-cyan-100", text: "text-cyan-700", label: "QUOTE" },
  invoice: { bg: "bg-indigo-100", text: "text-indigo-700", label: "INV" },
  supplier: { bg: "bg-gray-100", text: "text-gray-700", label: "SUP" },
  client: { bg: "bg-pink-100", text: "text-pink-700", label: "CLI" },
};

export function DocNumberChip({ type, number, className, onClick }: DocNumberChipProps) {
  const config = docTypeConfig[type] || docTypeConfig.po;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
        config.bg,
        config.text,
        onClick && "cursor-pointer hover:opacity-80",
        className
      )}
      onClick={onClick}
    >
      <span className="shrink-0">{config.label}</span>
      <span className="truncate max-w-[100px]">{number}</span>
    </span>
  );
}
