import { Router, Request, Response } from 'express';

const router = Router();

// NZ Dairy Industry Benchmark Data (DairyNZ averages)
const INDUSTRY_BENCHMARKS = {
  // Production metrics
  milkSolidsPerCow: { average: 380, top10: 450, bottom10: 310 },
  milkSolidsPerHa: { average: 1100, top10: 1400, bottom10: 850 },
  milkingDays: { average: 270, top10: 285, bottom10: 250 },
  peakMilkPerCow: { average: 2.1, top10: 2.5, bottom10: 1.7 },
  
  // Reproduction metrics
  sixWeekInCalfRate: { average: 68, top10: 78, bottom10: 55 },
  emptyRate: { average: 12, top10: 6, bottom10: 20 },
  submissionRate: { average: 85, top10: 95, bottom10: 72 },
  conceptionRate: { average: 52, top10: 62, bottom10: 42 },
  calvingSpread: { average: 12, top10: 8, bottom10: 18 },
  
  // Financial metrics ($/kg MS)
  farmWorkingExpenses: { average: 4.20, top10: 3.50, bottom10: 5.10 },
  operatingProfit: { average: 3.80, top10: 5.20, bottom10: 2.20 },
  cashSurplus: { average: 2.50, top10: 4.00, bottom10: 0.80 },
  debtPerKgMS: { average: 18, top10: 8, bottom10: 32 },
  
  // Pasture metrics
  pastureHarvested: { average: 12500, top10: 15000, bottom10: 10000 },
  pastureUtilization: { average: 85, top10: 92, bottom10: 75 },
  supplementPerCow: { average: 850, top10: 500, bottom10: 1200 },
  
  // Animal health
  somaticCellCount: { average: 180, top10: 120, bottom10: 280 },
  lamenessRate: { average: 8, top10: 3, bottom10: 15 },
  mastitisRate: { average: 12, top10: 5, bottom10: 22 },
  mortalityRate: { average: 3.5, top10: 1.5, bottom10: 6 },
  
  // Environmental
  nitrogenLeaching: { average: 35, top10: 22, bottom10: 55 },
  ghgEmissions: { average: 10.5, top10: 8.5, bottom10: 13 },
};

// Regional benchmark adjustments (relative to national average)
const REGIONAL_FACTORS: Record<string, Record<string, number>> = {
  'Northland': { milkSolidsPerCow: 0.92, pastureHarvested: 0.88, farmWorkingExpenses: 1.05 },
  'Waikato': { milkSolidsPerCow: 1.05, pastureHarvested: 1.08, farmWorkingExpenses: 0.98 },
  'Taranaki': { milkSolidsPerCow: 1.02, pastureHarvested: 1.05, farmWorkingExpenses: 1.00 },
  'Canterbury': { milkSolidsPerCow: 1.15, pastureHarvested: 0.85, farmWorkingExpenses: 0.95 },
  'Southland': { milkSolidsPerCow: 1.08, pastureHarvested: 1.02, farmWorkingExpenses: 0.97 },
  'Otago': { milkSolidsPerCow: 1.03, pastureHarvested: 0.95, farmWorkingExpenses: 1.02 },
  'Manawatu-Whanganui': { milkSolidsPerCow: 0.98, pastureHarvested: 1.00, farmWorkingExpenses: 1.00 },
  'Bay of Plenty': { milkSolidsPerCow: 0.95, pastureHarvested: 0.92, farmWorkingExpenses: 1.03 },
};

// Get benchmarking dashboard
router.get('/api/benchmarking/dashboard', async (req: Request, res: Response) => {
  try {
    const { region = 'National', farmId } = req.query;
    
    // Get farm's actual metrics (in production, from database)
    const farmMetrics = await getFarmMetrics(farmId as string);
    
    // Get benchmarks adjusted for region
    const benchmarks = getRegionalBenchmarks(region as string);
    
    // Calculate percentile rankings
    const rankings = calculatePercentileRankings(farmMetrics, benchmarks);
    
    // Generate comparison data
    const comparison = generateComparison(farmMetrics, benchmarks);
    
    res.json({
      farmMetrics,
      benchmarks,
      rankings,
      comparison,
      region,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Benchmarking dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch benchmarking data' });
  }
});

// Get specific KPI benchmarks
router.get('/api/benchmarking/kpis', async (req: Request, res: Response) => {
  try {
    const { category, region = 'National' } = req.query;
    
    const benchmarks = getRegionalBenchmarks(region as string);
    
    if (category) {
      const categoryBenchmarks = filterByCategory(benchmarks, category as string);
      res.json(categoryBenchmarks);
    } else {
      res.json(benchmarks);
    }
  } catch (error) {
    console.error('KPI benchmarks error:', error);
    res.status(500).json({ error: 'Failed to fetch KPI benchmarks' });
  }
});

// Get year-over-year comparison
router.get('/api/benchmarking/yoy-comparison', async (req: Request, res: Response) => {
  try {
    const { farmId, years = 3 } = req.query;
    
    const comparison = await getYearOverYearComparison(farmId as string, parseInt(years as string));
    res.json(comparison);
  } catch (error) {
    console.error('YoY comparison error:', error);
    res.status(500).json({ error: 'Failed to fetch year-over-year comparison' });
  }
});

// Get regional rankings
router.get('/api/benchmarking/regional-rankings', async (req: Request, res: Response) => {
  try {
    const { region, metric } = req.query;
    
    const rankings = getRegionalRankings(region as string, metric as string);
    res.json(rankings);
  } catch (error) {
    console.error('Regional rankings error:', error);
    res.status(500).json({ error: 'Failed to fetch regional rankings' });
  }
});

// Set farm targets
router.post('/api/benchmarking/targets', async (req: Request, res: Response) => {
  try {
    const { farmId, targets } = req.body;
    
    // In production, save to database
    // await db.insert(farmTargets).values({ farmId, ...targets });
    
    res.json({ success: true, message: 'Targets saved successfully' });
  } catch (error) {
    console.error('Save targets error:', error);
    res.status(500).json({ error: 'Failed to save targets' });
  }
});

// Get farm targets
router.get('/api/benchmarking/targets/:farmId', async (req: Request, res: Response) => {
  try {
    const { farmId } = req.params;
    
    // In production, fetch from database
    const targets = generateDefaultTargets();
    res.json(targets);
  } catch (error) {
    console.error('Get targets error:', error);
    res.status(500).json({ error: 'Failed to fetch targets' });
  }
});

// Helper functions
async function getFarmMetrics(farmId?: string) {
  // In production, fetch actual farm data from database
  // For now, generate realistic sample data
  return {
    production: {
      milkSolidsPerCow: 395,
      milkSolidsPerHa: 1180,
      milkingDays: 275,
      peakMilkPerCow: 2.2,
      totalMilkSolids: 118500,
      herdSize: 300,
      effectiveArea: 100,
    },
    reproduction: {
      sixWeekInCalfRate: 72,
      emptyRate: 9,
      submissionRate: 88,
      conceptionRate: 55,
      calvingSpread: 10,
    },
    financial: {
      farmWorkingExpenses: 3.95,
      operatingProfit: 4.25,
      cashSurplus: 2.80,
      debtPerKgMS: 15,
      revenuePerKgMS: 8.50,
    },
    pasture: {
      pastureHarvested: 13200,
      pastureUtilization: 88,
      supplementPerCow: 720,
      averageCover: 2400,
    },
    health: {
      somaticCellCount: 145,
      lamenessRate: 5,
      mastitisRate: 8,
      mortalityRate: 2.5,
    },
    environmental: {
      nitrogenLeaching: 28,
      ghgEmissions: 9.2,
    },
  };
}

function getRegionalBenchmarks(region: string) {
  const regionalFactors = REGIONAL_FACTORS[region] || {};
  
  const adjustedBenchmarks: Record<string, any> = {};
  
  Object.entries(INDUSTRY_BENCHMARKS).forEach(([key, values]) => {
    const factor = regionalFactors[key] || 1;
    adjustedBenchmarks[key] = {
      average: Math.round(values.average * factor * 10) / 10,
      top10: Math.round(values.top10 * factor * 10) / 10,
      bottom10: Math.round(values.bottom10 * factor * 10) / 10,
      national: values.average,
    };
  });
  
  return adjustedBenchmarks;
}

function calculatePercentileRankings(farmMetrics: any, benchmarks: any) {
  const rankings: Record<string, any> = {};
  
  // Production rankings
  rankings.milkSolidsPerCow = calculatePercentile(
    farmMetrics.production.milkSolidsPerCow,
    benchmarks.milkSolidsPerCow
  );
  rankings.milkSolidsPerHa = calculatePercentile(
    farmMetrics.production.milkSolidsPerHa,
    benchmarks.milkSolidsPerHa
  );
  
  // Reproduction rankings
  rankings.sixWeekInCalfRate = calculatePercentile(
    farmMetrics.reproduction.sixWeekInCalfRate,
    benchmarks.sixWeekInCalfRate
  );
  rankings.emptyRate = calculatePercentile(
    farmMetrics.reproduction.emptyRate,
    benchmarks.emptyRate,
    true // Lower is better
  );
  
  // Financial rankings
  rankings.farmWorkingExpenses = calculatePercentile(
    farmMetrics.financial.farmWorkingExpenses,
    benchmarks.farmWorkingExpenses,
    true // Lower is better
  );
  rankings.operatingProfit = calculatePercentile(
    farmMetrics.financial.operatingProfit,
    benchmarks.operatingProfit
  );
  
  // Health rankings
  rankings.somaticCellCount = calculatePercentile(
    farmMetrics.health.somaticCellCount,
    benchmarks.somaticCellCount,
    true // Lower is better
  );
  rankings.mortalityRate = calculatePercentile(
    farmMetrics.health.mortalityRate,
    benchmarks.mortalityRate,
    true // Lower is better
  );
  
  // Calculate overall score
  const scores = Object.values(rankings).map((r: any) => r.percentile);
  rankings.overall = {
    percentile: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    rating: getPerformanceRating(scores.reduce((a, b) => a + b, 0) / scores.length),
  };
  
  return rankings;
}

function calculatePercentile(value: number, benchmark: any, lowerIsBetter = false) {
  const { average, top10, bottom10 } = benchmark;
  
  let percentile: number;
  if (lowerIsBetter) {
    if (value <= top10) percentile = 90 + ((top10 - value) / top10) * 10;
    else if (value <= average) percentile = 50 + ((average - value) / (average - top10)) * 40;
    else if (value <= bottom10) percentile = 10 + ((bottom10 - value) / (bottom10 - average)) * 40;
    else percentile = Math.max(1, 10 - ((value - bottom10) / bottom10) * 10);
  } else {
    if (value >= top10) percentile = 90 + ((value - top10) / top10) * 10;
    else if (value >= average) percentile = 50 + ((value - average) / (top10 - average)) * 40;
    else if (value >= bottom10) percentile = 10 + ((value - bottom10) / (average - bottom10)) * 40;
    else percentile = Math.max(1, 10 - ((bottom10 - value) / bottom10) * 10);
  }
  
  percentile = Math.min(99, Math.max(1, Math.round(percentile)));
  
  return {
    value,
    benchmark: average,
    top10,
    bottom10,
    percentile,
    rating: getPerformanceRating(percentile),
    vsAverage: Math.round(((value - average) / average) * 1000) / 10,
  };
}

function getPerformanceRating(percentile: number): string {
  if (percentile >= 90) return 'Excellent';
  if (percentile >= 75) return 'Good';
  if (percentile >= 50) return 'Average';
  if (percentile >= 25) return 'Below Average';
  return 'Needs Improvement';
}

function generateComparison(farmMetrics: any, benchmarks: any) {
  return {
    production: [
      { metric: 'MS/Cow', farm: farmMetrics.production.milkSolidsPerCow, average: benchmarks.milkSolidsPerCow.average, top10: benchmarks.milkSolidsPerCow.top10, unit: 'kg' },
      { metric: 'MS/Ha', farm: farmMetrics.production.milkSolidsPerHa, average: benchmarks.milkSolidsPerHa.average, top10: benchmarks.milkSolidsPerHa.top10, unit: 'kg' },
      { metric: 'Milking Days', farm: farmMetrics.production.milkingDays, average: benchmarks.milkingDays.average, top10: benchmarks.milkingDays.top10, unit: 'days' },
    ],
    reproduction: [
      { metric: '6-Week In-Calf', farm: farmMetrics.reproduction.sixWeekInCalfRate, average: benchmarks.sixWeekInCalfRate.average, top10: benchmarks.sixWeekInCalfRate.top10, unit: '%' },
      { metric: 'Empty Rate', farm: farmMetrics.reproduction.emptyRate, average: benchmarks.emptyRate.average, top10: benchmarks.emptyRate.top10, unit: '%', lowerBetter: true },
      { metric: 'Submission Rate', farm: farmMetrics.reproduction.submissionRate, average: benchmarks.submissionRate.average, top10: benchmarks.submissionRate.top10, unit: '%' },
    ],
    financial: [
      { metric: 'FWE/kg MS', farm: farmMetrics.financial.farmWorkingExpenses, average: benchmarks.farmWorkingExpenses.average, top10: benchmarks.farmWorkingExpenses.top10, unit: '$', lowerBetter: true },
      { metric: 'Operating Profit', farm: farmMetrics.financial.operatingProfit, average: benchmarks.operatingProfit.average, top10: benchmarks.operatingProfit.top10, unit: '$/kg MS' },
      { metric: 'Debt/kg MS', farm: farmMetrics.financial.debtPerKgMS, average: benchmarks.debtPerKgMS.average, top10: benchmarks.debtPerKgMS.top10, unit: '$', lowerBetter: true },
    ],
    health: [
      { metric: 'Bulk SCC', farm: farmMetrics.health.somaticCellCount, average: benchmarks.somaticCellCount.average, top10: benchmarks.somaticCellCount.top10, unit: '000/ml', lowerBetter: true },
      { metric: 'Lameness Rate', farm: farmMetrics.health.lamenessRate, average: benchmarks.lamenessRate.average, top10: benchmarks.lamenessRate.top10, unit: '%', lowerBetter: true },
      { metric: 'Mortality Rate', farm: farmMetrics.health.mortalityRate, average: benchmarks.mortalityRate.average, top10: benchmarks.mortalityRate.top10, unit: '%', lowerBetter: true },
    ],
  };
}

async function getYearOverYearComparison(farmId: string, years: number) {
  const currentYear = new Date().getFullYear();
  const comparison = [];
  
  for (let i = 0; i < years; i++) {
    const year = currentYear - i;
    // In production, fetch actual historical data
    comparison.push({
      year,
      milkSolidsPerCow: 380 + Math.floor(Math.random() * 30) - 10 + (i * -5),
      sixWeekInCalfRate: 70 + Math.floor(Math.random() * 10) - 5 + (i * -2),
      farmWorkingExpenses: 4.0 + (Math.random() * 0.5) - 0.25 + (i * 0.1),
      somaticCellCount: 150 + Math.floor(Math.random() * 40) - 20 + (i * 5),
    });
  }
  
  return comparison.reverse();
}

function getRegionalRankings(region: string, metric: string) {
  const regions = Object.keys(REGIONAL_FACTORS);
  
  return regions.map(r => {
    const factor = REGIONAL_FACTORS[r]?.[metric] || 1;
    const baseValue = (INDUSTRY_BENCHMARKS as any)[metric]?.average || 100;
    
    return {
      region: r,
      value: Math.round(baseValue * factor * 10) / 10,
      rank: 0, // Will be calculated after sorting
    };
  }).sort((a, b) => b.value - a.value)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

function filterByCategory(benchmarks: any, category: string) {
  const categoryMap: Record<string, string[]> = {
    production: ['milkSolidsPerCow', 'milkSolidsPerHa', 'milkingDays', 'peakMilkPerCow'],
    reproduction: ['sixWeekInCalfRate', 'emptyRate', 'submissionRate', 'conceptionRate', 'calvingSpread'],
    financial: ['farmWorkingExpenses', 'operatingProfit', 'cashSurplus', 'debtPerKgMS'],
    pasture: ['pastureHarvested', 'pastureUtilization', 'supplementPerCow'],
    health: ['somaticCellCount', 'lamenessRate', 'mastitisRate', 'mortalityRate'],
    environmental: ['nitrogenLeaching', 'ghgEmissions'],
  };
  
  const keys = categoryMap[category] || [];
  const filtered: Record<string, any> = {};
  
  keys.forEach(key => {
    if (benchmarks[key]) {
      filtered[key] = benchmarks[key];
    }
  });
  
  return filtered;
}

function generateDefaultTargets() {
  return {
    production: {
      milkSolidsPerCow: 400,
      milkSolidsPerHa: 1200,
      totalMilkSolids: 120000,
    },
    reproduction: {
      sixWeekInCalfRate: 75,
      emptyRate: 8,
      submissionRate: 90,
    },
    financial: {
      farmWorkingExpenses: 3.80,
      operatingProfit: 4.50,
    },
    health: {
      somaticCellCount: 140,
      mortalityRate: 2.0,
    },
  };
}

export default router;
