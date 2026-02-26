import * as React from "react";
import { cn } from "@/lib/utils";

// Common status types in ERP
export type StatusType = 
  | "draft" | "issued" | "submitted" 
  | "posted" | "approved" 
  | "paid" | "partially_paid" | "unpaid"
  | "received" | "partially_received" | "fully_received"
  | "cancelled" | "voided" | "rejected"
  | "active" | "inactive"
  | "pending" | "completed" | "overdue";

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
  showDot?: boolean;
}

// Status to config mapping
const statusConfig: Record<StatusType, { color: string; label: string; dotColor: string }> = {
  // Draft/Initial states
  draft: { color: "bg-gray-100 text-gray-800", label: "Draft", dotColor: "bg-gray-500" },
  pending: { color: "bg-yellow-100 text-yellow-800", label: "Pending", dotColor: "bg-yellow-500" },
  submitted: { color: "bg-blue-100 text-blue-800", label: "Submitted", dotColor: "bg-blue-500" },
  
  // Approval states
  issued: { color: "bg-blue-100 text-blue-800", label: "Issued", dotColor: "bg-blue-500" },
  approved: { color: "bg-green-100 text-green-800", label: "Approved", dotColor: "bg-green-500" },
  rejected: { color: "bg-red-100 text-red-800", label: "Rejected", dotColor: "bg-red-500" },
  
  // Posting states
  posted: { color: "bg-emerald-100 text-emerald-800", label: "Posted", dotColor: "bg-emerald-500" },
  voided: { color: "bg-red-100 text-red-800", label: "Voided", dotColor: "bg-red-500" },
  cancelled: { color: "bg-red-100 text-red-800", label: "Cancelled", dotColor: "bg-red-500" },
  
  // Payment states
  paid: { color: "bg-green-100 text-green-800", label: "Paid", dotColor: "bg-green-500" },
  partially_paid: { color: "bg-yellow-100 text-yellow-800", label: "Partially Paid", dotColor: "bg-yellow-500" },
  unpaid: { color: "bg-red-100 text-red-800", label: "Unpaid", dotColor: "bg-red-500" },
  
  // Receiving states
  received: { color: "bg-blue-100 text-blue-800", label: "Received", dotColor: "bg-blue-500" },
  partially_received: { color: "bg-yellow-100 text-yellow-800", label: "Partially Received", dotColor: "bg-yellow-500" },
  fully_received: { color: "bg-green-100 text-green-800", label: "Fully Received", dotColor: "bg-green-500" },
  
  // General states
  active: { color: "bg-green-100 text-green-800", label: "Active", dotColor: "bg-green-500" },
  inactive: { color: "bg-gray-100 text-gray-800", label: "Inactive", dotColor: "bg-gray-500" },
  completed: { color: "bg-green-100 text-green-800", label: "Completed", dotColor: "bg-green-500" },
  overdue: { color: "bg-red-100 text-red-800", label: "Overdue", dotColor: "bg-red-500" },
};

function normalizeStatus(status: string): StatusType {
  const normalized = status.toLowerCase().replace(/[\s-]/g, "_");
  return (normalized as StatusType) || "draft";
}

export function StatusBadge({ status, className, showDot = false }: StatusBadgeProps) {
  const normalizedStatus = normalizeStatus(status);
  const config = statusConfig[normalizedStatus] || statusConfig.draft;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
        config.color,
        className
      )}
    >
      {showDot && (
        <span className={cn("w-1.5 h-1.5 rounded-full", config.dotColor)} />
      )}
      {config.label}
    </span>
  );
}
