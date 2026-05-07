"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  DollarSign,
  Calendar,
  CreditCard,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useApi } from "@/lib/hooks/use-api";
import { MobileMoreMenu, useMobileMoreMenu } from "@/components/mobile/mobile-more-menu";

// Types
interface CustomerPayment {
  _id: string;
  paymentNumber: string;
  clientId: {
    _id: string;
    name: string;
    email: string;
  };
  paymentDate: string;
  paymentMethod: string;
  amountCents: number;
  allocatedCents: number;
  unallocatedCents: number;
  status: string;
  reference: string;
}

// Format currency
const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(cents / 100);
};

// Format date
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-ZA");
};

export default function CustomerPaymentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isOpen: isMoreOpen, open: openMore, close: closeMore } = useMobileMoreMenu();

  // Filters
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [clientFilter, setClientFilter] = React.useState("all");

  // API data
  const { data: payments, loading: isLoading, refetch } = useApi<CustomerPayment[]>("/api/customer-payments");
  const { data: clients } = useApi<{ _id: string; name: string }[]>("/api/clients");

  // Filter payments
  const filteredPayments = React.useMemo(() => {
    if (!payments) return [];

    return payments.filter((payment) => {
      const matchesSearch =
        payment.paymentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.clientId.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.reference.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
      const matchesClient = clientFilter === "all" || payment.clientId._id === clientFilter;

      return matchesSearch && matchesStatus && matchesClient;
    });
  }, [payments, searchTerm, statusFilter, clientFilter]);

  // Calculate totals
  const totals = React.useMemo(() => {
    const totalAmount = filteredPayments.reduce((sum, p) => sum + p.amountCents, 0);
    const totalAllocated = filteredPayments.reduce((sum, p) => sum + p.allocatedCents, 0);
    const totalUnallocated = filteredPayments.reduce((sum, p) => sum + p.unallocatedCents, 0);

    return { totalAmount, totalAllocated, totalUnallocated };
  }, [filteredPayments]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "posted":
        return <Badge variant="default">Posted</Badge>;
      case "reversed":
        return <Badge variant="destructive">Reversed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case "cash":
        return <DollarSign className="h-4 w-4" />;
      case "bank_transfer":
        return <CreditCard className="h-4 w-4" />;
      case "card":
        return <CreditCard className="h-4 w-4" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Mobile Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Customer Payments</h1>
            <p className="text-sm text-gray-600">
              {filteredPayments.length} payments • {formatCurrency(totals.totalAmount)}
            </p>
          </div>
          <Button size="icon" variant="ghost" onClick={openMore} className="h-10 w-10">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.totalAmount)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Allocated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.totalAllocated)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Unallocated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(totals.totalUnallocated)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search payments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filter Row */}
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="posted">Posted</SelectItem>
                    <SelectItem value="reversed">Reversed</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients?.map((client) => (
                      <SelectItem key={client._id} value={client._id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading payments...</div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No payments found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Allocated</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment._id}>
                      <TableCell className="font-medium">
                        {payment.paymentNumber}
                      </TableCell>
                      <TableCell>{payment.clientId.name}</TableCell>
                      <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPaymentMethodIcon(payment.paymentMethod)}
                          <span className="capitalize">
                            {payment.paymentMethod.replace("_", " ")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(payment.amountCents)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{formatCurrency(payment.allocatedCents)}</div>
                          {payment.unallocatedCents > 0 && (
                            <div className="text-orange-600">
                              Unallocated: {formatCurrency(payment.unallocatedCents)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => router.push(`/customer-payments/${payment._id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {payment.status === "posted" && (
                              <DropdownMenuItem
                                onClick={() => router.push(`/customer-payments/${payment._id}/void`)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Void Payment
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-20 right-4 z-10">
        <Button
          size="lg"
          onClick={() => router.push("/customer-payments/new")}
          className="rounded-full h-14 w-14 shadow-lg"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Mobile More Menu */}
      <MobileMoreMenu open={isMoreOpen} onClose={closeMore} />
    </div>
  );
}