import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Package, AlertTriangle, Edit, Trash2, Search, FileText, AlertCircle, Droplet, TrendingDown, Minus, PackagePlus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Product, ProductBatch, User, Animal, AnimalTreatment, MilkWithholding, BatchLifecycleEvent } from "@/../../shared/schema";
import { insertProductSchema, insertProductBatchSchema } from "@/../../shared/schema";
import type { z } from "zod";

type ProductFormData = z.infer<typeof insertProductSchema>;
type BatchFormData = z.infer<typeof insertProductBatchSchema>;

interface ComplianceAlerts {
  expiringBatches: ProductBatch[];
  expiredBatches: ProductBatch[];
  activeWithholdings: (MilkWithholding & { animal?: Animal })[];
  lowStockProducts: Product[];
}

interface BatchUsageHistory {
  batch: ProductBatch;
  events: BatchLifecycleEvent[];
  treatments: AnimalTreatment[];
  animals: Animal[];
}

export default function MedicinesInventory() {
  const [activeTab, setActiveTab] = useState("batches");
  const [searchQuery, setSearchQuery] = useState("");
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingBatch, setEditingBatch] = useState<ProductBatch | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deletingBatch, setDeletingBatch] = useState<ProductBatch | null>(null);
  const [traceabilityBatchId, setTraceabilityBatchId] = useState<string | null>(null);
  const [stockAdjustProduct, setStockAdjustProduct] = useState<Product | null>(null);
  const [stockAdjustMode, setStockAdjustMode] = useState<'add' | 'remove'>('add');
  const [stockAdjustQuantity, setStockAdjustQuantity] = useState<number>(1);

  // Fetch data
  const { data: products = [], isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: batches = [], isLoading: isLoadingBatches } = useQuery<ProductBatch[]>({
    queryKey: ["/api/product-batches"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: complianceAlerts, isLoading: isLoadingAlerts } = useQuery<ComplianceAlerts>({
    queryKey: ["/api/medicine-compliance/alerts"],
  });

  const { data: usageHistory, isLoading: isLoadingUsageHistory } = useQuery<BatchUsageHistory | undefined>({
    queryKey: ['/api/product-batches', traceabilityBatchId, 'usage-history'],
    enabled: !!traceabilityBatchId,
  });

  // Calculate metrics
  const openBatches = batches.filter(b => b.status === 'open');
  const expiringSoon = openBatches.filter(b => {
    if (!b.expiryDate) return false;
    const daysUntilExpiry = Math.ceil(
      (new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
  });

  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const res = await apiRequest('/api/products', 'POST', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast.success('Product added successfully');
      setIsProductDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to add product: ${error.message}`);
    },
  });

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProductFormData> }) => {
      const res = await apiRequest(`/api/products/${id}`, 'PUT', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast.success('Product updated successfully');
      setEditingProduct(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update product: ${error.message}`);
    },
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/products/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast.success('Product deleted successfully');
      setDeletingProduct(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete product: ${error.message}`);
    },
  });

  // Create batch mutation
  const createBatchMutation = useMutation({
    mutationFn: async (data: BatchFormData) => {
      const res = await apiRequest('/api/product-batches', 'POST', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/product-batches'] });
      toast.success('Stock batch added successfully');
      setIsBatchDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to add batch: ${error.message}`);
    },
  });

  // Update batch mutation
  const updateBatchMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BatchFormData> }) => {
      const res = await apiRequest(`/api/product-batches/${id}`, 'PUT', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/product-batches'] });
      toast.success('Stock batch updated successfully');
      setEditingBatch(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update batch: ${error.message}`);
    },
  });

  // Delete batch mutation
  const deleteBatchMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/product-batches/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/product-batches'] });
      toast.success('Stock batch deleted successfully');
      setDeletingBatch(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete batch: ${error.message}`);
    },
  });

  // Adjust stock mutation
  const adjustStockMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const res = await apiRequest(`/api/products/${id}/adjust-stock`, 'POST', { quantity });
      return await res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      const action = variables.quantity > 0 ? 'added to' : 'removed from';
      const count = Math.abs(variables.quantity);
      toast.success(`${count} unit${count !== 1 ? 's' : ''} ${action} stock`);
      setStockAdjustProduct(null);
      setStockAdjustMode('add');
      setStockAdjustQuantity(1);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update stock: ${error.message}`);
    },
  });

  // Dispose expired stock mutation
  const disposeStockMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/products/${id}/dispose-stock`, 'POST');
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to dispose stock');
      }
      return await res.json();
    },
    onSuccess: (_data, productId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/product-batches'] });
      toast.success('Expired stock disposed successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to dispose stock: ${error.message}`);
    },
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-medicines-title">
            Medicine Inventory
          </h1>
          <p className="text-muted-foreground">Track products, stock levels, and expiry dates</p>
        </div>
      </div>

      {expiringSoon.length > 0 && (
        <Card className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950" data-testid="card-expiring-alert">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
              <AlertTriangle className="h-6 w-6" strokeWidth={1.5} />
              Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-800 dark:text-amber-200" data-testid="text-expiring-count">
              {expiringSoon.length} batch{expiringSoon.length !== 1 ? 'es' : ''} expiring in the next 7 days
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card data-testid="card-metric-products">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-metric-open-batches">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Batches</CardTitle>
            <Package className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openBatches.length}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-metric-expiring">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertTriangle className="h-5 w-5 text-amber-500" strokeWidth={1.5} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{expiringSoon.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-3xl grid-cols-4">
          <TabsTrigger value="stocktake" data-testid="tab-stocktake">Stocktake</TabsTrigger>
          <TabsTrigger value="batches" data-testid="tab-batches">Open Batches</TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-products">Products</TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance">
            Compliance
            {complianceAlerts && (complianceAlerts.expiredBatches.length > 0 || complianceAlerts.activeWithholdings.length > 0) && (
              <Badge variant="destructive" className="ml-2 h-5 px-1 text-xs">
                {complianceAlerts.expiredBatches.length + complianceAlerts.activeWithholdings.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stocktake" className="mt-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-2">Unopened Stock Inventory</h2>
            <p className="text-sm text-muted-foreground">
              Track unopened stock items. Add stock when purchased, remove when opened for use.
            </p>
          </div>

          {isLoadingProducts ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : products.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" strokeWidth={1.5} />
                <p className="text-muted-foreground mb-4">No products configured yet.</p>
                <p className="text-sm text-muted-foreground">Add products first, then track stock levels here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {products.map((product) => {
                const expiryDate = product.stockExpiryDate ? new Date(product.stockExpiryDate) : null;
                const isExpired = expiryDate && !isNaN(expiryDate.getTime()) && expiryDate < new Date();
                const hasStock = (product.stockQuantity || 0) > 0;
                
                return (
                  <Card key={product.id} className="hover-elevate" data-testid={`card-stocktake-${product.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="font-semibold text-lg">{product.name}</div>
                            {isExpired && hasStock && (
                              <Badge variant="destructive" data-testid={`badge-expired-${product.id}`}>
                                <AlertCircle className="h-3 w-3 mr-1" strokeWidth={1.5} />
                                Expired
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div>
                              Current Stock: <span className="font-medium text-foreground">{product.stockQuantity || 0} units</span>
                            </div>
                            {product.stockExpiryDate && (
                              <div>
                                Expiry Date: <span className={`font-medium ${isExpired ? 'text-destructive' : 'text-foreground'}`}>
                                  {product.stockExpiryDate}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isExpired && hasStock ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Dispose of ${product.stockQuantity} units of expired ${product.name}?`)) {
                                  disposeStockMutation.mutate(product.id);
                                }
                              }}
                              disabled={disposeStockMutation.isPending}
                              data-testid={`button-dispose-stock-${product.id}`}
                            >
                              <XCircle className="h-4 w-4 mr-1" strokeWidth={1.5} />
                              Dispose
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setStockAdjustProduct(product);
                                  setStockAdjustMode('remove');
                                  setStockAdjustQuantity(1);
                                }}
                                disabled={(product.stockQuantity || 0) === 0}
                                data-testid={`button-remove-stock-${product.id}`}
                              >
                                <Minus className="h-4 w-4 mr-1" strokeWidth={1.5} />
                                Remove
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setStockAdjustProduct(product);
                                  setStockAdjustMode('add');
                                  setStockAdjustQuantity(1);
                                }}
                                data-testid={`button-add-stock-${product.id}`}
                              >
                                <Plus className="h-4 w-4 mr-1" strokeWidth={1.5} />
                                Add
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="batches" className="mt-6">
          <div className="mb-6 flex gap-4">
            <Button onClick={() => setIsBatchDialogOpen(true)} data-testid="button-add-batch">
              <Plus className="mr-2 h-5 w-5" strokeWidth={1.5} />
              Open New Stock
            </Button>
          </div>

          {isLoadingBatches ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : batches.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" strokeWidth={1.5} />
                <p className="text-muted-foreground mb-4">No stock batches recorded yet.</p>
                <Button onClick={() => setIsBatchDialogOpen(true)}>
                  <Plus className="mr-2 h-5 w-5" strokeWidth={1.5} />
                  Open First Batch
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {batches.map((batch) => (
                <Card key={batch.id} className="hover-elevate" data-testid={`card-batch-${batch.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="font-semibold mb-1">{batch.productName}</div>
                        <div className="text-sm text-muted-foreground">Batch {batch.batchNo}</div>
                      </div>
                      <Badge variant={batch.status === 'open' ? 'default' : 'secondary'}>
                        {batch.status}
                      </Badge>
                    </div>
                    {batch.expiryDate && (
                      <div className="text-sm mb-2">
                        <span className="text-muted-foreground">Expires:</span> {batch.expiryDate}
                      </div>
                    )}
                    <div className="text-sm mb-4">
                      <span className="text-muted-foreground">Opened:</span> {batch.dateOpened}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTraceabilityBatchId(batch.id)}
                        data-testid={`button-traceability-${batch.id}`}
                      >
                        <FileText className="h-4 w-4 mr-1" strokeWidth={1.5} />
                        View Traceability
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setEditingBatch(batch)}
                          data-testid={`button-edit-batch-${batch.id}`}
                        >
                          <Edit className="h-4 w-4 mr-1" strokeWidth={1.5} />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeletingBatch(batch)}
                          data-testid={`button-delete-batch-${batch.id}`}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          <div className="mb-6 flex gap-4">
            <Button onClick={() => setIsProductDialogOpen(true)} data-testid="button-add-product">
              <Plus className="mr-2 h-5 w-5" strokeWidth={1.5} />
              Add Product
            </Button>
          </div>

          {isLoadingProducts ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : products.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" strokeWidth={1.5} />
                <p className="text-muted-foreground mb-4">No products configured yet.</p>
                <Button onClick={() => setIsProductDialogOpen(true)}>
                  <Plus className="mr-2 h-5 w-5" strokeWidth={1.5} />
                  Add First Product
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {products.map((product) => (
                <Card key={product.id} className="hover-elevate" data-testid={`card-product-${product.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-lg mb-2">{product.name}</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          {product.milkWithdrawalDays && (
                            <div>
                              <span className="text-muted-foreground">Milk WHP:</span> {product.milkWithdrawalDays}d
                            </div>
                          )}
                          {product.meatWithdrawalDays && (
                            <div>
                              <span className="text-muted-foreground">Meat WHP:</span> {product.meatWithdrawalDays}d
                            </div>
                          )}
                          {product.useByDays && (
                            <div>
                              <span className="text-muted-foreground">Use-by:</span> {product.useByDays}d
                            </div>
                          )}
                          {product.barcode && (
                            <div>
                              <span className="text-muted-foreground">Barcode:</span> {product.barcode}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingProduct(product)}
                          data-testid={`button-edit-product-${product.id}`}
                        >
                          <Edit className="h-4 w-4" strokeWidth={1.5} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeletingProduct(product)}
                          data-testid={`button-delete-product-${product.id}`}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="compliance" className="mt-6">
          {isLoadingAlerts ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {complianceAlerts?.expiredBatches && complianceAlerts.expiredBatches.length > 0 && (
                <Card className="border-destructive bg-destructive/5" data-testid="card-expired-batches">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-6 w-6" strokeWidth={1.5} />
                      Expired Batches ({complianceAlerts.expiredBatches.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {complianceAlerts.expiredBatches.map((batch) => (
                      <div key={batch.id} className="flex items-center justify-between p-3 bg-background rounded-md" data-testid={`expired-batch-${batch.id}`}>
                        <div>
                          <div className="font-medium">{batch.productName}</div>
                          <div className="text-sm text-muted-foreground">Batch: {batch.batchNo} • Expired: {batch.expiryDate}</div>
                        </div>
                        <Badge variant="destructive">Expired</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {complianceAlerts?.expiringBatches && complianceAlerts.expiringBatches.length > 0 && (
                <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950" data-testid="card-expiring-batches">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
                      <AlertTriangle className="h-6 w-6" strokeWidth={1.5} />
                      Expiring Soon ({complianceAlerts.expiringBatches.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {complianceAlerts.expiringBatches.map((batch) => (
                      <div key={batch.id} className="flex items-center justify-between p-3 bg-background rounded-md" data-testid={`expiring-batch-${batch.id}`}>
                        <div>
                          <div className="font-medium">{batch.productName}</div>
                          <div className="text-sm text-muted-foreground">Batch: {batch.batchNo} • Expires: {batch.expiryDate}</div>
                        </div>
                        <Badge variant="outline" className="border-amber-500 text-amber-700">Expiring</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {complianceAlerts?.activeWithholdings && complianceAlerts.activeWithholdings.length > 0 && (
                <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950" data-testid="card-active-withholdings">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                      <Droplet className="h-6 w-6" strokeWidth={1.5} />
                      Active Milk Withholdings ({complianceAlerts.activeWithholdings.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {complianceAlerts.activeWithholdings.map((withholding) => (
                      <div key={withholding.id} className="flex items-center justify-between p-3 bg-background rounded-md" data-testid={`withholding-${withholding.id}`}>
                        <div>
                          <div className="font-medium">
                            {withholding.animal?.cowId || withholding.animal?.naitTag || 'Unknown Animal'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Product: {withholding.productName} • Ends: {withholding.endDate}
                          </div>
                        </div>
                        <Badge variant="outline" className="border-blue-500 text-blue-700">WHP Active</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {complianceAlerts?.lowStockProducts && complianceAlerts.lowStockProducts.length > 0 && (
                <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950" data-testid="card-low-stock">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
                      <TrendingDown className="h-6 w-6" strokeWidth={1.5} />
                      Low Stock Products ({complianceAlerts.lowStockProducts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {complianceAlerts.lowStockProducts.map((product) => (
                      <div key={product.id} className="flex items-center justify-between p-3 bg-background rounded-md" data-testid={`low-stock-${product.id}`}>
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-muted-foreground">Less than 2 open batches available</div>
                        </div>
                        <Badge variant="outline" className="border-orange-500 text-orange-700">Low Stock</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {(!complianceAlerts || (
                complianceAlerts.expiredBatches.length === 0 &&
                complianceAlerts.expiringBatches.length === 0 &&
                complianceAlerts.activeWithholdings.length === 0 &&
                complianceAlerts.lowStockProducts.length === 0
              )) && (
                <Card>
                  <CardContent className="text-center py-12">
                    <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" strokeWidth={1.5} />
                    <p className="text-muted-foreground">All compliance checks passed!</p>
                    <p className="text-sm text-muted-foreground mt-2">No expired batches, active withholdings, or low stock alerts.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Product Dialog */}
      <ProductDialog
        isOpen={isProductDialogOpen || !!editingProduct}
        onClose={() => {
          setIsProductDialogOpen(false);
          setEditingProduct(null);
        }}
        product={editingProduct}
        onSubmit={(data) => {
          if (editingProduct) {
            updateProductMutation.mutate({ id: editingProduct.id, data });
          } else {
            createProductMutation.mutate(data);
          }
        }}
        isSubmitting={createProductMutation.isPending || updateProductMutation.isPending}
      />

      {/* Batch Dialog */}
      <BatchDialog
        isOpen={isBatchDialogOpen || !!editingBatch}
        onClose={() => {
          setIsBatchDialogOpen(false);
          setEditingBatch(null);
        }}
        batch={editingBatch}
        products={products}
        users={users}
        onSubmit={(data) => {
          if (editingBatch) {
            updateBatchMutation.mutate({ id: editingBatch.id, data });
          } else {
            createBatchMutation.mutate(data);
          }
        }}
        isSubmitting={createBatchMutation.isPending || updateBatchMutation.isPending}
      />

      {/* Batch Usage History Dialog */}
      <BatchTraceabilityDialog
        isOpen={!!traceabilityBatchId}
        onClose={() => {
          if (traceabilityBatchId) {
            queryClient.removeQueries({ queryKey: ["/api/product-batches", traceabilityBatchId, "usage-history"] });
          }
          setTraceabilityBatchId(null);
        }}
        usageHistory={usageHistory}
        isLoading={isLoadingUsageHistory}
      />

      {/* Stock Adjustment Dialog */}
      <Dialog open={!!stockAdjustProduct} onOpenChange={() => {
        setStockAdjustProduct(null);
        setStockAdjustMode('add');
        setStockAdjustQuantity(1);
      }}>
        <DialogContent data-testid="dialog-stock-adjust">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-6 w-6" strokeWidth={1.5} />
              {stockAdjustMode === 'add' ? 'Add Stock' : 'Remove Stock'}
            </DialogTitle>
            <DialogDescription>
              {stockAdjustProduct && `${stockAdjustProduct.name} - Current stock: ${stockAdjustProduct.stockQuantity || 0} units`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Quantity</label>
            <Input
              type="number"
              min={1}
              max={stockAdjustMode === 'remove' ? stockAdjustProduct?.stockQuantity : undefined}
              value={stockAdjustQuantity}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                setStockAdjustQuantity(val);
              }}
              data-testid="input-stock-quantity"
            />
            <p className="text-sm text-muted-foreground mt-2">
              New stock level will be: {(stockAdjustProduct?.stockQuantity || 0) + (stockAdjustMode === 'add' ? stockAdjustQuantity : -stockAdjustQuantity)} units
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setStockAdjustProduct(null);
              setStockAdjustMode('add');
              setStockAdjustQuantity(1);
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (stockAdjustProduct) {
                  if (stockAdjustMode === 'remove' && stockAdjustQuantity > (stockAdjustProduct.stockQuantity || 0)) {
                    toast.error(`Cannot remove more than current stock (${stockAdjustProduct.stockQuantity} units available)`);
                    return;
                  }
                  const quantity = stockAdjustMode === 'add' ? stockAdjustQuantity : -stockAdjustQuantity;
                  adjustStockMutation.mutate({
                    id: stockAdjustProduct.id,
                    quantity
                  });
                }
              }}
              disabled={adjustStockMutation.isPending || stockAdjustQuantity === 0}
              data-testid="button-confirm-stock-adjust"
            >
              {adjustStockMutation.isPending ? 'Updating...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Product Confirmation */}
      <Dialog open={!!deletingProduct} onOpenChange={() => setDeletingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this product? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingProduct(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingProduct && deleteProductMutation.mutate(deletingProduct.id)}
              disabled={deleteProductMutation.isPending}
            >
              {deleteProductMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Batch Confirmation */}
      <Dialog open={!!deletingBatch} onOpenChange={() => setDeletingBatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Stock Batch</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this stock batch? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingBatch(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingBatch && deleteBatchMutation.mutate(deletingBatch.id)}
              disabled={deleteBatchMutation.isPending}
            >
              {deleteBatchMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Product Dialog Component
function ProductDialog({
  isOpen,
  onClose,
  product,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSubmit: (data: ProductFormData) => void;
  isSubmitting: boolean;
}) {
  const form = useForm<ProductFormData>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: product || {
      name: '',
      withdrawalDays: undefined,
      milkWithdrawalDays: undefined,
      meatWithdrawalDays: undefined,
      useByDays: undefined,
      treatmentPlan: '',
      barcode: '',
      stockExpiryDate: '',
    },
  });

  useEffect(() => {
    if (product) {
      form.reset(product);
    } else {
      form.reset({
        name: '',
        withdrawalDays: undefined,
        milkWithdrawalDays: undefined,
        meatWithdrawalDays: undefined,
        useByDays: undefined,
        treatmentPlan: '',
        barcode: '',
        stockExpiryDate: '',
      });
    }
  }, [product, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add Product'}</DialogTitle>
          <DialogDescription>
            {product ? 'Update product information' : 'Add a new medicine/treatment product'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name *</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-product-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="milkWithdrawalDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Milk WHP (days)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        data-testid="input-milk-whp"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="meatWithdrawalDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meat WHP (days)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        data-testid="input-meat-whp"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="useByDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Use-by (days)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        data-testid="input-use-by"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barcode</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} data-testid="input-barcode" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stockExpiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock Expiry Date</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} type="date" data-testid="input-stock-expiry-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="treatmentPlan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Treatment Plan</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ''} rows={3} data-testid="textarea-treatment-plan" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : product ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Batch Dialog Component
function BatchDialog({
  isOpen,
  onClose,
  batch,
  products,
  users,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  batch: ProductBatch | null;
  products: Product[];
  users: User[];
  onSubmit: (data: BatchFormData) => void;
  isSubmitting: boolean;
}) {
  const form = useForm<BatchFormData>({
    resolver: zodResolver(insertProductBatchSchema),
    defaultValues: batch || {
      productId: '',
      productName: '',
      batchNo: '',
      expiryDate: '',
      useByDate: '',
      dateOpened: new Date().toISOString().split('T')[0],
      openedBy: undefined,
      emptiedDate: '',
      status: 'open',
      notes: '',
    },
  });

  // Auto-fill product name when product is selected
  const selectedProductId = form.watch('productId');
  useEffect(() => {
    const product = products.find(p => p.id === selectedProductId);
    if (product) {
      form.setValue('productName', product.name);
    }
  }, [selectedProductId, products, form]);

  useEffect(() => {
    if (batch) {
      form.reset(batch);
    } else {
      form.reset({
        productId: '',
        productName: '',
        batchNo: '',
        expiryDate: '',
        useByDate: '',
        dateOpened: new Date().toISOString().split('T')[0],
        openedBy: undefined,
        emptiedDate: '',
        status: 'open',
        notes: '',
      });
    }
  }, [batch, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{batch ? 'Edit Stock Batch' : 'Open New Stock'}</DialogTitle>
          <DialogDescription>
            {batch ? 'Update batch information' : 'Record a new opened batch of stock'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-product">
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="batchNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch Number *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-batch-no" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="dateOpened"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date Opened *</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" data-testid="input-date-opened" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" value={field.value || ''} data-testid="input-expiry-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="useByDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Use-By Date</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" value={field.value || ''} data-testid="input-use-by-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="openedBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opened By</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === 'none' ? undefined : value)} 
                      value={field.value || 'none'}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-opened-by">
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'open'}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="emptied">Emptied</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ''} rows={3} data-testid="textarea-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : batch ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function BatchTraceabilityDialog({
  isOpen,
  onClose,
  usageHistory,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  usageHistory: BatchUsageHistory | null | undefined;
  isLoading: boolean;
}) {
  if (!isOpen) return null;

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'opened': return '📦';
      case 'administered': return '💉';
      case 'transferred': return '🔄';
      case 'emptied': return '🏁';
      case 'disposed': return '🗑️';
      case 'reconciled': return '✅';
      default: return '📋';
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'opened': return 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700';
      case 'administered': return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700';
      case 'transferred': return 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700';
      case 'emptied': return 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700';
      case 'disposed': return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700';
      case 'reconciled': return 'bg-gray-100 dark:bg-gray-800/30 border-gray-300 dark:border-gray-700';
      default: return 'bg-muted border-border';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" data-testid="dialog-batch-traceability">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" strokeWidth={1.5} />
            Batch Usage History
          </DialogTitle>
          <DialogDescription>
            Complete audit trail showing lifecycle events, treatments, and animals
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : usageHistory ? (
          <div className="space-y-6 py-4">
            {/* Section 1: Batch Information */}
            <div>
              <h3 className="font-semibold mb-3 text-base">Batch Information</h3>
              <div className="p-4 bg-muted rounded-md space-y-1.5">
                <div><span className="font-medium">Product:</span> {usageHistory.batch.productName}</div>
                <div><span className="font-medium">Batch No:</span> {usageHistory.batch.batchNo}</div>
                <div><span className="font-medium">Opened:</span> {usageHistory.batch.dateOpened}</div>
                {usageHistory.batch.emptiedDate && (
                  <div><span className="font-medium">Emptied:</span> {usageHistory.batch.emptiedDate}</div>
                )}
                {usageHistory.batch.expiryDate && (
                  <div><span className="font-medium">Expiry:</span> {usageHistory.batch.expiryDate}</div>
                )}
                <div>
                  <span className="font-medium">Status:</span>{' '}
                  <Badge variant={usageHistory.batch.status === 'open' ? 'default' : 'secondary'}>
                    {usageHistory.batch.status}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Section 2: Lifecycle Events Timeline (NEW) */}
            <div>
              <h3 className="font-semibold mb-3 text-base">
                Lifecycle Events ({usageHistory.events.length})
              </h3>
              {usageHistory.events.length === 0 ? (
                <div className="p-6 bg-muted/50 rounded-md border-2 border-dashed border-muted-foreground/25">
                  <p className="text-sm text-muted-foreground text-center">
                    No lifecycle activity recorded yet. Events will appear here once the batch is opened or administered.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {usageHistory.events.map((event: BatchLifecycleEvent) => (
                    <div 
                      key={event.id} 
                      className={`p-4 rounded-md border-2 ${getEventColor(event.eventType)}`}
                      data-testid={`event-${event.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0" role="img" aria-label={event.eventType}>
                          {getEventIcon(event.eventType)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="font-semibold capitalize">{event.eventType}</div>
                            <div className="text-sm text-muted-foreground whitespace-nowrap">
                              {new Date(event.eventTimestamp).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-sm mt-1 space-y-0.5">
                            {event.quantity && <div><span className="font-medium">Quantity:</span> {event.quantity} {event.eventType === 'administered' ? 'ml/doses' : 'units'}</div>}
                            <div><span className="font-medium">User:</span> {event.userName || 'Unknown'}</div>
                            {event.relatedTreatmentId && (
                              <div className="text-xs text-muted-foreground">
                                Related Treatment: {event.relatedTreatmentId.slice(0, 8)}...
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 3: Animals Treated */}
            <div>
              <h3 className="font-semibold mb-3 text-base">
                Animals Treated ({usageHistory.animals.length})
              </h3>
              {usageHistory.animals.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 px-2">No animals treated with this batch yet.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {usageHistory.animals.map((animal: Animal) => (
                    <div key={animal.id} className="p-3 bg-muted rounded-md" data-testid={`traced-animal-${animal.id}`}>
                      <div className="font-medium">{animal.cowId || animal.naitTag || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{animal.breed}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 4: Treatment Records */}
            <div>
              <h3 className="font-semibold mb-3 text-base">
                Treatment Records ({usageHistory.treatments.length})
              </h3>
              {usageHistory.treatments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 px-2">No treatments recorded for this batch.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {usageHistory.treatments.map((treatment: AnimalTreatment) => (
                    <div key={treatment.id} className="p-3 bg-muted rounded-md" data-testid={`traced-treatment-${treatment.id}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{treatment.cowId || 'Unknown Animal'}</div>
                          <div className="text-sm text-muted-foreground">
                            {treatment.condition} • {new Date(treatment.dateTime).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Staff: {treatment.staffMember}
                          </div>
                        </div>
                        <Badge variant="outline">{treatment.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <p>No usage history data found</p>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} data-testid="button-close-traceability">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
