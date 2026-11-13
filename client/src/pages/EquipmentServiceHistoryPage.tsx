import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { FileText, Download, Filter, Calendar, DollarSign, Wrench, TrendingUp, BarChart3 } from "lucide-react";

interface ServiceRecord {
  id: string;
  equipmentId: string;
  equipmentName: string;
  serviceType: string;
  serviceDate: string;
  performedBy: string;
  cost: number;
  description: string;
  partsReplaced?: string[];
  nextServiceDue?: string;
  status: "completed" | "pending" | "cancelled";
}

interface ServiceStats {
  totalCost: number;
  totalServices: number;
  averageCost: number;
  upcomingServices: number;
}

export default function EquipmentServiceHistoryPage() {
  const [filterEquipment, setFilterEquipment] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: serviceHistory = [], isLoading } = useQuery<ServiceRecord[]>({
    queryKey: ["/api/equipment/service-history"],
    queryFn: async () => {
      const res = await fetch("/api/equipment/service-history");
      if (!res.ok) throw new Error("Failed to fetch service history");
      return res.json();
    },
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ["/api/equipment"],
    queryFn: async () => {
      const res = await fetch("/api/equipment");
      if (!res.ok) throw new Error("Failed to fetch equipment");
      return res.json();
    },
  });

  const filteredHistory = serviceHistory.filter((record) => {
    if (filterEquipment !== "all" && record.equipmentId !== filterEquipment) return false;
    if (filterType !== "all" && record.serviceType !== filterType) return false;
    if (searchTerm && !record.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const stats: ServiceStats = {
    totalCost: serviceHistory.reduce((sum, record) => sum + record.cost, 0),
    totalServices: serviceHistory.length,
    averageCost: serviceHistory.length > 0 
      ? serviceHistory.reduce((sum, record) => sum + record.cost, 0) / serviceHistory.length 
      : 0,
    upcomingServices: serviceHistory.filter(r => r.nextServiceDue).length,
  };

  const serviceTypes = Array.from(new Set(serviceHistory.map(r => r.serviceType)));

  const exportToCSV = () => {
    const headers = ["Date", "Equipment", "Service Type", "Performed By", "Cost", "Description", "Status"];
    const rows = filteredHistory.map(record => [
      format(new Date(record.serviceDate), "yyyy-MM-dd"),
      record.equipmentName,
      record.serviceType,
      record.performedBy,
      record.cost.toFixed(2),
      record.description,
      record.status,
    ]);
    
    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `equipment-service-history-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      completed: "default",
      pending: "secondary",
      cancelled: "outline",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          <h1 className="text-lg font-semibold">Equipment Service History</h1>
          <Button size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="history" className="space-y-4">
          <TabsList>
            <TabsTrigger value="history">Service History</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Search descriptions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={filterEquipment} onValueChange={setFilterEquipment}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by equipment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Equipment</SelectItem>
                  {equipment.map((item: any) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {serviceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Service Records</CardTitle>
                <CardDescription>
                  Complete history of all equipment service and maintenance
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : filteredHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No service records found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Service Type</TableHead>
                        <TableHead>Performed By</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Next Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistory.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            {format(new Date(record.serviceDate), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell className="font-medium">
                            {record.equipmentName}
                          </TableCell>
                          <TableCell>{record.serviceType}</TableCell>
                          <TableCell>{record.performedBy}</TableCell>
                          <TableCell>${record.cost.toFixed(2)}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {record.description}
                          </TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                          <TableCell>
                            {record.nextServiceDue
                              ? format(new Date(record.nextServiceDue), "MMM dd, yyyy")
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Services</CardTitle>
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalServices}</div>
                  <p className="text-xs text-muted-foreground">
                    All time service records
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${stats.totalCost.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">
                    Total maintenance spend
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Cost</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${stats.averageCost.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">
                    Per service average
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Upcoming Services</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.upcomingServices}</div>
                  <p className="text-xs text-muted-foreground">
                    Scheduled maintenance
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Service Breakdown by Equipment</CardTitle>
                <CardDescription>
                  Service count and total cost per equipment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Service Count</TableHead>
                      <TableHead>Total Cost</TableHead>
                      <TableHead>Average Cost</TableHead>
                      <TableHead>Last Service</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipment.map((item: any) => {
                      const equipmentServices = serviceHistory.filter(
                        (r) => r.equipmentId === item.id
                      );
                      const totalCost = equipmentServices.reduce((sum, r) => sum + r.cost, 0);
                      const avgCost = equipmentServices.length > 0 ? totalCost / equipmentServices.length : 0;
                      const lastService = equipmentServices.sort(
                        (a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()
                      )[0];

                      if (equipmentServices.length === 0) return null;

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>{equipmentServices.length}</TableCell>
                          <TableCell>${totalCost.toFixed(2)}</TableCell>
                          <TableCell>${avgCost.toFixed(2)}</TableCell>
                          <TableCell>
                            {lastService
                              ? format(new Date(lastService.serviceDate), "MMM dd, yyyy")
                              : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
