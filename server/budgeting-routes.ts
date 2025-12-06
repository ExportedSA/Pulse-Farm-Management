import { Router } from 'express';
import { z } from 'zod';
import { storage } from './storage';
import { 
  insertBudgetSchema, 
  insertBudgetCategorySchema, 
  insertForecastSchema, 
  insertForecastDataSchema 
} from '@shared/schema';

const router = Router();

// ===== BUDGETS =====

// Get all budgets
router.get('/budgets', async (req, res) => {
  try {
    const { status, limit } = req.query;
    
    const filters: any = {};
    if (status) filters.status = status as string;
    if (limit) filters.limit = parseInt(limit as string);
    
    const budgets = await storage.getBudgets(filters);
    res.json(budgets);
  } catch (error) {
    console.error('Error fetching budgets:', error);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

// Get budget by ID with categories
router.get('/budgets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const budget = await storage.getBudgetById(id);
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    const categories = await storage.getBudgetCategories(id);
    
    res.json({
      ...budget,
      categories,
    });
  } catch (error) {
    console.error('Error fetching budget:', error);
    res.status(500).json({ error: 'Failed to fetch budget' });
  }
});

// Create new budget
router.post('/budgets', async (req, res) => {
  try {
    const validatedData = insertBudgetSchema.parse(req.body);
    
    // Calculate totals if categories provided
    if (req.body.categories && Array.isArray(req.body.categories)) {
      let totalIncome = 0;
      let totalExpenses = 0;
      
      for (const category of req.body.categories) {
        const amount = parseFloat(category.budgetedAmount);
        if (category.type === 'income') {
          totalIncome += amount;
        } else {
          totalExpenses += amount;
        }
      }
      
      validatedData.totalBudgetedIncome = String(totalIncome);
      validatedData.totalBudgetedExpenses = String(totalExpenses);
      validatedData.netBudgetedProfit = String(totalIncome - totalExpenses);
    }
    
    const budget = await storage.createBudget(validatedData);
    
    // Create categories if provided
    if (req.body.categories && Array.isArray(req.body.categories)) {
      for (const category of req.body.categories) {
        await storage.createBudgetCategory({
          ...category,
          budgetId: budget.id,
        });
      }
    }
    
    res.status(201).json(budget);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid budget data', details: error.errors });
    } else {
      console.error('Error creating budget:', error);
      res.status(500).json({ error: 'Failed to create budget' });
    }
  }
});

// Update budget
router.put('/budgets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const budget = await storage.updateBudget(id, updates);
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    res.json(budget);
  } catch (error) {
    console.error('Error updating budget:', error);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

// Delete budget
router.delete('/budgets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteBudget(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    res.json({ message: 'Budget deleted successfully' });
  } catch (error) {
    console.error('Error deleting budget:', error);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

// ===== BUDGET CATEGORIES =====

// Get budget categories
router.get('/budgets/:budgetId/categories', async (req, res) => {
  try {
    const { budgetId } = req.params;
    const categories = await storage.getBudgetCategories(budgetId);
    res.json(categories);
  } catch (error) {
    console.error('Error fetching budget categories:', error);
    res.status(500).json({ error: 'Failed to fetch budget categories' });
  }
});

// Create budget category
router.post('/budgets/:budgetId/categories', async (req, res) => {
  try {
    const { budgetId } = req.params;
    const validatedData = insertBudgetCategorySchema.parse({
      ...req.body,
      budgetId,
    });
    
    const category = await storage.createBudgetCategory(validatedData);
    res.status(201).json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid budget category data', details: error.errors });
    } else {
      console.error('Error creating budget category:', error);
      res.status(500).json({ error: 'Failed to create budget category' });
    }
  }
});

// Update budget category
router.put('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const category = await storage.updateBudgetCategory(id, updates);
    
    if (!category) {
      return res.status(404).json({ error: 'Budget category not found' });
    }
    
    res.json(category);
  } catch (error) {
    console.error('Error updating budget category:', error);
    res.status(500).json({ error: 'Failed to update budget category' });
  }
});

// Delete budget category
router.delete('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteBudgetCategory(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Budget category not found' });
    }
    
    res.json({ message: 'Budget category deleted successfully' });
  } catch (error) {
    console.error('Error deleting budget category:', error);
    res.status(500).json({ error: 'Failed to delete budget category' });
  }
});

// ===== FORECASTS =====

// Get all forecasts
router.get('/forecasts', async (req, res) => {
  try {
    const { forecastType, limit } = req.query;
    
    const filters: any = {};
    if (forecastType) filters.forecastType = forecastType as string;
    if (limit) filters.limit = parseInt(limit as string);
    
    const forecasts = await storage.getForecasts(filters);
    res.json(forecasts);
  } catch (error) {
    console.error('Error fetching forecasts:', error);
    res.status(500).json({ error: 'Failed to fetch forecasts' });
  }
});

// Get forecast by ID with data
router.get('/forecasts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const forecast = await storage.getForecastById(id);
    
    if (!forecast) {
      return res.status(404).json({ error: 'Forecast not found' });
    }
    
    const forecastData = await storage.getForecastData(id);
    
    res.json({
      ...forecast,
      data: forecastData,
    });
  } catch (error) {
    console.error('Error fetching forecast:', error);
    res.status(500).json({ error: 'Failed to fetch forecast' });
  }
});

// Create new forecast
router.post('/forecasts', async (req, res) => {
  try {
    const validatedData = insertForecastSchema.parse(req.body);
    
    const forecast = await storage.createForecast(validatedData);
    
    // Create forecast data if provided
    if (req.body.data && Array.isArray(req.body.data)) {
      for (const dataPoint of req.body.data) {
        await storage.createForecastData({
          ...dataPoint,
          forecastId: forecast.id,
        });
      }
    }
    
    res.status(201).json(forecast);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid forecast data', details: error.errors });
    } else {
      console.error('Error creating forecast:', error);
      res.status(500).json({ error: 'Failed to create forecast' });
    }
  }
});

// Generate forecast based on historical data
router.post('/forecasts/generate', async (req, res) => {
  try {
    const { 
      forecastType, 
      startDate, 
      endDate, 
      periodType,
      assumptions 
    } = req.body;
    
    const forecast = await storage.generateForecast({
      forecastType,
      startDate,
      endDate,
      periodType,
      assumptions,
    });
    
    res.status(201).json(forecast);
  } catch (error) {
    console.error('Error generating forecast:', error);
    res.status(500).json({ error: 'Failed to generate forecast' });
  }
});

// ===== BUDGET ANALYTICS =====

// Get budget performance summary
router.get('/budgets/:id/performance', async (req, res) => {
  try {
    const { id } = req.params;
    const performance = await storage.getBudgetPerformance(id);
    res.json(performance);
  } catch (error) {
    console.error('Error fetching budget performance:', error);
    res.status(500).json({ error: 'Failed to fetch budget performance' });
  }
});

// Get budget vs actual comparison
router.get('/budgets/:id/comparison', async (req, res) => {
  try {
    const { id } = req.params;
    const comparison = await storage.getBudgetVsActual(id);
    res.json(comparison);
  } catch (error) {
    console.error('Error fetching budget comparison:', error);
    res.status(500).json({ error: 'Failed to fetch budget comparison' });
  }
});

// Get forecast accuracy
router.get('/forecasts/:id/accuracy', async (req, res) => {
  try {
    const { id } = req.params;
    const accuracy = await storage.getForecastAccuracy(id);
    res.json(accuracy);
  } catch (error) {
    console.error('Error fetching forecast accuracy:', error);
    res.status(500).json({ error: 'Failed to fetch forecast accuracy' });
  }
});

export default router;
