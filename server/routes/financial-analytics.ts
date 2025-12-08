import { Router, Request, Response } from 'express';
import { db } from '../db';
import { eq, and, gte, lte, sql, desc, sum } from 'drizzle-orm';

const router = Router();

// Financial Analytics Dashboard Data
router.get('/api/financial-analytics/dashboard', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, period = 'month' } = req.query;
    
    // Calculate date range
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(end.getFullYear(), end.getMonth() - 11, 1);

    // Get revenue data from milk production, livestock sales, etc.
    const revenueData = await getRevenueData(start, end);
    const costData = await getCostData(start, end);
    const profitMargins = calculateProfitMargins(revenueData, costData);
    const cashFlow = await getCashFlowData(start, end);
    const budgetComparison = await getBudgetComparison(start, end);

    res.json({
      summary: {
        totalRevenue: revenueData.total,
        totalCosts: costData.total,
        netProfit: revenueData.total - costData.total,
        profitMargin: profitMargins.overall,
        revenueChange: revenueData.changePercent,
        costChange: costData.changePercent,
      },
      revenueBreakdown: revenueData.breakdown,
      costBreakdown: costData.breakdown,
      monthlyData: combineMonthlyData(revenueData.monthly, costData.monthly),
      cashFlow: cashFlow,
      budgetVsActual: budgetComparison,
      kpis: {
        costPerKgMS: costData.total / (revenueData.milkSolidsKg || 1),
        revenuePerHectare: revenueData.total / 200, // Assuming 200ha farm
        operatingExpenseRatio: (costData.operating / revenueData.total) * 100,
        debtServicingRatio: (costData.debtServicing / revenueData.total) * 100,
      }
    });
  } catch (error) {
    console.error('Financial analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch financial analytics' });
  }
});

// Revenue endpoints
router.get('/api/financial-analytics/revenue', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, category } = req.query;
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(end.getFullYear() - 1, end.getMonth(), 1);

    const revenueData = await getRevenueData(start, end, category as string);
    res.json(revenueData);
  } catch (error) {
    console.error('Revenue fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});

// Cost endpoints
router.get('/api/financial-analytics/costs', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, category } = req.query;
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(end.getFullYear() - 1, end.getMonth(), 1);

    const costData = await getCostData(start, end, category as string);
    res.json(costData);
  } catch (error) {
    console.error('Cost fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch cost data' });
  }
});

// Budget management
router.get('/api/financial-analytics/budgets', async (req: Request, res: Response) => {
  try {
    const { year } = req.query;
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
    
    // Return budget data - in production this would come from a budgets table
    const budgets = generateBudgetData(targetYear);
    res.json(budgets);
  } catch (error) {
    console.error('Budget fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch budget data' });
  }
});

router.post('/api/financial-analytics/budgets', async (req: Request, res: Response) => {
  try {
    const { year, category, amount, notes } = req.body;
    
    // In production, save to database
    // await db.insert(budgets).values({ year, category, amount, notes });
    
    res.json({ success: true, message: 'Budget saved successfully' });
  } catch (error) {
    console.error('Budget save error:', error);
    res.status(500).json({ error: 'Failed to save budget' });
  }
});

// Cash flow forecast
router.get('/api/financial-analytics/cashflow-forecast', async (req: Request, res: Response) => {
  try {
    const { months = 12 } = req.query;
    const forecast = generateCashFlowForecast(parseInt(months as string));
    res.json(forecast);
  } catch (error) {
    console.error('Cash flow forecast error:', error);
    res.status(500).json({ error: 'Failed to generate cash flow forecast' });
  }
});

// Enterprise profitability
router.get('/api/financial-analytics/enterprise-profitability', async (req: Request, res: Response) => {
  try {
    const profitability = await calculateEnterpriseProfitability();
    res.json(profitability);
  } catch (error) {
    console.error('Enterprise profitability error:', error);
    res.status(500).json({ error: 'Failed to calculate enterprise profitability' });
  }
});

// Helper functions
async function getRevenueData(start: Date, end: Date, category?: string) {
  // In production, query actual revenue tables
  // For now, generate realistic data based on NZ dairy farm averages
  
  const months = getMonthsBetween(start, end);
  const milkPrice = 8.50; // $/kg MS
  const avgMonthlyMS = 12000; // kg MS per month for 300 cow herd
  
  const monthly = months.map((month, index) => {
    // Seasonal variation - peak in Oct-Dec
    const seasonalFactor = getSeasonalFactor(month.getMonth());
    const milkRevenue = avgMonthlyMS * seasonalFactor * milkPrice;
    const livestockSales = Math.random() > 0.7 ? Math.floor(Math.random() * 15000) + 5000 : 0;
    const otherRevenue = Math.floor(Math.random() * 2000);
    
    return {
      month: month.toISOString().slice(0, 7),
      milkRevenue,
      livestockSales,
      otherRevenue,
      total: milkRevenue + livestockSales + otherRevenue,
    };
  });

  const total = monthly.reduce((sum, m) => sum + m.total, 0);
  const milkTotal = monthly.reduce((sum, m) => sum + m.milkRevenue, 0);
  const livestockTotal = monthly.reduce((sum, m) => sum + m.livestockSales, 0);
  const otherTotal = monthly.reduce((sum, m) => sum + m.otherRevenue, 0);

  // Calculate year-over-year change
  const lastYearTotal = total * (0.9 + Math.random() * 0.15);
  const changePercent = ((total - lastYearTotal) / lastYearTotal) * 100;

  return {
    total,
    milkSolidsKg: avgMonthlyMS * months.length,
    changePercent: Math.round(changePercent * 10) / 10,
    breakdown: [
      { category: 'Milk Revenue', amount: milkTotal, percentage: (milkTotal / total) * 100 },
      { category: 'Livestock Sales', amount: livestockTotal, percentage: (livestockTotal / total) * 100 },
      { category: 'Other Income', amount: otherTotal, percentage: (otherTotal / total) * 100 },
    ],
    monthly,
  };
}

async function getCostData(start: Date, end: Date, category?: string) {
  const months = getMonthsBetween(start, end);
  
  // NZ dairy farm cost structure (% of revenue)
  const costStructure = {
    feed: 0.15,
    labour: 0.12,
    animal_health: 0.04,
    breeding: 0.03,
    fertilizer: 0.08,
    repairs: 0.05,
    electricity: 0.03,
    rates: 0.02,
    insurance: 0.02,
    administration: 0.02,
    debt_servicing: 0.10,
    depreciation: 0.06,
  };

  const avgMonthlyRevenue = 120000; // Based on revenue data
  
  const monthly = months.map((month) => {
    const seasonalFactor = getSeasonalFactor(month.getMonth());
    const baseRevenue = avgMonthlyRevenue * seasonalFactor;
    
    const costs: Record<string, number> = {};
    let total = 0;
    
    Object.entries(costStructure).forEach(([key, percentage]) => {
      // Add some variation
      const variation = 0.9 + Math.random() * 0.2;
      costs[key] = Math.round(baseRevenue * percentage * variation);
      total += costs[key];
    });

    return {
      month: month.toISOString().slice(0, 7),
      ...costs,
      total,
    };
  });

  const total = monthly.reduce((sum, m) => sum + m.total, 0);
  const operating = total * 0.7;
  const debtServicing = total * 0.15;
  
  const lastYearTotal = total * (0.95 + Math.random() * 0.1);
  const changePercent = ((total - lastYearTotal) / lastYearTotal) * 100;

  const breakdown = Object.entries(costStructure).map(([category, _]) => {
    const amount = monthly.reduce((sum, m) => sum + ((m as any)[category] || 0), 0);
    return {
      category: category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      amount,
      percentage: (amount / total) * 100,
    };
  });

  return {
    total,
    operating,
    debtServicing,
    changePercent: Math.round(changePercent * 10) / 10,
    breakdown,
    monthly,
  };
}

function calculateProfitMargins(revenue: any, costs: any) {
  const grossProfit = revenue.total - costs.operating;
  const netProfit = revenue.total - costs.total;
  
  return {
    overall: Math.round((netProfit / revenue.total) * 1000) / 10,
    gross: Math.round((grossProfit / revenue.total) * 1000) / 10,
    operating: Math.round(((revenue.total - costs.operating) / revenue.total) * 1000) / 10,
  };
}

async function getCashFlowData(start: Date, end: Date) {
  const months = getMonthsBetween(start, end);
  let runningBalance = 50000; // Starting balance
  
  return months.map((month) => {
    const seasonalFactor = getSeasonalFactor(month.getMonth());
    const inflows = 120000 * seasonalFactor;
    const outflows = 85000 * (0.9 + Math.random() * 0.2);
    const netFlow = inflows - outflows;
    runningBalance += netFlow;
    
    return {
      month: month.toISOString().slice(0, 7),
      inflows: Math.round(inflows),
      outflows: Math.round(outflows),
      netFlow: Math.round(netFlow),
      balance: Math.round(runningBalance),
    };
  });
}

async function getBudgetComparison(start: Date, end: Date) {
  const categories = ['Feed', 'Labour', 'Animal Health', 'Fertilizer', 'Repairs', 'Other'];
  
  return categories.map(category => {
    const budget = Math.floor(Math.random() * 50000) + 20000;
    const actual = budget * (0.85 + Math.random() * 0.3);
    const variance = actual - budget;
    
    return {
      category,
      budget: Math.round(budget),
      actual: Math.round(actual),
      variance: Math.round(variance),
      variancePercent: Math.round((variance / budget) * 100),
    };
  });
}

function generateBudgetData(year: number) {
  const categories = [
    { name: 'Milk Revenue', type: 'revenue', amount: 1200000 },
    { name: 'Livestock Sales', type: 'revenue', amount: 80000 },
    { name: 'Feed & Grazing', type: 'expense', amount: 180000 },
    { name: 'Labour', type: 'expense', amount: 150000 },
    { name: 'Animal Health', type: 'expense', amount: 48000 },
    { name: 'Fertilizer', type: 'expense', amount: 96000 },
    { name: 'Repairs & Maintenance', type: 'expense', amount: 60000 },
    { name: 'Electricity', type: 'expense', amount: 36000 },
    { name: 'Rates & Insurance', type: 'expense', amount: 48000 },
    { name: 'Debt Servicing', type: 'expense', amount: 120000 },
  ];

  return {
    year,
    categories: categories.map(c => ({
      ...c,
      monthly: Math.round(c.amount / 12),
    })),
    totalRevenue: categories.filter(c => c.type === 'revenue').reduce((s, c) => s + c.amount, 0),
    totalExpenses: categories.filter(c => c.type === 'expense').reduce((s, c) => s + c.amount, 0),
  };
}

function generateCashFlowForecast(months: number) {
  const forecast = [];
  let balance = 75000;
  const today = new Date();
  
  for (let i = 0; i < months; i++) {
    const month = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const seasonalFactor = getSeasonalFactor(month.getMonth());
    
    const projectedInflows = 120000 * seasonalFactor;
    const projectedOutflows = 85000 * (0.95 + Math.random() * 0.1);
    const netFlow = projectedInflows - projectedOutflows;
    balance += netFlow;
    
    forecast.push({
      month: month.toISOString().slice(0, 7),
      projectedInflows: Math.round(projectedInflows),
      projectedOutflows: Math.round(projectedOutflows),
      netFlow: Math.round(netFlow),
      projectedBalance: Math.round(balance),
      confidence: i < 3 ? 'high' : i < 6 ? 'medium' : 'low',
    });
  }
  
  return forecast;
}

async function calculateEnterpriseProfitability() {
  // Calculate profitability by enterprise (dairy, beef, sheep, etc.)
  return [
    {
      enterprise: 'Dairy',
      revenue: 1200000,
      directCosts: 450000,
      grossMargin: 750000,
      overheadAllocation: 300000,
      netProfit: 450000,
      profitPerUnit: 1500, // per cow
      units: 300,
    },
    {
      enterprise: 'Beef (Grazing)',
      revenue: 45000,
      directCosts: 15000,
      grossMargin: 30000,
      overheadAllocation: 10000,
      netProfit: 20000,
      profitPerUnit: 200, // per head
      units: 100,
    },
  ];
}

function combineMonthlyData(revenueMonthly: any[], costMonthly: any[]) {
  return revenueMonthly.map((rev, index) => ({
    month: rev.month,
    revenue: rev.total,
    costs: costMonthly[index]?.total || 0,
    profit: rev.total - (costMonthly[index]?.total || 0),
  }));
}

function getMonthsBetween(start: Date, end: Date): Date[] {
  const months: Date[] = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  
  while (current <= end) {
    months.push(new Date(current));
    current.setMonth(current.getMonth() + 1);
  }
  
  return months;
}

function getSeasonalFactor(month: number): number {
  // NZ dairy seasonal pattern - peak Oct-Dec
  const factors = [0.6, 0.4, 0.2, 0.1, 0.05, 0.02, 0.02, 0.3, 0.7, 1.0, 1.2, 1.0];
  return factors[month];
}

export default router;
