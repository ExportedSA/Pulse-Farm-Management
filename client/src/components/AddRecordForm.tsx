import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Camera, Plus, QrCode, Check, ChevronsUpDown } from "lucide-react";
import { today, cn } from "@/lib/utils";
import type { Product, User } from "@shared/schema";

interface AddRecordFormProps {
  products: Product[];
  users: User[];
  onAdd: (record: {
    productName: string;
    batchNo: string;
    expiryDate?: string;
    useByDate?: string;
    dateOpened: string;
    openedBy?: string;
    notes?: string;
  }) => void;
  onScan: () => void;
  onSaveBarcode: (productName: string, batchNo: string) => void;
}

export default function AddRecordForm({ products, users, onAdd, onScan, onSaveBarcode }: AddRecordFormProps) {
  const [form, setForm] = useState({
    productName: "",
    batchNo: "",
    expiryDate: "",
    useByDate: "",
    dateOpened: today(),
    openedBy: "",
    notes: "",
  });
  const [productOpen, setProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const setField = <K extends keyof typeof form>(k: K, v: string) => {
    setForm((f) => {
      const updated = { ...f, [k]: v };
      
      // Auto-calculate use-by date when product or date opened changes
      if (k === "productName" || k === "dateOpened") {
        const productName = k === "productName" ? v : f.productName;
        const dateOpened = k === "dateOpened" ? v : f.dateOpened;
        
        if (productName && dateOpened) {
          const product = products.find(p => p.name === productName);
          if (product && product.useByDays !== undefined) {
            const opened = new Date(dateOpened);
            opened.setDate(opened.getDate() + product.useByDays);
            updated.useByDate = opened.toISOString().split("T")[0];
          } else {
            // Clear use-by date if product has no useByDays configured
            updated.useByDate = "";
          }
        } else {
          // Clear use-by date if product or date is not set
          updated.useByDate = "";
        }
      }
      
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      productName: form.productName,
      batchNo: form.batchNo,
      expiryDate: form.expiryDate || undefined,
      useByDate: form.useByDate || undefined,
      dateOpened: form.dateOpened,
      openedBy: form.openedBy || undefined,
      notes: form.notes || undefined,
    });
    setForm({ ...form, batchNo: "", notes: "" });
  };

  return (
    <Card data-testid="card-add-record">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="product">Product *</Label>
            <Popover open={productOpen} onOpenChange={setProductOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={productOpen}
                  className="w-full justify-between"
                  data-testid="button-select-product"
                >
                  {form.productName || "Select or search product..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput 
                    placeholder="Search or type new product..." 
                    value={productSearch}
                    onValueChange={setProductSearch}
                    data-testid="input-product-search" 
                  />
                  <CommandList>
                    <CommandEmpty>
                      {productSearch && (
                        <CommandItem
                          value={productSearch}
                          onSelect={() => {
                            setField("productName", productSearch);
                            setProductOpen(false);
                            setProductSearch("");
                          }}
                          className="cursor-pointer"
                          data-testid="option-add-new-product"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add "{productSearch}" as new product
                        </CommandItem>
                      )}
                    </CommandEmpty>
                    <CommandGroup>
                      {products
                        .filter((p) => 
                          !productSearch || 
                          p.name.toLowerCase().includes(productSearch.toLowerCase())
                        )
                        .map((product) => (
                          <CommandItem
                            key={product.id}
                            value={product.name}
                            onSelect={(currentValue) => {
                              setField("productName", currentValue);
                              setProductOpen(false);
                              setProductSearch("");
                            }}
                            data-testid={`option-product-${product.id}`}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                form.productName === product.name ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {product.name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch">Batch / Barcode (optional)</Label>
            <div className="flex gap-2">
              <Input
                id="batch"
                placeholder="Type or scan (optional)…"
                value={form.batchNo}
                onChange={(e) => setField("batchNo", e.target.value)}
                data-testid="input-batch-no"
              />
              <Button type="button" onClick={onScan} data-testid="button-scan-barcode">
                <Camera className="w-4 h-4 mr-1" />
                Scan
              </Button>
            </div>
            {form.batchNo && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onSaveBarcode(form.productName, form.batchNo)}
                disabled={!form.productName || !form.batchNo}
                data-testid="button-save-barcode"
              >
                <QrCode className="w-4 h-4 mr-2" />
                Save barcode → product
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiry">Expiry Date *</Label>
            <Input
              id="expiry"
              type="date"
              value={form.expiryDate}
              onChange={(e) => setField("expiryDate", e.target.value)}
              required
              data-testid="input-expiry-date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="useby">Use-By Date *</Label>
            <Input
              id="useby"
              type="date"
              value={form.useByDate}
              onChange={(e) => setField("useByDate", e.target.value)}
              required
              data-testid="input-useby-date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="opened">Date Opened *</Label>
            <Input
              id="opened"
              type="date"
              value={form.dateOpened}
              onChange={(e) => setField("dateOpened", e.target.value)}
              required
              data-testid="input-date-opened"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="openedby">Opened By</Label>
            <Select onValueChange={(v) => setField("openedBy", v)} value={form.openedBy || undefined}>
              <SelectTrigger data-testid="select-opened-by">
                <SelectValue placeholder="Select staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Staff</SelectLabel>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.name} data-testid={`option-user-${u.id}`}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional information…"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              className="resize-none"
              rows={3}
              data-testid="input-notes"
            />
          </div>

          <div className="md:col-span-2">
            <Button
              type="submit"
              disabled={!form.productName || !form.expiryDate || !form.useByDate || !form.dateOpened}
              data-testid="button-add-record"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Record
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
