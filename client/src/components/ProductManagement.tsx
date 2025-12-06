import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pill, Edit } from "lucide-react";
import type { Product } from "@shared/schema";

interface ProductManagementProps {
  products: Product[];
  onAdd: (product: { 
    name: string; 
    withdrawalDays?: number; 
    milkWithdrawalDays?: number;
    meatWithdrawalDays?: number;
    useByDays?: number; 
    treatmentPlan?: string;
    barcode?: string 
  }) => void;
  onUpdate: (id: string, product: { 
    name: string; 
    withdrawalDays?: number; 
    milkWithdrawalDays?: number;
    meatWithdrawalDays?: number;
    useByDays?: number; 
    treatmentPlan?: string;
    barcode?: string 
  }) => void;
  onRemove: (id: string) => void;
}

export default function ProductManagement({ products, onAdd, onUpdate, onRemove }: ProductManagementProps) {
  const [name, setName] = useState("");
  const [withdrawalDays, setWithdrawalDays] = useState("");
  const [milkWithdrawalDays, setMilkWithdrawalDays] = useState("");
  const [meatWithdrawalDays, setMeatWithdrawalDays] = useState("");
  const [useByDays, setUseByDays] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isProductListDialogOpen, setIsProductListDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onAdd({
      name,
      withdrawalDays: withdrawalDays ? parseInt(withdrawalDays, 10) : undefined,
      milkWithdrawalDays: milkWithdrawalDays ? parseInt(milkWithdrawalDays, 10) : undefined,
      meatWithdrawalDays: meatWithdrawalDays ? parseInt(meatWithdrawalDays, 10) : undefined,
      useByDays: useByDays ? parseInt(useByDays, 10) : undefined,
      treatmentPlan: treatmentPlan || undefined,
    });
    setName("");
    setWithdrawalDays("");
    setMilkWithdrawalDays("");
    setMeatWithdrawalDays("");
    setUseByDays("");
    setTreatmentPlan("");
    setIsAddDialogOpen(false);
    setIsEditDialogOpen(false);
  };

  const handleEditClick = () => {
    if (selectedProduct) {
      setName(selectedProduct.name);
      setWithdrawalDays(selectedProduct.withdrawalDays?.toString() || "");
      setMilkWithdrawalDays(selectedProduct.milkWithdrawalDays?.toString() || "");
      setMeatWithdrawalDays(selectedProduct.meatWithdrawalDays?.toString() || "");
      setUseByDays(selectedProduct.useByDays?.toString() || "");
      setTreatmentPlan(selectedProduct.treatmentPlan || "");
      setIsViewDialogOpen(false);
      setIsEditDialogOpen(true);
    }
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !selectedProduct) return;
    onUpdate(selectedProduct.id, {
      name,
      withdrawalDays: withdrawalDays ? parseInt(withdrawalDays, 10) : undefined,
      milkWithdrawalDays: milkWithdrawalDays ? parseInt(milkWithdrawalDays, 10) : undefined,
      meatWithdrawalDays: meatWithdrawalDays ? parseInt(meatWithdrawalDays, 10) : undefined,
      useByDays: useByDays ? parseInt(useByDays, 10) : undefined,
      treatmentPlan: treatmentPlan || undefined,
      barcode: selectedProduct.barcode,
    });
    setName("");
    setWithdrawalDays("");
    setMilkWithdrawalDays("");
    setMeatWithdrawalDays("");
    setUseByDays("");
    setTreatmentPlan("");
    setIsEditDialogOpen(false);
    setSelectedProductId(null);
  };

  return (
    <Card data-testid="card-product-management">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pill className="w-5 h-5" />
          Product Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2">
          <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-open-add-product">
            <Plus className="w-4 h-4 mr-2" />
            Add New Product
          </Button>
          <Button variant="outline" onClick={() => setIsProductListDialogOpen(true)} data-testid="button-open-view-products">
            <Pill className="w-4 h-4 mr-2" />
            View Products ({products.length})
          </Button>
        </div>

        {/* Product List Dialog */}
        <Dialog open={isProductListDialogOpen} onOpenChange={setIsProductListDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>View Products ({products.length})</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Command className="rounded-lg border" data-testid="command-products">
                <CommandInput placeholder="Search products..." />
                <CommandList>
                  <CommandEmpty>No products found.</CommandEmpty>
                  <CommandGroup>
                    {products.map((product) => (
                      <CommandItem
                        key={product.id}
                        value={product.name}
                        onSelect={() => {
                          setSelectedProductId(product.id);
                          setIsProductListDialogOpen(false);
                          setIsViewDialogOpen(true);
                        }}
                        data-testid={`command-item-product-${product.id}`}
                      >
                        <div className="flex-1">
                          <div className="font-medium">{product.name}</div>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {product.milkWithdrawalDays !== undefined && (
                              <Badge variant="outline" className="text-xs">Milk: {product.milkWithdrawalDays}d</Badge>
                            )}
                            {product.meatWithdrawalDays !== undefined && (
                              <Badge variant="outline" className="text-xs">Meat: {product.meatWithdrawalDays}d</Badge>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
              {products.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No products added yet. Click "Add New Product" to get started.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setIsProductListDialogOpen(false)} data-testid="button-done-product-list">
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Product Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-product-name">Product Name *</Label>
                <Input
                  id="add-product-name"
                  placeholder="e.g., Metacam 100 ml"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="input-product-name"
                />
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-milk-withdrawal-days">Milk Withdrawal (days)</Label>
                  <Input
                    id="add-milk-withdrawal-days"
                    type="number"
                    min="0"
                    placeholder="e.g., 3"
                    value={milkWithdrawalDays}
                    onChange={(e) => setMilkWithdrawalDays(e.target.value)}
                    data-testid="input-milk-withdrawal-days"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-meat-withdrawal-days">Meat Withdrawal (days)</Label>
                  <Input
                    id="add-meat-withdrawal-days"
                    type="number"
                    min="0"
                    placeholder="e.g., 10"
                    value={meatWithdrawalDays}
                    onChange={(e) => setMeatWithdrawalDays(e.target.value)}
                    data-testid="input-meat-withdrawal-days"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-useby-days">Use-By Days</Label>
                  <Input
                    id="add-useby-days"
                    type="number"
                    min="0"
                    placeholder="e.g., 28"
                    value={useByDays}
                    onChange={(e) => setUseByDays(e.target.value)}
                    data-testid="input-useby-days"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-treatment-plan">Treatment Plan / Instructions</Label>
                <Textarea
                  id="add-treatment-plan"
                  placeholder="e.g., Administer 5ml per 100kg body weight. Repeat after 24 hours if needed."
                  value={treatmentPlan}
                  onChange={(e) => setTreatmentPlan(e.target.value)}
                  rows={3}
                  data-testid="input-treatment-plan"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={!name} data-testid="button-add-product">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* View Product Dialog */}
        {selectedProduct && (
          <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{selectedProduct.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {selectedProduct.withdrawalDays !== undefined && (
                    <Badge variant="outline" data-testid={`badge-withdrawal-${selectedProduct.id}`}>
                      WD: {selectedProduct.withdrawalDays}d
                    </Badge>
                  )}
                  {selectedProduct.milkWithdrawalDays !== undefined && (
                    <Badge variant="outline" data-testid={`badge-milk-withdrawal-${selectedProduct.id}`}>
                      Milk Withdrawal: {selectedProduct.milkWithdrawalDays}d
                    </Badge>
                  )}
                  {selectedProduct.meatWithdrawalDays !== undefined && (
                    <Badge variant="outline" data-testid={`badge-meat-withdrawal-${selectedProduct.id}`}>
                      Meat Withdrawal: {selectedProduct.meatWithdrawalDays}d
                    </Badge>
                  )}
                  {selectedProduct.useByDays !== undefined && (
                    <Badge variant="outline" data-testid={`badge-useby-${selectedProduct.id}`}>
                      Use-By: {selectedProduct.useByDays}d
                    </Badge>
                  )}
                  {selectedProduct.barcode && (
                    <Badge variant="secondary" data-testid={`badge-barcode-${selectedProduct.id}`}>
                      Barcode Mapped
                    </Badge>
                  )}
                </div>
                {selectedProduct.treatmentPlan && (
                  <div>
                    <Label className="text-sm font-medium">Treatment Plan</Label>
                    <p className="text-sm text-muted-foreground mt-1" data-testid={`text-treatment-plan-${selectedProduct.id}`}>
                      {selectedProduct.treatmentPlan}
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleEditClick}
                  data-testid="button-edit-product"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    onRemove(selectedProduct.id);
                    setSelectedProductId(null);
                    setIsViewDialogOpen(false);
                  }}
                  data-testid={`button-delete-product-${selectedProduct.id}`}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
                <Button onClick={() => setIsViewDialogOpen(false)} data-testid="button-done-view">
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Edit Product Dialog */}
        {selectedProduct && (
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Product</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-product-name">Product Name *</Label>
                  <Input
                    id="edit-product-name"
                    placeholder="e.g., Metacam 100 ml"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    data-testid="input-edit-product-name"
                  />
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-milk-withdrawal-days">Milk Withdrawal (days)</Label>
                    <Input
                      id="edit-milk-withdrawal-days"
                      type="number"
                      min="0"
                      placeholder="e.g., 3"
                      value={milkWithdrawalDays}
                      onChange={(e) => setMilkWithdrawalDays(e.target.value)}
                      data-testid="input-edit-milk-withdrawal-days"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-meat-withdrawal-days">Meat Withdrawal (days)</Label>
                    <Input
                      id="edit-meat-withdrawal-days"
                      type="number"
                      min="0"
                      placeholder="e.g., 10"
                      value={meatWithdrawalDays}
                      onChange={(e) => setMeatWithdrawalDays(e.target.value)}
                      data-testid="input-edit-meat-withdrawal-days"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-useby-days">Use-By Days</Label>
                    <Input
                      id="edit-useby-days"
                      type="number"
                      min="0"
                      placeholder="e.g., 28"
                      value={useByDays}
                      onChange={(e) => setUseByDays(e.target.value)}
                      data-testid="input-edit-useby-days"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-treatment-plan">Treatment Plan / Instructions</Label>
                  <Textarea
                    id="edit-treatment-plan"
                    placeholder="e.g., Administer 5ml per 100kg body weight. Repeat after 24 hours if needed."
                    value={treatmentPlan}
                    onChange={(e) => setTreatmentPlan(e.target.value)}
                    rows={3}
                    data-testid="input-edit-treatment-plan"
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={!name} data-testid="button-save-product">
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
