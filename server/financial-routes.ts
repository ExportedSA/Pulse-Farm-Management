import { Router } from 'express';
import { z } from 'zod';
import { storage } from './storage';
import { insertExpenseSchema, insertKillsheetSchema, insertKillsheetItemSchema } from '@shared/schema';

const router = Router();

// ===== EXPENSES =====

// Get all expenses with optional filters
router.get('/expenses', async (req, res) => {
  try {
    const { category, startDate, endDate, limit } = req.query;
    
    const filters: any = {};
    if (category) filters.category = category as string;
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;
    if (limit) filters.limit = parseInt(limit as string);
    
    const expenses = await storage.getExpenses(filters);
    res.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Get expense summary by category
router.get('/expenses/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const summary = await storage.getExpenseSummary(
      startDate as string | undefined,
      endDate as string | undefined
    );
    res.json(summary);
  } catch (error) {
    console.error('Error fetching expense summary:', error);
    res.status(500).json({ error: 'Failed to fetch expense summary' });
  }
});

// Get expense by ID
router.get('/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await storage.getExpenseById(id);
    
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json(expense);
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// Create new expense
router.post('/expenses', async (req, res) => {
  try {
    const validatedData = insertExpenseSchema.parse(req.body);
    const expense = await storage.createExpense(validatedData);
    res.status(201).json(expense);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid expense data', details: error.errors });
    } else {
      console.error('Error creating expense:', error);
      res.status(500).json({ error: 'Failed to create expense' });
    }
  }
});

// Update expense
router.put('/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const expense = await storage.updateExpense(id, updates);
    
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json(expense);
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// Delete expense
router.delete('/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteExpense(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// ===== KILLSHEETS =====

// Get all killsheets with optional filters
router.get('/killsheets', async (req, res) => {
  try {
    const { startDate, endDate, processor, paymentReceived, limit } = req.query;
    
    const filters: any = {};
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;
    if (processor) filters.processor = processor as string;
    if (paymentReceived !== undefined) filters.paymentReceived = paymentReceived === 'true';
    if (limit) filters.limit = parseInt(limit as string);
    
    const killsheets = await storage.getKillsheets(filters);
    res.json(killsheets);
  } catch (error) {
    console.error('Error fetching killsheets:', error);
    res.status(500).json({ error: 'Failed to fetch killsheets' });
  }
});

// Get killsheet summary/stats
router.get('/killsheets/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const summary = await storage.getKillsheetSummary(
      startDate as string | undefined,
      endDate as string | undefined
    );
    res.json(summary);
  } catch (error) {
    console.error('Error fetching killsheet summary:', error);
    res.status(500).json({ error: 'Failed to fetch killsheet summary' });
  }
});

// Get killsheet by ID with items
router.get('/killsheets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const killsheet = await storage.getKillsheetById(id);
    
    if (!killsheet) {
      return res.status(404).json({ error: 'Killsheet not found' });
    }
    
    const items = await storage.getKillsheetItems(id);
    res.json({ ...killsheet, items });
  } catch (error) {
    console.error('Error fetching killsheet:', error);
    res.status(500).json({ error: 'Failed to fetch killsheet' });
  }
});

// Create new killsheet
router.post('/killsheets', async (req, res) => {
  try {
    const validatedData = insertKillsheetSchema.parse(req.body);
    const killsheet = await storage.createKillsheet(validatedData);
    res.status(201).json(killsheet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid killsheet data', details: error.errors });
    } else {
      console.error('Error creating killsheet:', error);
      res.status(500).json({ error: 'Failed to create killsheet' });
    }
  }
});

// Update killsheet
router.put('/killsheets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const killsheet = await storage.updateKillsheet(id, updates);
    
    if (!killsheet) {
      return res.status(404).json({ error: 'Killsheet not found' });
    }
    
    res.json(killsheet);
  } catch (error) {
    console.error('Error updating killsheet:', error);
    res.status(500).json({ error: 'Failed to update killsheet' });
  }
});

// Mark killsheet payment as received
router.post('/killsheets/:id/payment-received', async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentDate } = req.body;
    
    const killsheet = await storage.markKillsheetPaymentReceived(id, paymentDate);
    
    if (!killsheet) {
      return res.status(404).json({ error: 'Killsheet not found' });
    }
    
    res.json(killsheet);
  } catch (error) {
    console.error('Error marking payment received:', error);
    res.status(500).json({ error: 'Failed to mark payment received' });
  }
});

// Delete killsheet
router.delete('/killsheets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteKillsheet(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Killsheet not found' });
    }
    
    res.json({ message: 'Killsheet deleted successfully' });
  } catch (error) {
    console.error('Error deleting killsheet:', error);
    res.status(500).json({ error: 'Failed to delete killsheet' });
  }
});

// ===== KILLSHEET ITEMS =====

// Add item to killsheet
router.post('/killsheets/:killsheetId/items', async (req, res) => {
  try {
    const { killsheetId } = req.params;
    const validatedData = insertKillsheetItemSchema.parse({
      ...req.body,
      killsheetId,
    });
    const item = await storage.createKillsheetItem(validatedData);
    res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid killsheet item data', details: error.errors });
    } else {
      console.error('Error creating killsheet item:', error);
      res.status(500).json({ error: 'Failed to create killsheet item' });
    }
  }
});

// Delete killsheet item
router.delete('/killsheets/:killsheetId/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const success = await storage.deleteKillsheetItem(itemId);
    
    if (!success) {
      return res.status(404).json({ error: 'Killsheet item not found' });
    }
    
    res.json({ message: 'Killsheet item deleted successfully' });
  } catch (error) {
    console.error('Error deleting killsheet item:', error);
    res.status(500).json({ error: 'Failed to delete killsheet item' });
  }
});

// ===== FINANCIAL REPORTS =====

// ===== TREATMENT COSTS =====

// Get treatment cost summary
router.get('/treatment-costs/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const summary = await storage.getTreatmentCostSummary(
      startDate as string | undefined,
      endDate as string | undefined
    );
    res.json(summary);
  } catch (error) {
    console.error('Error fetching treatment cost summary:', error);
    res.status(500).json({ error: 'Failed to fetch treatment cost summary' });
  }
});

// Get treatments with costs
router.get('/treatment-costs', async (req, res) => {
  try {
    const { startDate, endDate, limit } = req.query;
    const treatments = await storage.getTreatmentsWithCosts(
      startDate as string | undefined,
      endDate as string | undefined,
      limit ? parseInt(limit as string) : 50
    );
    res.json(treatments);
  } catch (error) {
    console.error('Error fetching treatments with costs:', error);
    res.status(500).json({ error: 'Failed to fetch treatments with costs' });
  }
});

// Get treatment cost by condition
router.get('/treatment-costs/by-condition', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const costsByCondition = await storage.getTreatmentCostsByCondition(
      startDate as string | undefined,
      endDate as string | undefined
    );
    res.json(costsByCondition);
  } catch (error) {
    console.error('Error fetching treatment costs by condition:', error);
    res.status(500).json({ error: 'Failed to fetch treatment costs by condition' });
  }
});

// Get profit/loss report
router.get('/reports/profit-loss', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const [expenses, killsheets] = await Promise.all([
      storage.getExpenseSummary(startDate as string, endDate as string),
      storage.getKillsheetSummary(startDate as string, endDate as string),
    ]);
    
    const totalExpenses = expenses.total || 0;
    const totalIncome = killsheets.totalNetPayment || 0;
    const profitLoss = totalIncome - totalExpenses;
    
    res.json({
      period: { startDate, endDate },
      income: {
        killsheets: totalIncome,
        total: totalIncome,
      },
      expenses: {
        byCategory: expenses.byCategory,
        total: totalExpenses,
      },
      profitLoss,
      margin: totalIncome > 0 ? ((profitLoss / totalIncome) * 100).toFixed(2) : 0,
    });
  } catch (error) {
    console.error('Error generating profit/loss report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export default router;
