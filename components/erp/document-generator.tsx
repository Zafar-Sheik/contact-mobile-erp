"use client";

import * as React from "react";
import { Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Company information interface
 */
export interface DocumentCompanyInfo {
  legalName: string;
  tradingName?: string;
  registrationNumber?: string;
  vatNumber?: string;
  isVatRegistered?: boolean;
  email?: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    provinceState?: string;
    country?: string;
    postalCode?: string;
  };
  logoUrl?: string;
  banking?: {
    bankName?: string;
    accountHolderName?: string;
    accountNumber?: string;
    branchNumber?: string;
  };
}

/**
 * Customer information interface
 */
export interface DocumentCustomerInfo {
  name: string;
  email?: string;
  phone?: string;
  clientCode?: string;
  billingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    provinceState?: string;
    country?: string;
    postalCode?: string;
  };
  vatNumber?: string;
}

/**
 * Line item interface
 */
export interface DocumentLineItem {
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

/**
 * Document data interface
 */
export interface DocumentData {
  documentNumber: string;
  documentType: "invoice" | "quote" | "purchase_order" | "grv";
  date: string;
  dueDate?: string | null;
  customer: DocumentCustomerInfo;
  lines: DocumentLineItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  notes?: string;
  company: DocumentCompanyInfo;
}

/**
 * Format cents to currency string
 */
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(cents / 100); // Divide by 100 to convert cents to Rands
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Get document title
 */
function getDocumentTitle(documentType: DocumentData["documentType"]): string {
  switch (documentType) {
    case "invoice":
      return "INVOICE";
    case "quote":
      return "QUOTATION";
    case "purchase_order":
      return "PURCHASE ORDER";
    case "grv":
      return "GOODS RECEIVED VOUCHER";
    default:
      return "DOCUMENT";
  }
}

/**
 * Get document label
 */
function getDocumentLabel(documentType: DocumentData["documentType"]): string {
  switch (documentType) {
    case "invoice":
      return "Invoice Number";
    case "quote":
      return "Quote Number";
    case "purchase_order":
      return "PO Number";
    case "grv":
      return "GRV Number";
    default:
      return "Document Number";
  }
}

/**
 * Document preview component (printable)
 */
export function DocumentPreview({
  data,
  className,
}: {
  data: DocumentData;
  className?: string;
}) {
  const company = data.company;
  const customer = data.customer;

  return (
    <div
      className={`bg-white p-8 max-w-4xl mx-auto text-sm ${className}`}
      id="document-preview"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        {/* Company Info */}
        <div className="w-1/2">
          {company.logoUrl && (
            <img
              src={company.logoUrl}
              alt={company.tradingName || company.legalName}
              className="h-16 w-auto object-contain mb-4"
            />
          )}
          <h1 className="text-xl font-bold text-gray-900">
            {company.tradingName || company.legalName}
          </h1>
          {company.registrationNumber && (
            <p className="text-gray-600">Reg: {company.registrationNumber}</p>
          )}
          {company.isVatRegistered && company.vatNumber && (
            <p className="text-gray-600">VAT: {company.vatNumber}</p>
          )}
          {company.email && <p className="text-gray-600">{company.email}</p>}
          {company.phone && <p className="text-gray-600">{company.phone}</p>}
          {company.address && (
            <div className="text-gray-600 mt-1">
              {[company.address.line1, company.address.line2]
                .filter(Boolean)
                .join(", ")}
              <br />
              {company.address.city}
              {company.address.provinceState && `, ${company.address.provinceState}`}
              <br />
              {company.address.postalCode}
              {company.address.country && `, ${company.address.country}`}
            </div>
          )}
          {/* Bank Details */}
          {company.banking && (company.banking.bankName || company.banking.accountNumber) && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-gray-700 font-medium">Bank Details:</p>
              <p className="text-gray-600 text-xs">
                {company.banking.bankName && <span>{company.banking.bankName}</span>}
                {company.banking.accountHolderName && <span> | {company.banking.accountHolderName}</span>}
                {company.banking.accountNumber && <span> | Acc: {company.banking.accountNumber}</span>}
                {company.banking.branchNumber && <span> | Branch: {company.banking.branchNumber}</span>}
              </p>
            </div>
          )}
        </div>

        {/* Document Info */}
        <div className="w-1/2 text-right">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {getDocumentTitle(data.documentType)}
          </h2>
          <p className="text-lg font-semibold text-gray-700">
            {data.documentNumber}
          </p>
          <table className="mt-4 text-right ml-auto">
            <tbody>
              <tr>
                <td className="text-gray-600 pr-4">Date:</td>
                <td className="font-medium">{formatDate(data.date)}</td>
              </tr>
              {data.dueDate && (
                <tr>
                  <td className="text-gray-600 pr-4">Due Date:</td>
                  <td className="font-medium">{formatDate(data.dueDate)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill To */}
      <div className="mb-8">
        <h3 className="text-gray-500 text-xs uppercase tracking-wide mb-1">
          Bill To:
        </h3>
        <div className="bg-gray-50 p-4 rounded">
          <p className="font-semibold text-gray-900">
            {customer.name}
            {customer.clientCode && (
              <span className="text-gray-500 font-normal ml-2">
                ({customer.clientCode})
              </span>
            )}
          </p>
          {customer.email && <p className="text-gray-600">{customer.email}</p>}
          {customer.phone && <p className="text-gray-600">{customer.phone}</p>}
          {customer.billingAddress && (
            <div className="text-gray-600 mt-1">
              {[
                customer.billingAddress.line1,
                customer.billingAddress.line2,
              ]
                .filter(Boolean)
                .join(", ")}
              <br />
              {customer.billingAddress.city}
              {customer.billingAddress.provinceState &&
                `, ${customer.billingAddress.provinceState}`}
              <br />
              {customer.billingAddress.postalCode}
              {customer.billingAddress.country &&
                `, ${customer.billingAddress.country}`}
            </div>
          )}
          {customer.vatNumber && (
            <p className="text-gray-600 mt-1">VAT: {customer.vatNumber}</p>
          )}
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full mb-8">
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="text-left py-3 text-gray-700 font-semibold">Description</th>
            <th className="text-right py-3 text-gray-700 font-semibold w-24">
              Qty
            </th>
            <th className="text-right py-3 text-gray-700 font-semibold w-32">
              Unit Price
            </th>
            <th className="text-right py-3 text-gray-700 font-semibold w-32">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, index) => (
            <tr key={index} className="border-b border-gray-200">
              <td className="py-3 text-gray-900">{line.description}</td>
              <td className="py-3 text-right text-gray-700">{line.qty}</td>
              <td className="py-3 text-right text-gray-700">
                {formatCurrency(line.unitPrice)}
              </td>
              <td className="py-3 text-right text-gray-900 font-medium">
                {formatCurrency(line.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-64">
          <div className="flex justify-between py-2">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium">{formatCurrency(data.subtotal)}</span>
          </div>
          {data.vatRate > 0 && (
            <div className="flex justify-between py-2">
              <span className="text-gray-600">
                VAT ({data.vatRate}%):
              </span>
              <span className="font-medium">{formatCurrency(data.vatAmount)}</span>
            </div>
          )}
          <div className="flex justify-between py-3 border-t-2 border-gray-300 font-bold text-lg">
            <span>Total:</span>
            <span>{formatCurrency(data.total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {data.notes && (
        <div className="mb-8">
          <h3 className="text-gray-500 text-xs uppercase tracking-wide mb-2">
            Notes:
          </h3>
          <p className="text-gray-700 whitespace-pre-wrap">{data.notes}</p>
        </div>
      )}

      {/* Signature Area */}
      <div className="mt-16 pt-8 border-t border-gray-300">
        <div className="flex justify-between">
          <div className="w-64">
            <div className="border-b border-gray-400 h-16"></div>
            <p className="text-gray-500 text-xs mt-1">Authorized Signature</p>
          </div>
          <div className="w-64">
            <div className="border-b border-gray-400 h-16"></div>
            <p className="text-gray-500 text-xs mt-1">Date</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-gray-400 text-xs">
        <p>
          Thank you for your business
        </p>
      </div>
    </div>
  );
}

/**
 * Print handler
 */
function handlePrint() {
  const content = document.getElementById("document-preview");
  if (!content) {
    // Fallback: try to find any document preview element
    const previews = document.querySelectorAll('[class*="document-preview"]');
    if (previews.length === 0) {
      console.error("Document preview not found");
      return;
    }
    // Use the first matching element
    const firstPreview = previews[0] as HTMLElement;
    printDocumentContent(firstPreview.innerHTML);
    return;
  }
  printDocumentContent(content.innerHTML);
}

function printDocumentContent(htmlContent: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to print documents");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Document</title>
        <style>
          @media print {
            body { margin: 0; }
            @page { margin: 1cm; size: A4; }
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 12px;
            line-height: 1.5;
            color: #111;
            max-width: 210mm;
            margin: 0 auto;
            padding: 20px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 16px 0;
          }
          th, td { 
            padding: 8px 12px; 
            text-align: left; 
            border-bottom: 1px solid #e5e5e5;
          }
          th {
            background-color: #f9f9f9;
            font-weight: 600;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .text-sm { font-size: 11px; }
          .text-lg { font-size: 14px; }
          .uppercase { text-transform: uppercase; }
          .tracking-wide { letter-spacing: 0.05em; }
          .border-b { border-bottom: 1px solid #e5e5e5; }
          .border-b-2 { border-bottom: 2px solid #333; }
          .border-t { border-top: 1px solid #e5e5e5; }
          .border-t-2 { border-top: 2px solid #333; }
          .py-2 { padding-top: 8px; padding-bottom: 8px; }
          .py-3 { padding-top: 12px; padding-bottom: 12px; }
          .py-4 { padding-top: 16px; padding-bottom: 16px; }
          .mb-2 { margin-bottom: 8px; }
          .mb-4 { margin-bottom: 16px; }
          .mb-8 { margin-bottom: 32px; }
          .mt-4 { margin-top: 16px; }
          .mt-8 { margin-top: 32px; }
          .mt-16 { margin-top: 64px; }
          .flex { display: flex; }
          .justify-between { justify-content: space-between; }
          .gap-4 { gap: 16px; }
          .w-full { width: 100%; }
          .grid { display: grid; }
          .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
          .gap-4 { gap: 16px; }
          .print-instructions {
            background: #f0f0f0;
            padding: 12px;
            margin-bottom: 20px;
            border-radius: 4px;
            font-size: 11px;
          }
          @media print {
            .print-instructions { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="print-instructions">
          <strong>To save as PDF:</strong> Press Ctrl+P (or Cmd+P on Mac), then select "Save as PDF" as the destination.
        </div>
        ${htmlContent}
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}

/**
 * PDF Download handler - opens print dialog with instructions
 */
function handleDownloadPdf() {
  // Show instructions before printing
  const content = document.getElementById("document-preview");
  if (!content) {
    const previews = document.querySelectorAll('[class*="document-preview"]');
    if (previews.length === 0) {
      console.error("Document preview not found");
      return;
    }
    const firstPreview = previews[0] as HTMLElement;
    printDocumentContent(firstPreview.innerHTML);
    return;
  }
  printDocumentContent(content.innerHTML);
}

/**
 * Document actions component (buttons)
 */
export function DocumentActions({
  data,
  className,
}: {
  data: DocumentData;
  className?: string;
}) {
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);

  const handlePrint = React.useCallback(async () => {
    setIsPrinting(true);
    try {
      // Find and print the document
      const content = document.getElementById("document-preview");
      if (!content) {
        // Try to find any document preview element
        const previews = document.querySelectorAll('[class*="document-preview"]');
        if (previews.length === 0) {
          console.error("Document preview not found");
          return;
        }
        const firstPreview = previews[0] as HTMLElement;
        printDocumentContent(firstPreview.innerHTML);
        return;
      }
      printDocumentContent(content.innerHTML);
    } finally {
      // Small delay to prevent double-clicks
      setTimeout(() => setIsPrinting(false), 500);
    }
  }, []);

  const handleDownloadPdf = React.useCallback(async () => {
    setIsDownloading(true);
    try {
      // Show instructions for saving as PDF
      const content = document.getElementById("document-preview");
      if (!content) {
        const previews = document.querySelectorAll('[class*="document-preview"]');
        if (previews.length === 0) {
          console.error("Document preview not found");
          return;
        }
        const firstPreview = previews[0] as HTMLElement;
        printDocumentContent(firstPreview.innerHTML);
        return;
      }
      printDocumentContent(content.innerHTML);
    } finally {
      setTimeout(() => setIsDownloading(false), 500);
    }
  }, []);

  return (
    <div className={`flex gap-2 ${className || ""}`}>
      <Button
        variant="outline"
        onClick={handlePrint}
        disabled={isPrinting || isDownloading}
        className="flex-1"
      >
        {isPrinting ? (
          <span className="animate-spin mr-2">⏳</span>
        ) : (
          <Printer className="h-4 w-4 mr-2" />
        )}
        Print
      </Button>
      <Button
        variant="default"
        onClick={handleDownloadPdf}
        disabled={isPrinting || isDownloading}
        className="flex-1 bg-blue-600 hover:bg-blue-700"
      >
        {isDownloading ? (
          <span className="animate-spin mr-2">⏳</span>
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        Save as PDF
      </Button>
    </div>
  );
}

/**
 * Full document component with preview and actions
 */
export function DocumentGenerator({
  data,
  showActions = true,
  className,
}: {
  data: DocumentData;
  showActions?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      {showActions && <DocumentActions data={data} className="mb-4" />}
      <DocumentPreview data={data} />
    </div>
  );
}
