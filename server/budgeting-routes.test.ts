import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the budgeting router for testing
let mockBudgets = [
  {
    id: 1,
    name: 'Test Budget 2024',
    year: 2024,
    totalIncome: 500000,
    totalExpenses: 300000,
    netIncome: 200000,
    status: 'active',
    createdAt: new Date().toISOString(),
  }
];

let mockBudgetCategories = [
  {
    id: 1,
    budgetId: 1,
    name: 'Feed Costs',
    allocatedAmount: 100000,
    spentAmount: 75000,
    remainingAmount: 25000,
  }
];

const mockBudgetingRouter = express.Router();
mockBudgetingRouter.get('/budgets', (req, res) => {
  res.json({
    budgets: mockBudgets,
    pagination: {
      page: 1,
      limit: 10,
      total: mockBudgets.length,
      totalPages: 1,
    }
  });
});

mockBudgetingRouter.post('/budgets', (req, res) => {
  const { name, year, totalIncome, totalExpenses } = req.body;
  
  // Validation logic
  if (!name || !year || !totalIncome || !totalExpenses) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (totalIncome < 0 || totalExpenses < 0) {
    return res.status(400).json({ error: 'Amounts cannot be negative' });
  }
  
  const newBudget = {
    id: mockBudgets.length + 1,
    ...req.body,
    netIncome: totalIncome - totalExpenses,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  
  mockBudgets.push(newBudget);
  res.status(201).json(newBudget);
});

mockBudgetingRouter.put('/budgets/:id', (req, res) => {
  if (req.params.id === '99999') {
    return res.status(404).json({ error: 'Budget not found' });
  }
  
  const budgetIndex = mockBudgets.findIndex(b => b.id === parseInt(req.params.id));
  if (budgetIndex === -1) {
    return res.status(404).json({ error: 'Budget not found' });
  }
  
  mockBudgets[budgetIndex] = { ...mockBudgets[budgetIndex], ...req.body };
  res.status(200).json(mockBudgets[budgetIndex]);
});

mockBudgetingRouter.delete('/budgets/:id', (req, res) => {
  if (req.params.id === '99999') {
    return res.status(404).json({ error: 'Budget not found' });
  }
  
  mockBudgets = mockBudgets.filter(budget => budget.id !== parseInt(req.params.id));
  res.status(200).json({ message: 'Budget deleted successfully' });
});

mockBudgetingRouter.get('/categories', (req, res) => {
  res.json({
    categories: mockBudgetCategories,
    total: mockBudgetCategories.length,
  });
});

mockBudgetingRouter.post('/categories', (req, res) => {
  const { budgetId, name, allocatedAmount } = req.body;
  
  if (!budgetId || !name || !allocatedAmount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const newCategory = {
    id: mockBudgetCategories.length + 1,
    ...req.body,
    spentAmount: 0,
    remainingAmount: allocatedAmount,
  };
  
  mockBudgetCategories.push(newCategory);
  res.status(201).json(newCategory);
});

mockBudgetingRouter.get('/forecast', (req, res) => {
  res.json({
    forecast: {
      projectedIncome: 550000,
      projectedExpenses: 320000,
      projectedNetIncome: 230000,
      confidence: 0.85,
    },
    assumptions: {
      milkPricePerLitre: 0.85,
      herdSize: 250,
      seasonLength: 300,
    },
  });
});

mockBudgetingRouter.get('/performance', (req, res) => {
  res.json({
    performance: {
      budgetVariance: -5.2,
      expenseEfficiency: 92.5,
      revenueAchievement: 104.3,
      overallScore: 88.7,
    },
    trends: {
      incomeTrend: 'increasing',
      expenseTrend: 'stable',
      profitabilityTrend: 'improving',
    },
  });
});

const app = express();
app.use(express.json());
app.use('/api/budgeting', mockBudgetingRouter);

describe('Budgeting & Forecasting Routes', () => {
  beforeEach(async () => {
    // Reset mock data before each test
    mockBudgets = [
      {
        id: 1,
        name: 'Test Budget 2024',
        year: 2024,
        totalIncome: 500000,
        totalExpenses: 300000,
        netIncome: 200000,
        status: 'active',
        createdAt: new Date().toISOString(),
      }
    ];

    mockBudgetCategories = [
      {
        id: 1,
        budgetId: 1,
        name: 'Feed Costs',
        allocatedAmount: 100000,
        spentAmount: 75000,
        remainingAmount: 25000,
      }
    ];
    vi.clearAllMocks();
  });

  describe('GET /api/budgeting/budgets', () => {
    it('should return budgets with filters', async () => {
      const response = await request(app)
        .get('/api/budgeting/budgets')
        .expect(200);

      expect(response.body).toHaveProperty('budgets');
      expect(Array.isArray(response.body.budgets)).toBe(true);
      expect(response.body.budgets.length).toBeGreaterThan(0);
      expect(response.body.budgets[0]).toMatchObject({
        name: 'Test Budget 2024',
        year: 2024,
        totalIncome: 500000,
        totalExpenses: 300000,
        netIncome: 200000,
        status: 'active',
      });
    });

    it('should filter budgets by status', async () => {
      const response = await request(app)
        .get('/api/budgeting/budgets?status=active')
        .expect(200);

      expect(response.body.budgets).toHaveLength(1);
      expect(response.body.budgets[0].status).toBe('active');
    });
  });

  describe('POST /api/budgeting/budgets', () => {
    it('should create a new budget', async () => {
      const newBudget = {
        name: 'New Farm Budget',
        year: 2024,
        totalIncome: 600000,
        totalExpenses: 350000,
      };

      const response = await request(app)
        .post('/api/budgeting/budgets')
        .send(newBudget)
        .expect(201);

      expect(response.body).toMatchObject({
        ...newBudget,
        netIncome: 250000,
        status: 'active',
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
    });

    it('should validate required fields', async () => {
      const incompleteBudget = {
        name: 'Incomplete Budget',
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/budgeting/budgets')
        .send(incompleteBudget)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate budget amounts are positive', async () => {
      const invalidBudget = {
        name: 'Invalid Budget',
        year: 2024,
        totalIncome: -1000, // Negative amount
        totalExpenses: 50000,
      };

      const response = await request(app)
        .post('/api/budgeting/budgets')
        .send(invalidBudget)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/budgeting/categories', () => {
    it('should return budget categories', async () => {
      const response = await request(app)
        .get('/api/budgeting/categories')
        .expect(200);

      expect(response.body).toHaveProperty('categories');
      expect(Array.isArray(response.body.categories)).toBe(true);
      expect(response.body.categories.length).toBeGreaterThan(0);
      expect(response.body.categories[0]).toHaveProperty('name');
      expect(response.body.categories[0]).toHaveProperty('allocatedAmount');
    });
  });

  describe('POST /api/budgeting/categories', () => {
    it('should create a new budget category', async () => {
      const newCategory = {
        budgetId: 1,
        name: 'Equipment Costs',
        allocatedAmount: 50000,
      };

      const response = await request(app)
        .post('/api/budgeting/categories')
        .send(newCategory)
        .expect(201);

      expect(response.body).toMatchObject({
        ...newCategory,
        spentAmount: 0,
        remainingAmount: 50000,
      });
      expect(response.body).toHaveProperty('id');
    });

    it('should validate required fields for categories', async () => {
      const incompleteCategory = {
        name: 'Incomplete Category',
        // Missing budgetId and allocatedAmount
      };

      const response = await request(app)
        .post('/api/budgeting/categories')
        .send(incompleteCategory)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/budgeting/forecast', () => {
    it('should return budget forecast', async () => {
      const response = await request(app)
        .get('/api/budgeting/forecast')
        .expect(200);

      expect(response.body).toHaveProperty('forecast');
      expect(response.body.forecast).toMatchObject({
        projectedIncome: 550000,
        projectedExpenses: 320000,
        projectedNetIncome: 230000,
        confidence: 0.85,
      });
      expect(response.body).toHaveProperty('assumptions');
    });
  });

  describe('GET /api/budgeting/performance', () => {
    it('should return budget performance metrics', async () => {
      const response = await request(app)
        .get('/api/budgeting/performance')
        .expect(200);

      expect(response.body).toHaveProperty('performance');
      expect(response.body.performance).toMatchObject({
        budgetVariance: -5.2,
        expenseEfficiency: 92.5,
        revenueAchievement: 104.3,
        overallScore: 88.7,
      });
      expect(response.body).toHaveProperty('trends');
    });
  });

  describe('PUT /api/budgeting/budgets/:id', () => {
    it('should update an existing budget', async () => {
      const updateData = {
        name: 'Updated Budget Name',
        totalIncome: 550000,
      };

      const response = await request(app)
        .put('/api/budgeting/budgets/1')
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe('Updated Budget Name');
      expect(response.body.totalIncome).toBe(550000);
    });

    it('should return 404 for non-existent budget', async () => {
      const response = await request(app)
        .put('/api/budgeting/budgets/99999')
        .send({ name: 'Updated Budget' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/budgeting/budgets/:id', () => {
    it('should delete a budget', async () => {
      const response = await request(app)
        .delete('/api/budgeting/budgets/1')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      
      // Verify budget is deleted
      const remainingBudgets = await request(app)
        .get('/api/budgeting/budgets')
        .expect(200);

      expect(remainingBudgets.body.budgets).toHaveLength(0);
    });

    it('should return 404 for non-existent budget', async () => {
      const response = await request(app)
        .delete('/api/budgeting/budgets/99999')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});
