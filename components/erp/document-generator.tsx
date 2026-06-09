"use client";

import * as React from "react";
import { Printer, Download, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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

export interface DocumentLineItem {
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

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
  showItemPrices?: boolean;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(cents / 100);
}

function formatDate(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

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

export function DocumentPreview({
  data,
  className,
  showItemPrices,
}: {
  data: DocumentData;
  className?: string;
  showItemPrices?: boolean;
}) {
  const company = data.company;
  const customer = data.customer;
  const showPrices = showItemPrices ?? data.showItemPrices ?? true;

  return (
    <div
      className={
        "bg-white text-sm " + (className || "")
      }
      style={{ width: "min(100vw, 210mm)", padding: "clamp(12px, 3vw, 24px)" }}
    >
      <div
        className="flex flex-col md:flex-row md:items-start md:justify-between gap-6"
        style={{ marginBottom: 24 }}
      >
        <div>
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

        <div className="text-left md:text-right">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {getDocumentTitle(data.documentType)}
          </h2>
          <p className="text-lg font-semibold text-gray-700">
            {data.documentNumber}
          </p>
          <table className="mt-4 md:ml-auto">
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

      <div className="overflow-x-auto mb-8">
        <table className="w-full min-w-[320px]">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-3 text-gray-700 font-semibold">Description</th>
              <th className="text-right py-3 text-gray-700 font-semibold w-24">
                Qty
              </th>
              {showPrices && (
                <>
                  <th className="text-right py-3 text-gray-700 font-semibold w-32">
                    Unit Price
                  </th>
                  <th className="text-right py-3 text-gray-700 font-semibold w-32">
                    Total
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line, index) => (
              <tr key={index} className="border-b border-gray-200">
                <td className="py-3 text-gray-900">{line.description}</td>
                <td className="py-3 text-right text-gray-700">{line.qty}</td>
                {showPrices && (
                  <>
                    <td className="py-3 text-right text-gray-700">
                      {formatCurrency(line.unitPrice)}
                    </td>
                    <td className="py-3 text-right text-gray-900 font-medium">
                      {formatCurrency(line.total)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mb-8">
        <div className="w-full md:w-64">
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

      {data.notes && (
        <div className="mb-8">
          <h3 className="text-gray-500 text-xs uppercase tracking-wide mb-2">
            Notes:
          </h3>
          <p className="text-gray-700 whitespace-pre-wrap">{data.notes}</p>
        </div>
      )}

      <div className="mt-16 pt-8 border-t border-gray-300">
        <div className="flex flex-col md:flex-row md:justify-between gap-6">
          <div className="md:w-64">
            <div className="border-b border-gray-400 h-16"></div>
            <p className="text-gray-500 text-xs mt-1">Authorized Signature</p>
          </div>
          <div className="md:w-64">
            <div className="border-b border-gray-400 h-16"></div>
            <p className="text-gray-500 text-xs mt-1">Date</p>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-gray-400 text-xs">
        <p>
          Thank you for your business
        </p>
      </div>
    </div>
  );
}

export function DocumentPreviewPrimitive({
  data,
  className,
  showItemPrices,
}: {
  data: DocumentData;
  className?: string;
  showItemPrices?: boolean;
}) {
  return <DocumentPreview data={data} className={className} showItemPrices={showItemPrices} />;
}

function buildTableHeader(showPrices: boolean) {
  if (showPrices) {
    return `
      <tr style="border-bottom:2px solid #333;">
        <th style="text-align:left;padding:10px 0;color:#333;font-weight:600;">Description</th>
        <th style="text-align:right;padding:10px 0;color:#333;font-weight:600;width:80px;">Qty</th>
        <th style="text-align:right;padding:10px 0;color:#333;font-weight:600;width:120px;">Unit Price</th>
        <th style="text-align:right;padding:10px 0;color:#333;font-weight:600;width:120px;">Total</th>
      </tr>`;
  }
  return `
    <tr style="border-bottom:2px solid #333;">
      <th style="text-align:left;padding:10px 0;color:#333;font-weight:600;">Description</th>
      <th style="text-align:right;padding:10px 0;color:#333;font-weight:600;width:80px;">Qty</th>
    </tr>`;
}

function buildLineRows(data: DocumentData, showPrices: boolean) {
  return data.lines
    .map(
      (line) => {
        const unitPriceCell = showPrices
          ? `<td style="padding:10px 0;text-align:right;color:#333;">${formatCurrency(line.unitPrice)}</td>`
          : "";
        const totalCell = showPrices
          ? `<td style="padding:10px 0;text-align:right;color:#111;font-weight:600;">${formatCurrency(line.total)}</td>`
          : "";
        return `<tr style="border-bottom:1px solid #e5e5e5;">
          <td style="padding:10px 0;color:#111;">${line.description}</td>
          <td style="padding:10px 0;text-align:right;color:#333;">${line.qty}</td>
          ${unitPriceCell}
          ${totalCell}
        </tr>`;
      }
    )
    .join("");
}

function buildPrintDocument(data: DocumentData, showItemPrices: boolean): { title: string; html: string } {
  const company = data.company;
  const customer = data.customer;
  const showPrices = showItemPrices;

  const companyBlock = [
    company.logoUrl
      ? `<img src="${company.logoUrl}" alt="${company.tradingName || company.legalName}" style="height:64px;max-width:180px;object-fit:contain;margin-bottom:16px;" />`
      : "",
    `<h1 style="font-size:20px;font-weight:bold;margin:0 0 4px;color:#111;">${company.tradingName || company.legalName}</h1>`,
    company.registrationNumber ? `<p style="margin:0;color:#555;">Reg: ${company.registrationNumber}</p>` : "",
    company.isVatRegistered && company.vatNumber ? `<p style="margin:0;color:#555;">VAT: ${company.vatNumber}</p>` : "",
    company.email ? `<p style="margin:0;color:#555;">${company.email}</p>` : "",
    company.phone ? `<p style="margin:0;color:#555;">${company.phone}</p>` : "",
    company.address
      ? `<div style="margin-top:4px;color:#555;">${[company.address.line1, company.address.line2].filter(Boolean).join(", ")}<br/>${company.address.city}${company.address.provinceState ? `, ${company.address.provinceState}` : ""}<br/>${company.address.postalCode}${company.address.country ? `, ${company.address.country}` : ""}</div>`
      : "",
    company.banking && (company.banking.bankName || company.banking.accountNumber)
      ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #ddd;"><p style="margin:0 0 4px;font-weight:600;color:#333;">Bank Details:</p><p style="margin:0;font-size:11px;color:#555;">${[company.banking.bankName ? `Bank: ${company.banking.bankName}` : "", company.banking.accountHolderName ? company.banking.accountHolderName : "", company.banking.accountNumber ? `Acc: ${company.banking.accountNumber}` : "", company.banking.branchNumber ? `Branch: ${company.banking.branchNumber}` : ""].filter(Boolean).join(" | ")}</p></div>`
      : "",
  ].join("\n").trim();

  const customerBlock = [
    `<p style="margin:0 0 4px;font-weight:600;color:#111;">${customer.name}${customer.clientCode ? ` <span style="font-weight:400;color:#555;">(${customer.clientCode})</span>` : ""}</p>`,
    customer.email ? `<p style="margin:0;color:#555;">${customer.email}</p>` : "",
    customer.phone ? `<p style="margin:0;color:#555;">${customer.phone}</p>` : "",
    customer.billingAddress
      ? `<div style="margin-top:4px;color:#555;">${[customer.billingAddress.line1, customer.billingAddress.line2].filter(Boolean).join(", ")}<br/>${customer.billingAddress.city}${customer.billingAddress.provinceState ? `, ${customer.billingAddress.provinceState}` : ""}<br/>${customer.billingAddress.postalCode}${customer.billingAddress.country ? `, ${customer.billingAddress.country}` : ""}</div>`
      : "",
    customer.vatNumber ? `<p style="margin:4px 0 0;color:#555;">VAT: ${customer.vatNumber}</p>` : "",
  ].join("\n").trim();

  return {
    title: `${getDocumentTitle(data.documentType)} - ${data.documentNumber}`,
    html: `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${getDocumentTitle(data.documentType)} - ${data.documentNumber}</title>
    <style>
      @page { margin: 15mm; size: A4; }
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 13px;
        line-height: 1.5;
        color: #111;
        margin: 0;
        padding: 0;
      }
      table { width: 100%; border-collapse: collapse; table-layout: auto; }
      th, td { padding: 8px 0; text-align: left; word-wrap: anywhere; }
      .text-right { text-align: right; }
      .font-bold { font-weight: bold; }
      .print-help {
        background: #f0f0f0;
        padding: 10px;
        margin-bottom: 16px;
        border-radius: 4px;
        font-size: 11px;
        color: #333;
      }
      @media print {
        .print-help { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="print-help">
      <strong>To save as PDF on this device:</strong> use the print option and choose <strong>Save as PDF</strong>, or use Share &rarr; <strong>Create PDF</strong> / <strong>Save to Files</strong>.
    </div>
    <div style="display:flex;flex-direction:column;gap:24px;margin-bottom:32px;">
      <div>
        ${companyBlock}
      </div>
      <div style="text-align:left;">
        <h2 style="font-size:22px;font-weight:bold;margin:0 0 8px;color:#111;">${getDocumentTitle(data.documentType)}</h2>
        <p style="font-size:16px;font-weight:600;color:#333;margin:0 0 12px;">${data.documentNumber}</p>
        <table>
          <tbody>
            <tr>
              <td style="color:#555;padding-right:12px;">Date:</td>
              <td style="font-weight:600;color:#111;">${formatDate(data.date)}</td>
            </tr>
            ${data.dueDate ? `<tr>
              <td style="color:#555;padding-right:12px;">Due Date:</td>
              <td style="font-weight:600;color:#111;">${formatDate(data.dueDate)}</td>
            </tr>` : ""}
          </tbody>
        </table>
      </div>
    </div>

    <div style="margin-bottom:32px;">
      <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#888;margin:0 0 6px;">Bill To:</h3>
      <div style="background:#f9f9f9;padding:14px;border-radius:4px;">
        ${customerBlock}
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin:24px 0;">
      <thead>
        ${buildTableHeader(showPrices)}
      </thead>
      <tbody>
        ${buildLineRows(data, showPrices)}
      </tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;margin-bottom:32px;">
      <div style="width:100%;max-width:240px;">
        <div style="display:flex;justify-content:space-between;padding:6px 0;">
          <span style="color:#555;">Subtotal:</span>
          <span style="font-weight:600;color:#111;">${formatCurrency(data.subtotal)}</span>
        </div>
        ${data.vatRate > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;">
          <span style="color:#555;">VAT (${data.vatRate}%):</span>
          <span style="font-weight:600;color:#111;">${formatCurrency(data.vatAmount)}</span>
        </div>` : ""}
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid #333;font-weight:bold;font-size:16px;color:#111;">
          <span>Total:</span>
          <span>${formatCurrency(data.total)}</span>
        </div>
      </div>
    </div>

    ${data.notes ? `<div style="margin-bottom:32px;">
      <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#888;margin:0 0 8px;">Notes:</h3>
      <p style="color:#333;white-space:pre-wrap;">${data.notes}</p>
    </div>` : ""}

    <div style="margin-top:80px;padding-top:24px;border-top:1px solid #ddd;">
      <div style="display:flex;flex-direction:column;gap:24px;">
        <div>
          <div style="border-bottom:1px solid #666;height:48px;max-width:200px;"></div>
          <p style="font-size:11px;color:#777;margin-top:6px;">Authorized Signature</p>
        </div>
        <div>
          <div style="border-bottom:1px solid #666;height:48px;max-width:200px;"></div>
          <p style="font-size:11px;color:#777;margin-top:6px;">Date</p>
        </div>
      </div>
    </div>

    <div style="margin-top:24px;text-align:center;color:#bbb;font-size:11px;">
      <p>Thank you for your business</p>
    </div>
  </body>
</html>`,
  };
}

function buildPrintDocumentPrimitive(data: DocumentData, showItemPrices: boolean) {
  return buildPrintDocument(data, showItemPrices);
}

export function DocumentActions({
  data,
  className,
  showItemPrices,
  onShowItemPricesChange,
}: {
  data: DocumentData;
  className?: string;
  showItemPrices?: boolean;
  onShowItemPricesChange?: (value: boolean) => void;
}) {
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);

  const effectiveShowItemPrices = showItemPrices ?? data.showItemPrices ?? true;

  const openDocumentWindow = React.useCallback(
    async (mode: "print" | "pdf") => {
      const html = buildPrintDocumentPrimitive(data, effectiveShowItemPrices).html;
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        alert("Please allow popups for this site to print or save documents.");
        return;
      }

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();

      await new Promise<void>((resolve) => {
        printWindow.onload = () => resolve();
        const timeout = setTimeout(() => resolve(), 300);
        return () => clearTimeout(timeout);
      });

      try {
        printWindow.focus();
        printWindow.print();
      } catch (error) {
        console.error("Print failed:", error);
        alert("Print failed. Please try again or use your browser's Print/Save as PDF option.");
      }
    },
    [data, effectiveShowItemPrices]
  );

  const handlePrint = React.useCallback(async () => {
    setIsPrinting(true);
    try {
      await openDocumentWindow("print");
    } finally {
      setTimeout(() => setIsPrinting(false), 500);
    }
  }, [openDocumentWindow]);

  const handleDownloadPdf = React.useCallback(async () => {
    setIsDownloading(true);
    try {
      await openDocumentWindow("pdf");
    } finally {
      setTimeout(() => setIsDownloading(false), 500);
    }
  }, [openDocumentWindow]);

  return (
    <div className={`flex flex-col gap-2 ${className || ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Switch
            id="show-item-prices"
            checked={effectiveShowItemPrices}
            onCheckedChange={onShowItemPricesChange}
          />
          <Label htmlFor="show-item-prices" className="text-sm cursor-pointer">
            {effectiveShowItemPrices ? (
              <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" /> Show prices</span>
            ) : (
              <span className="inline-flex items-center gap-1"><EyeOff className="h-4 w-4" /> Hide prices</span>
            )}
          </Label>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={isPrinting || isDownloading}
          >
            {isPrinting ? (
              <span className="animate-spin mr-1">⏳</span>
            ) : (
              <Printer className="h-4 w-4 mr-1" />
            )}
            Print
          </Button>
          <Button
            size="sm"
            onClick={handleDownloadPdf}
            disabled={isPrinting || isDownloading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isDownloading ? (
              <span className="animate-spin mr-1">⏳</span>
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            Save as PDF
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DocumentGenerator({
  data,
  showActions = true,
  className,
}: {
  data: DocumentData;
  showActions?: boolean;
  className?: string;
}) {
  const [showItemPrices, setShowItemPrices] = React.useState(
    data.showItemPrices ?? true
  );

  return (
    <div className={className}>
      {showActions && (
        <DocumentActions
          data={data}
          className="mb-4"
          showItemPrices={showItemPrices}
          onShowItemPricesChange={setShowItemPrices}
        />
      )}
      <DocumentPreview data={data} showItemPrices={showItemPrices} />
    </div>
  );
}
