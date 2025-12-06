import { Router } from 'express';
import { z } from 'zod';
import { storage } from './storage';
import { insertStockTransactionSchema } from '@shared/schema';

const router = Router();

// ===== STOCK SUMMARY =====

// Get stock summary with counts by status, herd, breed, sex
router.get('/summary', async (req, res) => {
  try {
    const animals = await storage.getAnimals();
    
    const summary = {
      totalAnimals: animals.filter(a => a.status === 'active').length,
      byStatus: {
        active: animals.filter(a => a.status === 'active').length,
        sold: animals.filter(a => a.status === 'sold').length,
        deceased: animals.filter(a => a.status === 'deceased').length,
      },
      byHerd: animals
        .filter(a => a.status === 'active' && a.herd)
        .reduce((acc, a) => {
          acc[a.herd!] = (acc[a.herd!] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      byBreed: animals
        .filter(a => a.status === 'active' && a.breed)
        .reduce((acc, a) => {
          acc[a.breed!] = (acc[a.breed!] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      bySex: {
        male: animals.filter(a => a.sex === 'male' && a.status === 'active').length,
        female: animals.filter(a => a.sex === 'female' && a.status === 'active').length,
      },
    };
    
    res.json(summary);
  } catch (error) {
    console.error('Error fetching stock summary:', error);
    res.status(500).json({ error: 'Failed to fetch stock summary' });
  }
});

// ===== STOCK TRANSACTIONS =====

// Get all transactions with optional filters
router.get('/transactions', async (req, res) => {
  try {
    const { type, startDate, endDate, limit } = req.query;
    
    const filters: any = {};
    if (type) filters.type = type as string;
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;
    
    const transactions = await storage.getStockTransactions(filters, limit ? parseInt(limit as string) : 50);
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching stock transactions:', error);
    res.status(500).json({ error: 'Failed to fetch stock transactions' });
  }
});

// Get single transaction by ID
router.get('/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await storage.getStockTransactionById(id);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// Create new transaction
router.post('/transactions', async (req, res) => {
  try {
    const validatedData = insertStockTransactionSchema.parse(req.body);
    
    // Calculate total value if price per head is provided
    if (validatedData.pricePerHead && validatedData.quantity) {
      validatedData.totalValue = validatedData.pricePerHead * validatedData.quantity;
    }
    
    const transaction = await storage.createStockTransaction(validatedData);
    
    // If this is a sale or death, update animal statuses
    if ((validatedData.type === 'sale' || validatedData.type === 'death') && validatedData.animalIds) {
      const animalIds = JSON.parse(validatedData.animalIds);
      for (const animalId of animalIds) {
        await storage.updateAnimal(animalId, { 
          status: validatedData.type === 'sale' ? 'sold' : 'deceased' 
        });
      }
    }
    
    res.status(201).json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid transaction data', details: error.errors });
    } else {
      console.error('Error creating transaction:', error);
      res.status(500).json({ error: 'Failed to create transaction' });
    }
  }
});

// Update transaction
router.put('/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Recalculate total value if needed
    if (updates.pricePerHead && updates.quantity) {
      updates.totalValue = updates.pricePerHead * updates.quantity;
    }
    
    const transaction = await storage.updateStockTransaction(id, updates);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json(transaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// Delete transaction
router.delete('/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteStockTransaction(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// ===== STOCK REPORTS =====

// Get stock reconciliation report
router.get('/reconciliation', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Get opening stock (animals active at start date)
    const animals = await storage.getAnimals();
    const transactions = await storage.getStockTransactions({
      startDate: startDate as string,
      endDate: endDate as string,
    });
    
    // Calculate movements
    const movements = {
      purchases: transactions.filter(t => t.type === 'purchase').reduce((sum, t) => sum + t.quantity, 0),
      sales: transactions.filter(t => t.type === 'sale').reduce((sum, t) => sum + t.quantity, 0),
      deaths: transactions.filter(t => t.type === 'death').reduce((sum, t) => sum + t.quantity, 0),
      births: transactions.filter(t => t.type === 'birth').reduce((sum, t) => sum + t.quantity, 0),
      transfersIn: transactions.filter(t => t.type === 'transfer_in').reduce((sum, t) => sum + t.quantity, 0),
      transfersOut: transactions.filter(t => t.type === 'transfer_out').reduce((sum, t) => sum + t.quantity, 0),
      adjustments: transactions.filter(t => t.type === 'adjustment').reduce((sum, t) => sum + t.quantity, 0),
    };
    
    const currentStock = animals.filter(a => a.status === 'active').length;
    
    const report = {
      period: {
        startDate: startDate || 'All time',
        endDate: endDate || new Date().toISOString().split('T')[0],
      },
      currentStock,
      movements,
      netChange: movements.purchases + movements.births + movements.transfersIn - 
                 movements.sales - movements.deaths - movements.transfersOut + movements.adjustments,
      transactions: transactions.length,
    };
    
    res.json(report);
  } catch (error) {
    console.error('Error generating reconciliation report:', error);
    res.status(500).json({ error: 'Failed to generate reconciliation report' });
  }
});

// Get transaction summary by type
router.get('/transactions/summary/by-type', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const transactions = await storage.getStockTransactions({
      startDate: startDate as string,
      endDate: endDate as string,
    });
    
    const summary = transactions.reduce((acc, t) => {
      if (!acc[t.type]) {
        acc[t.type] = { count: 0, quantity: 0, totalValue: 0 };
      }
      acc[t.type].count++;
      acc[t.type].quantity += t.quantity;
      acc[t.type].totalValue += t.totalValue || 0;
      return acc;
    }, {} as Record<string, { count: number; quantity: number; totalValue: number }>);
    
    res.json(summary);
  } catch (error) {
    console.error('Error fetching transaction summary:', error);
    res.status(500).json({ error: 'Failed to fetch transaction summary' });
  }
});

export default router;
