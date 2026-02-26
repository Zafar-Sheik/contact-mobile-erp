import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DocNumberChip, DocType } from "./doc-number-chip";
import { ExternalLink } from "lucide-react";

export interface LinkedDocument {
  id: string;
  type: DocType;
  number: string;
  status?: string;
}

interface DocLinkPreviewProps {
  documents: LinkedDocument[];
  maxDisplay?: number;
  className?: string;
}

export function DocLinkPreview({ documents, maxDisplay = 3, className }: DocLinkPreviewProps) {
  if (!documents || documents.length === 0) {
    return (
      <span className={cn("text-sm text-gray-400", className)}>
        No linked documents
      </span>
    );
  }

  const displayDocs = documents.slice(0, maxDisplay);
  const remaining = documents.length - maxDisplay;

  const getHref = (type: DocType, id: string): string => {
    const pathMap: Record<DocType, string> = {
      po: `/purchase-orders/${id}`,
      grv: `/grvs/${id}`,
      bill: `/supplier-bills/${id}`,
      payment: `/supplier-payments/${id}`,
      quote: `/quotes/${id}`,
      invoice: `/invoices/${id}`,
      supplier: `/suppliers/${id}`,
      client: `/clients/${id}`,
    };
    return pathMap[type] || "#";
  };

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {displayDocs.map((doc) => {
        const href = getHref(doc.type, doc.id);
        
        return (
          <Link
            key={`${doc.type}-${doc.id}`}
            href={href}
            className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
          >
            <DocNumberChip 
              type={doc.type} 
              number={doc.number}
            />
            <ExternalLink className="w-3 h-3 text-gray-400" />
          </Link>
        );
      })}
      
      {remaining > 0 && (
        <span className="text-xs text-gray-500 self-center">
          +{remaining} more
        </span>
      )}
    </div>
  );
}

// For displaying single linked document inline
export function InlineDocLink({ 
  type, 
  id, 
  number,
  className 
}: {
  type: DocType;
  id: string;
  number: string;
  className?: string;
}) {
  const href = type === "po" ? `/purchase-orders/${id}` 
    : type === "grv" ? `/grvs/${id}`
    : type === "bill" ? `/supplier-bills/${id}`
    : type === "payment" ? `/supplier-payments/${id}`
    : type === "quote" ? `/quotes/${id}`
    : type === "invoice" ? `/invoices/${id}`
    : "#";

  return (
    <Link 
      href={href} 
      className={cn("inline-flex items-center gap-1 hover:underline", className)}
    >
      <DocNumberChip type={type} number={number} />
    </Link>
  );
}
