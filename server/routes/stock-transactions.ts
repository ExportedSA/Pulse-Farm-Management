// Stock Transactions API Routes
import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { insertStockTransactionSchema } from "@shared/schema";
import { z } from "zod";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";

const router = Router();

// GET /api/stock/transactions - Get all transactions with optional filters
router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const { type, startDate, endDate } = req.query;
    const transactions = await storage.getStockTransactions({
      type: type as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });
    res.json(transactions);
  } catch (error) {
    console.error("Error fetching stock transactions:", error);
    res.status(500).json({ error: "Failed to fetch stock transactions" });
  }
});

// GET /api/stock/transactions/:id - Get single transaction
router.get("/transactions/:id", async (req: Request, res: Response) => {
  try {
    const transaction = await storage.getStockTransaction(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    res.json(transaction);
  } catch (error) {
    console.error("Error fetching stock transaction:", error);
    res.status(500).json({ error: "Failed to fetch stock transaction" });
  }
});

// POST /api/stock/transactions - Create new transaction
router.post("/transactions", async (req: Request, res: Response) => {
  try {
    const validatedData = insertStockTransactionSchema.parse(req.body);
    
    // Calculate total value if price per head is provided
    if (validatedData.pricePerHead && validatedData.quantity) {
      validatedData.totalValue = validatedData.pricePerHead * validatedData.quantity;
    }
    
    const transaction = await storage.createStockTransaction(validatedData);
    
    // If animal IDs are provided, update their status based on transaction type
    if (validatedData.animalIds) {
      try {
        const animalIds = JSON.parse(validatedData.animalIds);
        if (Array.isArray(animalIds) && animalIds.length > 0) {
          for (const animalId of animalIds) {
            let newStatus: string | null = null;
            
            switch (validatedData.type) {
              case 'sale':
              case 'transfer_out':
                newStatus = 'sold';
                break;
              case 'death':
                newStatus = 'deceased';
                break;
              // purchase, transfer_in, birth - animals should already be active or will be created
            }
            
            if (newStatus) {
              await storage.updateAnimal(animalId, { status: newStatus as any });
            }
          }
        }
      } catch (e) {
        console.warn("Could not parse animal IDs:", e);
      }
    }
    
    res.status(201).json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating stock transaction:", error);
    res.status(500).json({ error: "Failed to create stock transaction" });
  }
});

// PUT /api/stock/transactions/:id - Update transaction
router.put("/transactions/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getStockTransaction(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    
    const validatedData = insertStockTransactionSchema.partial().parse(req.body);
    
    // Recalculate total value if needed
    if (validatedData.pricePerHead !== undefined || validatedData.quantity !== undefined) {
      const price = validatedData.pricePerHead ?? existing.pricePerHead ?? 0;
      const qty = validatedData.quantity ?? existing.quantity;
      validatedData.totalValue = price * qty;
    }
    
    const transaction = await storage.updateStockTransaction(req.params.id, validatedData);
    res.json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error updating stock transaction:", error);
    res.status(500).json({ error: "Failed to update stock transaction" });
  }
});

// DELETE /api/stock/transactions/:id - Delete transaction
router.delete("/transactions/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getStockTransaction(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    
    await storage.deleteStockTransaction(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting stock transaction:", error);
    res.status(500).json({ error: "Failed to delete stock transaction" });
  }
});

// GET /api/stock/summary - Get stock summary with counts
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const animals = await storage.getAnimals();
    
    const summary = {
      totalAnimals: animals.filter(a => a.status === 'active').length,
      byStatus: {
        active: animals.filter(a => a.status === 'active').length,
        sold: animals.filter(a => a.status === 'sold').length,
        deceased: animals.filter(a => a.status === 'deceased').length,
      },
      byHerd: animals.reduce((acc, a) => {
        if (a.status === 'active') {
          const herd = (a as any).herd || 'Unassigned';
          acc[herd] = (acc[herd] || 0) + 1;
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
    
    res.json(summary);
  } catch (error) {
    console.error("Error fetching stock summary:", error);
    res.status(500).json({ error: "Failed to fetch stock summary" });
  }
});

// GET /api/stock/financial-report - Get financial report for stock transactions
router.get("/financial-report", async (req: Request, res: Response) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period as string);
    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
    
    const transactions = await storage.getStockTransactions({ startDate });
    
    // Calculate totals
    let totalPurchases = 0;
    let totalSales = 0;
    let totalDeaths = 0;
    let purchaseCount = 0;
    let saleCount = 0;
    let deathCount = 0;
    let birthCount = 0;
    let transferInCount = 0;
    let transferOutCount = 0;
    
    transactions.forEach(t => {
      const value = t.totalValue || 0;
      const qty = t.quantity || 0;
      
      switch (t.type) {
        case 'purchase':
          totalPurchases += value;
          purchaseCount += qty;
          break;
        case 'sale':
          totalSales += value;
          saleCount += qty;
          break;
        case 'death':
          totalDeaths += value; // Estimated loss value
          deathCount += qty;
          break;
        case 'birth':
          birthCount += qty;
          break;
        case 'transfer_in':
          transferInCount += qty;
          break;
        case 'transfer_out':
          transferOutCount += qty;
          break;
      }
    });
    
    // Calculate net change
    const netStockChange = purchaseCount + birthCount + transferInCount - saleCount - deathCount - transferOutCount;
    const netFinancialChange = totalSales - totalPurchases;
    
    // Group by month for trend
    const monthlyData: Record<string, { purchases: number; sales: number; deaths: number }> = {};
    transactions.forEach(t => {
      const month = t.date.substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = { purchases: 0, sales: 0, deaths: 0 };
      }
      if (t.type === 'purchase') monthlyData[month].purchases += t.quantity;
      if (t.type === 'sale') monthlyData[month].sales += t.quantity;
      if (t.type === 'death') monthlyData[month].deaths += t.quantity;
    });
    
    res.json({
      period: `${days} days`,
      summary: {
        totalPurchases: totalPurchases / 100, // Convert cents to dollars
        totalSales: totalSales / 100,
        totalDeathLoss: totalDeaths / 100,
        netFinancialChange: netFinancialChange / 100,
        purchaseCount,
        saleCount,
        deathCount,
        birthCount,
        transferInCount,
        transferOutCount,
        netStockChange,
      },
      transactions: transactions.length,
      monthlyTrend: Object.entries(monthlyData).map(([month, data]) => ({
        month,
        ...data,
      })).sort((a, b) => a.month.localeCompare(b.month)),
    });
  } catch (error) {
    console.error("Error generating financial report:", error);
    res.status(500).json({ error: "Failed to generate financial report" });
  }
});

// GET /api/stock/transactions/by-animal/:animalId - Get transactions for a specific animal
router.get("/transactions/by-animal/:animalId", async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    const transactions = await storage.getStockTransactionsByAnimal(animalId);
    res.json(transactions);
  } catch (error) {
    console.error("Error fetching animal transactions:", error);
    res.status(500).json({ error: "Failed to fetch animal transactions" });
  }
});

// POST /api/stock/killsheet - Import killsheet data
router.post("/killsheet", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      date: z.string(),
      processor: z.string(),
      reference: z.string().optional(),
      animals: z.array(z.object({
        animalId: z.string().uuid().optional(),
        tag: z.string().optional(),
        carcassWeight: z.number(),
        grade: z.string().optional(),
        pricePerKg: z.number(),
        totalValue: z.number(),
        condemnations: z.string().optional(),
      })),
    });
    
    const data = schema.parse(req.body);
    
    // Create a sale transaction for the killsheet
    const animalIds = data.animals
      .filter(a => a.animalId)
      .map(a => a.animalId);
    
    const totalValue = data.animals.reduce((sum, a) => sum + a.totalValue, 0);
    const avgPricePerHead = data.animals.length > 0 
      ? Math.round(totalValue / data.animals.length) 
      : 0;
    
    const transaction = await storage.createStockTransaction({
      type: 'sale',
      date: data.date,
      quantity: data.animals.length,
      description: `Killsheet from ${data.processor}`,
      reference: data.reference || `KS-${Date.now()}`,
      buyer: data.processor,
      pricePerHead: avgPricePerHead * 100, // Convert to cents
      totalValue: Math.round(totalValue * 100), // Convert to cents
      animalIds: animalIds.length > 0 ? JSON.stringify(animalIds) : null,
      notes: JSON.stringify({
        killsheetData: data.animals,
        importedAt: new Date().toISOString(),
      }),
    });
    
    // Update animal statuses to sold
    for (const animalId of animalIds) {
      if (animalId) {
        await storage.updateAnimal(animalId, { status: 'sold' });
      }
    }
    
    res.status(201).json({
      transaction,
      animalsProcessed: data.animals.length,
      totalValue,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid killsheet data", details: error.errors });
    }
    console.error("Error importing killsheet:", error);
    res.status(500).json({ error: "Failed to import killsheet" });
  }
});

// GET /api/stock/reconciliation - Get reconciliation data
router.get("/reconciliation", async (req: Request, res: Response) => {
  try {
    const animals = await storage.getAnimals();
    const transactions = await storage.getStockTransactions({});
    
    // Calculate expected vs actual
    const activeAnimals = animals.filter(a => a.status === 'active').length;
    
    // Sum up transaction impacts
    let expectedFromTransactions = 0;
    transactions.forEach(t => {
      switch (t.type) {
        case 'purchase':
        case 'birth':
        case 'transfer_in':
          expectedFromTransactions += t.quantity;
          break;
        case 'sale':
        case 'death':
        case 'transfer_out':
          expectedFromTransactions -= t.quantity;
          break;
      }
    });
    
    // Get initial stock (this would normally come from a baseline)
    // For now, we'll calculate it backwards
    const initialStock = activeAnimals - expectedFromTransactions;
    
    res.json({
      currentStock: activeAnimals,
      expectedStock: initialStock + expectedFromTransactions,
      variance: activeAnimals - (initialStock + expectedFromTransactions),
      breakdown: {
        initialStock,
        purchases: transactions.filter(t => t.type === 'purchase').reduce((s, t) => s + t.quantity, 0),
        births: transactions.filter(t => t.type === 'birth').reduce((s, t) => s + t.quantity, 0),
        transfersIn: transactions.filter(t => t.type === 'transfer_in').reduce((s, t) => s + t.quantity, 0),
        sales: transactions.filter(t => t.type === 'sale').reduce((s, t) => s + t.quantity, 0),
        deaths: transactions.filter(t => t.type === 'death').reduce((s, t) => s + t.quantity, 0),
        transfersOut: transactions.filter(t => t.type === 'transfer_out').reduce((s, t) => s + t.quantity, 0),
      },
    });
  } catch (error) {
    console.error("Error fetching reconciliation data:", error);
    res.status(500).json({ error: "Failed to fetch reconciliation data" });
  }
});

export default router;
