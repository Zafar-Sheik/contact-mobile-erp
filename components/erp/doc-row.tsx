import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { StatusBadge, StatusType } from "./status-badge";
import { MoneyAmount } from "./money-amount";
import { MoreHorizontal, ArrowRight } from "lucide-react";

export interface DocRowData {
  id: string;
  number: string;
  date: string;
  status: string | StatusType;
  amount: number;
  counterpart?: string; // supplier or client name
  description?: string;
}

interface DocRowProps {
  data: DocRowData;
  type: "po" | "grv" | "bill" | "payment" | "quote" | "invoice";
  onClick?: () => void;
  href?: string;
  className?: string;
  actions?: React.ReactNode;
}

const typeConfig = {
  po: { label: "PO", hrefPrefix: "/purchase-orders" },
  grv: { label: "GRV", hrefPrefix: "/grvs" },
  bill: { label: "BILL", hrefPrefix: "/supplier-bills" },
  payment: { label: "PAY", hrefPrefix: "/supplier-payments" },
  quote: { label: "QUOTE", hrefPrefix: "/quotes" },
  invoice: { label: "INV", hrefPrefix: "/invoices" },
};

export function DocRow({ 
  data, 
  type, 
  onClick, 
  href,
  className,
  actions 
}: DocRowProps) {
  const config = typeConfig[type];
  const content = (
    <div
      className={cn(
        "bg-white rounded-xl p-4 shadow-sm border border-gray-100",
        "active:scale-[0.99] transition-transform cursor-pointer",
        onClick && "hover:bg-gray-50",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        {/* Left: Doc Number + Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-medium">
              {config.label}
            </span>
            <span className="font-semibold text-gray-900 truncate">{data.number}</span>
          </div>
          
          {data.counterpart && (
            <p className="text-sm text-gray-500 truncate">{data.counterpart}</p>
          )}
          
          {data.description && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{data.description}</p>
          )}
        </div>

        {/* Right: Status + Amount + Arrow */}
        <div className="flex items-center gap-3 ml-2">
          <div className="text-right">
            <StatusBadge status={data.status as StatusType} />
            <p className="text-sm text-gray-500 mt-1">
              {new Date(data.date).toLocaleDateString("en-ZA", {
                day: "numeric",
                month: "short",
              })}
            </p>
          </div>
          
          <MoneyAmount cents={data.amount} size="md" />
          
          <ArrowRight className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      {/* Actions (if provided) */}
      {actions && (
        <div className="mt-3 pt-3 border-t flex gap-2" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// For compact list items
export function CompactDocRow({ 
  data, 
  type, 
  onClick, 
  href,
  className,
}: Omit<DocRowProps, "actions">) {
  const config = typeConfig[type];

  const content = (
    <div
      className={cn(
        "flex items-center justify-between py-3 px-2 -mx-2 rounded-lg",
        "hover:bg-gray-50 cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-medium shrink-0">
          {config.label}
        </span>
        <span className="font-medium text-sm truncate">{data.number}</span>
      </div>
      
      <div className="flex items-center gap-3 shrink-0">
        <StatusBadge status={data.status as StatusType} />
        <MoneyAmount cents={data.amount} size="sm" />
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
