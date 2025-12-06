import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DollarSign, 
  Plus, 
  TrendingUp, 
  TrendingDown,
  Receipt,
  FileText,
  CheckCircle,
  Clock,
  Trash2,
  BarChart3
} from 'lucide-react';

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: string;
  vendor: string | null;
  invoiceNumber: string | null;
  notes: string | null;
  createdAt: string;
}

interface Killsheet {
  id: string;
  date: string;
  processorName: string;
  lotNumber: string | null;
  animalCount: number;
  totalCarcassWeight: string | null;
  totalValue: string | null;
  netPayment: string | null;
  paymentReceived: boolean;
  paymentDate: string | null;
  createdAt: string;
}

const EXPENSE_CATEGORIES = [
  { value: 'feed', label: 'Feed' },
  { value: 'veterinary', label: 'Veterinary' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'labor', label: 'Labor' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'other', label: 'Other' },
];

export default function FinancialPage() {
  const queryClient = useQueryClient();
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isKillsheetDialogOpen, setIsKillsheetDialogOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'other',
    description: '',
    amount: '',
    vendor: '',
    invoiceNumber: '',
    notes: '',
  });
  const [newKillsheet, setNewKillsheet] = useState({
    date: new Date().toISOString().split('T')[0],
    processorName: '',
    lotNumber: '',
    animalCount: '',
    totalCarcassWeight: '',
    pricePerKg: '',
    totalValue: '',
    deductions: '',
    netPayment: '',
    notes: '',
  });

  // Fetch expenses
  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: async () => {
      const response = await fetch('/api/financial/expenses?limit=50');
      if (!response.ok) throw new Error('Failed to fetch expenses');
      return response.json();
    },
  });

  // Fetch expense summary
  const { data: expenseSummary } = useQuery({
    queryKey: ['expenseSummary'],
    queryFn: async () => {
      const response = await fetch('/api/financial/expenses/summary');
      if (!response.ok) throw new Error('Failed to fetch expense summary');
      return response.json();
    },
  });

  // Fetch killsheets
  const { data: killsheets = [] } = useQuery<Killsheet[]>({
    queryKey: ['killsheets'],
    queryFn: async () => {
      const response = await fetch('/api/financial/killsheets?limit=50');
      if (!response.ok) throw new Error('Failed to fetch killsheets');
      return response.json();
    },
  });

  // Fetch killsheet summary
  const { data: killsheetSummary } = useQuery({
    queryKey: ['killsheetSummary'],
    queryFn: async () => {
      const response = await fetch('/api/financial/killsheets/summary');
      if (!response.ok) throw new Error('Failed to fetch killsheet summary');
      return response.json();
    },
  });

  // Create expense mutation
  const createExpenseMutation = useMutation({
    mutationFn: async (data: typeof newExpense) => {
      const response = await fetch('/api/financial/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create expense');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenseSummary'] });
      setIsExpenseDialogOpen(false);
      setNewExpense({
        date: new Date().toISOString().split('T')[0],
        category: 'other',
        description: '',
        amount: '',
        vendor: '',
        invoiceNumber: '',
        notes: '',
      });
    },
  });

  // Create killsheet mutation
  const createKillsheetMutation = useMutation({
    mutationFn: async (data: typeof newKillsheet) => {
      const response = await fetch('/api/financial/killsheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          animalCount: parseInt(data.animalCount) || 0,
        }),
      });
      if (!response.ok) throw new Error('Failed to create killsheet');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['killsheets'] });
      queryClient.invalidateQueries({ queryKey: ['killsheetSummary'] });
      setIsKillsheetDialogOpen(false);
      setNewKillsheet({
        date: new Date().toISOString().split('T')[0],
        processorName: '',
        lotNumber: '',
        animalCount: '',
        totalCarcassWeight: '',
        pricePerKg: '',
        totalValue: '',
        deductions: '',
        netPayment: '',
        notes: '',
      });
    },
  });

  // Delete expense mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/financial/expenses/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete expense');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenseSummary'] });
    },
  });

  // Mark payment received mutation
  const markPaymentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/financial/killsheets/${id}/payment-received`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Failed to mark payment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['killsheets'] });
      queryClient.invalidateQueries({ queryKey: ['killsheetSummary'] });
    },
  });

  const getCategoryLabel = (category: string) => {
    const cat = EXPENSE_CATEGORIES.find(c => c.value === category);
    return cat?.label || category;
  };

  const formatCurrency = (value: string | number | null) => {
    if (!value) return '$0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(num);
  };

  const totalExpenses = expenseSummary?.total || 0;
  const totalIncome = killsheetSummary?.totalNetPayment || 0;
  const profitLoss = totalIncome - totalExpenses;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Financial Management</h1>
          <p className="text-muted-foreground">Track expenses, killsheets, and farm finances</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Income</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Net Profit/Loss</p>
                <p className={`text-2xl font-bold ${profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(profitLoss)}
                </p>
              </div>
              <BarChart3 className={`h-8 w-8 ${profitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Animals Processed</p>
                <p className="text-2xl font-bold">{killsheetSummary?.totalAnimals || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expense Breakdown by Category */}
      {expenseSummary?.byCategory && Object.keys(expenseSummary.byCategory).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Expense Breakdown by Category</CardTitle>
            <CardDescription>Distribution of expenses across categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(expenseSummary.byCategory).map(([category, data]: [string, any]) => {
                const percentage = totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0;
                return (
                  <div key={category} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{getCategoryLabel(category)}</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(data.total)} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="expenses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="killsheets">Killsheets</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Expense Records</h2>
            <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Expense
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Record Expense</DialogTitle>
                  <DialogDescription>Add a new expense record</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="expenseDate">Date</Label>
                      <Input
                        id="expenseDate"
                        type="date"
                        value={newExpense.date}
                        onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Category</Label>
                      <Select
                        value={newExpense.category}
                        onValueChange={(value) => setNewExpense({ ...newExpense, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={newExpense.description}
                      onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                      placeholder="e.g., Monthly feed delivery"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="amount">Amount ($)</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="vendor">Vendor</Label>
                      <Input
                        id="vendor"
                        value={newExpense.vendor}
                        onChange={(e) => setNewExpense({ ...newExpense, vendor: e.target.value })}
                        placeholder="Supplier name"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="invoiceNumber">Invoice Number</Label>
                    <Input
                      id="invoiceNumber"
                      value={newExpense.invoiceNumber}
                      onChange={(e) => setNewExpense({ ...newExpense, invoiceNumber: e.target.value })}
                      placeholder="INV-001"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="expenseNotes">Notes</Label>
                    <Textarea
                      id="expenseNotes"
                      value={newExpense.notes}
                      onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
                      placeholder="Additional notes..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsExpenseDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createExpenseMutation.mutate(newExpense)}
                    disabled={!newExpense.description || !newExpense.amount || createExpenseMutation.isPending}
                  >
                    {createExpenseMutation.isPending ? 'Saving...' : 'Save Expense'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-6">
              {expenses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No expenses recorded</p>
                  <p className="text-sm">Add your first expense to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {expenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <DollarSign className="h-8 w-8 text-red-500" />
                        <div>
                          <p className="font-medium">{expense.description}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="outline">{getCategoryLabel(expense.category)}</Badge>
                            <span>•</span>
                            <span>{new Date(expense.date).toLocaleDateString()}</span>
                            {expense.vendor && (
                              <>
                                <span>•</span>
                                <span>{expense.vendor}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold text-red-600">
                          -{formatCurrency(expense.amount)}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteExpenseMutation.mutate(expense.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="killsheets" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Killsheet Records</h2>
            <Dialog open={isKillsheetDialogOpen} onOpenChange={setIsKillsheetDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Killsheet
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Record Killsheet</DialogTitle>
                  <DialogDescription>Add a new killsheet/processing record</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="killsheetDate">Date</Label>
                      <Input
                        id="killsheetDate"
                        type="date"
                        value={newKillsheet.date}
                        onChange={(e) => setNewKillsheet({ ...newKillsheet, date: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="processorName">Processor</Label>
                      <Input
                        id="processorName"
                        value={newKillsheet.processorName}
                        onChange={(e) => setNewKillsheet({ ...newKillsheet, processorName: e.target.value })}
                        placeholder="e.g., AFFCO Horotiu"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="lotNumber">Lot Number</Label>
                      <Input
                        id="lotNumber"
                        value={newKillsheet.lotNumber}
                        onChange={(e) => setNewKillsheet({ ...newKillsheet, lotNumber: e.target.value })}
                        placeholder="LOT-001"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="animalCount">Animal Count</Label>
                      <Input
                        id="animalCount"
                        type="number"
                        value={newKillsheet.animalCount}
                        onChange={(e) => setNewKillsheet({ ...newKillsheet, animalCount: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="totalCarcassWeight">Total Carcass Weight (kg)</Label>
                      <Input
                        id="totalCarcassWeight"
                        type="number"
                        step="0.01"
                        value={newKillsheet.totalCarcassWeight}
                        onChange={(e) => setNewKillsheet({ ...newKillsheet, totalCarcassWeight: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="pricePerKg">Price per kg ($)</Label>
                      <Input
                        id="pricePerKg"
                        type="number"
                        step="0.01"
                        value={newKillsheet.pricePerKg}
                        onChange={(e) => setNewKillsheet({ ...newKillsheet, pricePerKg: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="totalValue">Total Value ($)</Label>
                      <Input
                        id="totalValue"
                        type="number"
                        step="0.01"
                        value={newKillsheet.totalValue}
                        onChange={(e) => setNewKillsheet({ ...newKillsheet, totalValue: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="deductions">Deductions ($)</Label>
                      <Input
                        id="deductions"
                        type="number"
                        step="0.01"
                        value={newKillsheet.deductions}
                        onChange={(e) => setNewKillsheet({ ...newKillsheet, deductions: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="netPayment">Net Payment ($)</Label>
                      <Input
                        id="netPayment"
                        type="number"
                        step="0.01"
                        value={newKillsheet.netPayment}
                        onChange={(e) => setNewKillsheet({ ...newKillsheet, netPayment: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="killsheetNotes">Notes</Label>
                    <Textarea
                      id="killsheetNotes"
                      value={newKillsheet.notes}
                      onChange={(e) => setNewKillsheet({ ...newKillsheet, notes: e.target.value })}
                      placeholder="Additional notes..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsKillsheetDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createKillsheetMutation.mutate(newKillsheet)}
                    disabled={!newKillsheet.processorName || !newKillsheet.animalCount || createKillsheetMutation.isPending}
                  >
                    {createKillsheetMutation.isPending ? 'Saving...' : 'Save Killsheet'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-6">
              {killsheets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No killsheets recorded</p>
                  <p className="text-sm">Add your first killsheet to track processing income</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {killsheets.map((killsheet) => (
                    <div
                      key={killsheet.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <FileText className="h-8 w-8 text-green-500" />
                        <div>
                          <p className="font-medium">{killsheet.processorName}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{new Date(killsheet.date).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>{killsheet.animalCount} animals</span>
                            {killsheet.totalCarcassWeight && (
                              <>
                                <span>•</span>
                                <span>{parseFloat(killsheet.totalCarcassWeight).toFixed(0)} kg</span>
                              </>
                            )}
                            {killsheet.lotNumber && (
                              <>
                                <span>•</span>
                                <span>Lot: {killsheet.lotNumber}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-lg font-bold text-green-600">
                            +{formatCurrency(killsheet.netPayment)}
                          </span>
                          <div className="flex items-center gap-1 text-sm">
                            {killsheet.paymentReceived ? (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Paid
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-yellow-600">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </div>
                        </div>
                        {!killsheet.paymentReceived && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markPaymentMutation.mutate(killsheet.id)}
                          >
                            Mark Paid
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
