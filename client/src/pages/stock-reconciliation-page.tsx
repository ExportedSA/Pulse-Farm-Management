import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Beef, 
  TrendingUp, 
  TrendingDown, 
  ArrowRightLeft, 
  Skull, 
  ShoppingCart,
  Plus,
  FileText,
  Calendar,
  RefreshCw,
  Download,
  Filter,
  BarChart3,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

interface StockSummary {
  totalAnimals: number;
  byStatus: {
    active: number;
    sold: number;
    deceased: number;
  };
  byHerd: Record<string, number>;
  byBreed: Record<string, number>;
  bySex: {
    male: number;
    female: number;
  };
}

interface StockTransaction {
  id: string;
  type: 'purchase' | 'sale' | 'death' | 'transfer_in' | 'transfer_out' | 'birth';
  date: string;
  quantity: number;
  animalIds?: string[];
  description: string;
  reference?: string;
  fromLocation?: string;
  toLocation?: string;
  pricePerHead?: number;
  totalValue?: number;
  createdBy: string;
  createdAt: string;
}

export default function StockReconciliationPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<string>('');
  const [transactionForm, setTransactionForm] = useState({
    date: new Date().toISOString().split('T')[0],
    quantity: 1,
    description: '',
    reference: '',
    fromLocation: '',
    toLocation: '',
    pricePerHead: 0,
  });

  // Fetch stock summary
  const { data: stockSummary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<StockSummary>({
    queryKey: ['/api/stock/summary'],
    queryFn: async () => {
      const response = await fetch('/api/stock/summary');
      if (!response.ok) {
        // Return default values if endpoint doesn't exist yet
        return {
          totalAnimals: 0,
          byStatus: { active: 0, sold: 0, deceased: 0 },
          byHerd: {},
          byBreed: {},
          bySex: { male: 0, female: 0 }
        };
      }
      return response.json();
    },
  });

  // Fetch recent transactions
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<StockTransaction[]>({
    queryKey: ['/api/stock/transactions'],
    queryFn: async () => {
      const response = await fetch('/api/stock/transactions');
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Fetch animals for real counts
  const { data: animals = [] } = useQuery<any[]>({
    queryKey: ['/api/animals'],
  });

  // Calculate real stock summary from animals
  const realStockSummary: StockSummary = {
    totalAnimals: animals.filter(a => a.status === 'active').length,
    byStatus: {
      active: animals.filter(a => a.status === 'active').length,
      sold: animals.filter(a => a.status === 'sold').length,
      deceased: animals.filter(a => a.status === 'deceased').length,
    },
    byHerd: animals.reduce((acc, a) => {
      if (a.herd && a.status === 'active') {
        acc[a.herd] = (acc[a.herd] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>),
    byBreed: animals.reduce((acc, a) => {
      if (a.breed && a.status === 'active') {
        acc[a.breed] = (acc[a.breed] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>),
    bySex: {
      male: animals.filter(a => a.sex === 'male' && a.status === 'active').length,
      female: animals.filter(a => a.sex === 'female' && a.status === 'active').length,
    },
  };

  // Create transaction mutation
  const createTransactionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/stock/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create transaction');
      return response.json();
    },
    onSuccess: () => {
      toast.success(`${transactionType} transaction recorded`);
      queryClient.invalidateQueries({ queryKey: ['/api/stock'] });
      queryClient.invalidateQueries({ queryKey: ['/api/animals'] });
      setIsTransactionDialogOpen(false);
      setTransactionForm({
        date: new Date().toISOString().split('T')[0],
        quantity: 1,
        description: '',
        reference: '',
        fromLocation: '',
        toLocation: '',
        pricePerHead: 0,
      });
      setTransactionType('');
    },
    onError: () => {
      toast.error('Failed to record transaction');
    },
  });

  const handleTransactionSubmit = async () => {
    if (!transactionType) {
      toast.error('Please select a transaction type');
      return;
    }
    
    createTransactionMutation.mutate({
      type: transactionType,
      date: transactionForm.date,
      quantity: transactionForm.quantity,
      description: transactionForm.description || `${transactionType} transaction`,
      reference: transactionForm.reference || null,
      fromLocation: transactionForm.fromLocation || null,
      toLocation: transactionForm.toLocation || null,
      pricePerHead: transactionForm.pricePerHead ? transactionForm.pricePerHead * 100 : null, // Convert to cents
      totalValue: transactionForm.pricePerHead ? transactionForm.pricePerHead * transactionForm.quantity * 100 : null,
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase': return <ShoppingCart className="h-4 w-4 text-green-600" />;
      case 'sale': return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'death': return <Skull className="h-4 w-4 text-red-600" />;
      case 'transfer_in': return <TrendingDown className="h-4 w-4 text-purple-600" />;
      case 'transfer_out': return <ArrowRightLeft className="h-4 w-4 text-orange-600" />;
      case 'birth': return <Plus className="h-4 w-4 text-pink-600" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getTransactionBadgeColor = (type: string) => {
    switch (type) {
      case 'purchase': return 'bg-green-100 text-green-800';
      case 'sale': return 'bg-blue-100 text-blue-800';
      case 'death': return 'bg-red-100 text-red-800';
      case 'transfer_in': return 'bg-purple-100 text-purple-800';
      case 'transfer_out': return 'bg-orange-100 text-orange-800';
      case 'birth': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Beef className="h-8 w-8 text-primary" />
            Stock Reconciliation
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time stock tracking and reconciliation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetchSummary()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Record Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Record Stock Transaction</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Transaction Type</Label>
                  <Select value={transactionType} onValueChange={setTransactionType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="purchase">Purchase (Animals In)</SelectItem>
                      <SelectItem value="sale">Sale (Animals Out)</SelectItem>
                      <SelectItem value="death">Death/Casualty</SelectItem>
                      <SelectItem value="transfer_in">Transfer In</SelectItem>
                      <SelectItem value="transfer_out">Transfer Out</SelectItem>
                      <SelectItem value="birth">Birth/Calving</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={transactionForm.date}
                      onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={transactionForm.quantity}
                      onChange={(e) => setTransactionForm({ ...transactionForm, quantity: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>

                {(transactionType === 'purchase' || transactionType === 'sale') && (
                  <div className="space-y-2">
                    <Label>Price per Head ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={transactionForm.pricePerHead}
                      onChange={(e) => setTransactionForm({ ...transactionForm, pricePerHead: parseFloat(e.target.value) || 0 })}
                    />
                    {transactionForm.pricePerHead > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Total: ${(transactionForm.pricePerHead * transactionForm.quantity).toFixed(2)}
                      </p>
                    )}
                  </div>
                )}

                {(transactionType === 'transfer_in' || transactionType === 'transfer_out') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>From Location</Label>
                      <Input
                        value={transactionForm.fromLocation}
                        onChange={(e) => setTransactionForm({ ...transactionForm, fromLocation: e.target.value })}
                        placeholder="Source..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>To Location</Label>
                      <Input
                        value={transactionForm.toLocation}
                        onChange={(e) => setTransactionForm({ ...transactionForm, toLocation: e.target.value })}
                        placeholder="Destination..."
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Reference/Invoice #</Label>
                  <Input
                    value={transactionForm.reference}
                    onChange={(e) => setTransactionForm({ ...transactionForm, reference: e.target.value })}
                    placeholder="Optional reference..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description/Notes</Label>
                  <Textarea
                    value={transactionForm.description}
                    onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                    placeholder="Add details..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsTransactionDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleTransactionSubmit} 
                  disabled={!transactionType || createTransactionMutation.isPending}
                >
                  {createTransactionMutation.isPending ? 'Recording...' : 'Record Transaction'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Active Stock</p>
                <p className="text-3xl font-bold text-primary">{realStockSummary.totalAnimals}</p>
              </div>
              <Beef className="h-10 w-10 text-primary/20" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-600">Reconciled</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Males</p>
                <p className="text-3xl font-bold text-blue-600">{realStockSummary.bySex.male}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-bold">♂</span>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {realStockSummary.totalAnimals > 0 
                ? `${((realStockSummary.bySex.male / realStockSummary.totalAnimals) * 100).toFixed(1)}% of herd`
                : 'No animals'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Females</p>
                <p className="text-3xl font-bold text-pink-600">{realStockSummary.bySex.female}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-pink-100 flex items-center justify-center">
                <span className="text-pink-600 font-bold">♀</span>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {realStockSummary.totalAnimals > 0 
                ? `${((realStockSummary.bySex.female / realStockSummary.totalAnimals) * 100).toFixed(1)}% of herd`
                : 'No animals'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sold/Deceased</p>
                <p className="text-3xl font-bold text-gray-600">
                  {realStockSummary.byStatus.sold + realStockSummary.byStatus.deceased}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-gray-600" />
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {realStockSummary.byStatus.sold} sold, {realStockSummary.byStatus.deceased} deceased
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="by-herd">By Herd</TabsTrigger>
          <TabsTrigger value="by-breed">By Breed</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stock by Herd */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Stock by Herd</CardTitle>
                <CardDescription>Current distribution across herds</CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(realStockSummary.byHerd).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(realStockSummary.byHerd).map(([herd, count]) => (
                      <div key={herd} className="flex items-center justify-between">
                        <span className="font-medium">{herd}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${(count / realStockSummary.totalAnimals) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No herd data available. Add animals with herd assignments.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Stock by Breed */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Stock by Breed</CardTitle>
                <CardDescription>Current distribution by breed</CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(realStockSummary.byBreed).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(realStockSummary.byBreed).map(([breed, count]) => (
                      <div key={breed} className="flex items-center justify-between">
                        <span className="font-medium">{breed}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${(count / realStockSummary.totalAnimals) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No breed data available. Add animals with breed information.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Button 
                  variant="outline" 
                  className="h-20 flex-col gap-2"
                  onClick={() => { setTransactionType('purchase'); setIsTransactionDialogOpen(true); }}
                >
                  <ShoppingCart className="h-5 w-5 text-green-600" />
                  <span className="text-xs">Purchase</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-20 flex-col gap-2"
                  onClick={() => { setTransactionType('sale'); setIsTransactionDialogOpen(true); }}
                >
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  <span className="text-xs">Sale</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-20 flex-col gap-2"
                  onClick={() => { setTransactionType('death'); setIsTransactionDialogOpen(true); }}
                >
                  <Skull className="h-5 w-5 text-red-600" />
                  <span className="text-xs">Death</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-20 flex-col gap-2"
                  onClick={() => { setTransactionType('transfer_in'); setIsTransactionDialogOpen(true); }}
                >
                  <TrendingDown className="h-5 w-5 text-purple-600" />
                  <span className="text-xs">Transfer In</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-20 flex-col gap-2"
                  onClick={() => { setTransactionType('transfer_out'); setIsTransactionDialogOpen(true); }}
                >
                  <ArrowRightLeft className="h-5 w-5 text-orange-600" />
                  <span className="text-xs">Transfer Out</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-20 flex-col gap-2"
                  onClick={() => { setTransactionType('birth'); setIsTransactionDialogOpen(true); }}
                >
                  <Plus className="h-5 w-5 text-pink-600" />
                  <span className="text-xs">Birth</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Transactions</CardTitle>
              <CardDescription>Stock movements and changes</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length > 0 ? (
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getTransactionIcon(tx.type)}
                        <div>
                          <p className="font-medium">{tx.description || tx.type}</p>
                          <p className="text-sm text-muted-foreground">{tx.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={getTransactionBadgeColor(tx.type)}>
                          {tx.type === 'purchase' || tx.type === 'transfer_in' || tx.type === 'birth' ? '+' : '-'}
                          {tx.quantity}
                        </Badge>
                        {tx.totalValue && (
                          <span className="text-sm font-medium">${tx.totalValue.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No transactions recorded yet</p>
                  <Button 
                    className="mt-4" 
                    onClick={() => setIsTransactionDialogOpen(true)}
                  >
                    Record First Transaction
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-herd">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Stock by Herd</CardTitle>
              <CardDescription>Detailed breakdown by herd assignment</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(realStockSummary.byHerd).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(realStockSummary.byHerd).map(([herd, count]) => (
                    <Card key={herd} className="bg-muted/50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">{herd}</h3>
                          <Badge variant="secondary">{count} head</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {((count / realStockSummary.totalAnimals) * 100).toFixed(1)}% of total stock
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No herd assignments found. Assign animals to herds to see breakdown.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-breed">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Stock by Breed</CardTitle>
              <CardDescription>Detailed breakdown by breed</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(realStockSummary.byBreed).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(realStockSummary.byBreed).map(([breed, count]) => (
                    <Card key={breed} className="bg-muted/50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">{breed}</h3>
                          <Badge variant="secondary">{count} head</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {((count / realStockSummary.totalAnimals) * 100).toFixed(1)}% of total stock
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No breed information found. Add breed data to animals to see breakdown.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
