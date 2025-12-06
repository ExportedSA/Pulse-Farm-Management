// Health Analytics API Routes
import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { 
  animalTreatments, animals, healthScores, mortalityRecords, 
  vetVisits, prescriptions, labResults, products
} from "@shared/schema";
import { eq, and, gte, lte, sql, desc, count } from "drizzle-orm";

const router = Router();

// GET /api/analytics/health/summary - Health dashboard overview
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get total animals
    const [animalCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(animals)
      .where(eq(animals.status, 'active'));

    // Get treatment counts
    const [treatmentCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(animalTreatments)
      .where(gte(animalTreatments.treatmentDate, startDate.toISOString().split('T')[0]));

    // Get mortality count
    const [mortalityCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(mortalityRecords)
      .where(gte(mortalityRecords.deathDate, startDate));

    // Get vet visit count
    const [visitCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vetVisits)
      .where(and(
        gte(vetVisits.scheduledDate, startDate),
        eq(vetVisits.status, 'completed')
      ));

    // Get active prescriptions
    const [rxCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(prescriptions)
      .where(eq(prescriptions.status, 'active'));

    // Calculate health score averages
    const healthScoreAvgs = await db
      .select({
        avgLameness: sql<number>`avg(${healthScores.lamenessScore})::numeric(3,1)`,
        avgBcs: sql<number>`avg(${healthScores.bcsScore})::numeric(3,1)`,
        avgTemperature: sql<number>`avg(${healthScores.temperature})::numeric(4,1)`,
      })
      .from(healthScores)
      .where(gte(healthScores.recordedAt, startDate));

    res.json({
      totalAnimals: animalCount?.count || 0,
      treatmentsThisPeriod: treatmentCount?.count || 0,
      mortalityThisPeriod: mortalityCount?.count || 0,
      vetVisitsThisPeriod: visitCount?.count || 0,
      activePrescriptions: rxCount?.count || 0,
      averageScores: {
        lameness: healthScoreAvgs[0]?.avgLameness || null,
        bcs: healthScoreAvgs[0]?.avgBcs || null,
        temperature: healthScoreAvgs[0]?.avgTemperature || null,
      },
      periodDays: days,
    });
  } catch (error) {
    console.error("Error fetching health summary:", error);
    res.status(500).json({ error: "Failed to fetch health summary" });
  }
});

// GET /api/analytics/health/treatment-costs - Treatment cost analysis
router.get("/treatment-costs", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get treatments with costs
    const treatments = await db
      .select({
        id: animalTreatments.id,
        animalId: animalTreatments.animalId,
        treatmentType: animalTreatments.treatmentType,
        treatmentDate: animalTreatments.treatmentDate,
        productId: animalTreatments.productId,
        dosage: animalTreatments.dosage,
        category: animalTreatments.category,
      })
      .from(animalTreatments)
      .where(gte(animalTreatments.treatmentDate, startDate.toISOString().split('T')[0]));

    // Get product costs
    const productsList = await db.select().from(products);
    const productMap = new Map(productsList.map(p => [p.id, p]));

    // Calculate costs by category
    const costByCategory: Record<string, { count: number; estimatedCost: number }> = {};
    const costByCondition: Record<string, { count: number; estimatedCost: number }> = {};
    const costByAnimal: Record<string, { count: number; estimatedCost: number }> = {};

    treatments.forEach(t => {
      const product = t.productId ? productMap.get(t.productId) : null;
      const estimatedCost = product?.costPerUnit ? parseFloat(product.costPerUnit) * (parseFloat(t.dosage || '1') || 1) : 0;

      // By category
      const cat = t.category || 'treatment';
      if (!costByCategory[cat]) costByCategory[cat] = { count: 0, estimatedCost: 0 };
      costByCategory[cat].count++;
      costByCategory[cat].estimatedCost += estimatedCost;

      // By condition/treatment type
      const condition = t.treatmentType || 'Unknown';
      if (!costByCondition[condition]) costByCondition[condition] = { count: 0, estimatedCost: 0 };
      costByCondition[condition].count++;
      costByCondition[condition].estimatedCost += estimatedCost;

      // By animal
      if (t.animalId) {
        if (!costByAnimal[t.animalId]) costByAnimal[t.animalId] = { count: 0, estimatedCost: 0 };
        costByAnimal[t.animalId].count++;
        costByAnimal[t.animalId].estimatedCost += estimatedCost;
      }
    });

    // Get top 10 animals by cost
    const topAnimalsByCost = Object.entries(costByAnimal)
      .sort((a, b) => b[1].estimatedCost - a[1].estimatedCost)
      .slice(0, 10)
      .map(([animalId, data]) => ({ animalId, ...data }));

    // Get animal details for top animals
    const animalDetails = await db
      .select({ id: animals.id, cowId: animals.cowId, naitTag: animals.naitTag })
      .from(animals)
      .where(sql`${animals.id} IN (${sql.join(topAnimalsByCost.map(a => sql`${a.animalId}`), sql`, `)})`);
    
    const animalMap = new Map(animalDetails.map(a => [a.id, a]));

    res.json({
      totalTreatments: treatments.length,
      totalEstimatedCost: Object.values(costByCategory).reduce((sum, c) => sum + c.estimatedCost, 0),
      byCategory: Object.entries(costByCategory).map(([category, data]) => ({ category, ...data })),
      byCondition: Object.entries(costByCondition)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 15)
        .map(([condition, data]) => ({ condition, ...data })),
      topAnimalsByCost: topAnimalsByCost.map(a => ({
        ...a,
        animalName: animalMap.get(a.animalId)?.cowId || animalMap.get(a.animalId)?.naitTag || a.animalId.slice(0, 8),
      })),
      periodDays: days,
    });
  } catch (error) {
    console.error("Error fetching treatment costs:", error);
    res.status(500).json({ error: "Failed to fetch treatment costs" });
  }
});

// GET /api/analytics/health/disease-incidence - Disease incidence reports
router.get("/disease-incidence", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 365;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get treatment counts by type
    const incidenceData = await db
      .select({
        treatmentType: animalTreatments.treatmentType,
        count: sql<number>`count(*)::int`,
      })
      .from(animalTreatments)
      .where(gte(animalTreatments.treatmentDate, startDate.toISOString().split('T')[0]))
      .groupBy(animalTreatments.treatmentType)
      .orderBy(desc(sql`count(*)`));

    // Get monthly breakdown for top 5 conditions
    const topConditions = incidenceData.slice(0, 5).map(d => d.treatmentType);
    
    const monthlyData: Record<string, Record<string, number>> = {};
    
    // Get all treatments for monthly breakdown
    const allTreatments = await db
      .select({
        treatmentType: animalTreatments.treatmentType,
        treatmentDate: animalTreatments.treatmentDate,
      })
      .from(animalTreatments)
      .where(and(
        gte(animalTreatments.treatmentDate, startDate.toISOString().split('T')[0]),
        sql`${animalTreatments.treatmentType} IN (${sql.join(topConditions.map(c => sql`${c}`), sql`, `)})`
      ));

    allTreatments.forEach(t => {
      if (!t.treatmentDate || !t.treatmentType) return;
      const month = t.treatmentDate.substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) monthlyData[month] = {};
      if (!monthlyData[month][t.treatmentType]) monthlyData[month][t.treatmentType] = 0;
      monthlyData[month][t.treatmentType]++;
    });

    // Calculate incidence rate per 100 animals
    const [animalCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(animals)
      .where(eq(animals.status, 'active'));

    const totalAnimals = animalCount?.count || 1;

    res.json({
      conditions: incidenceData.map(d => ({
        condition: d.treatmentType || 'Unknown',
        count: d.count,
        incidenceRate: ((d.count / totalAnimals) * 100).toFixed(2),
      })),
      monthlyTrends: Object.entries(monthlyData)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, conditions]) => ({ month, ...conditions })),
      totalAnimals,
      periodDays: days,
    });
  } catch (error) {
    console.error("Error fetching disease incidence:", error);
    res.status(500).json({ error: "Failed to fetch disease incidence" });
  }
});

// GET /api/analytics/health/antibiotic-usage - Antibiotic usage reports (AMR compliance)
router.get("/antibiotic-usage", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 365;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all treatments that are likely antibiotics (based on category or product type)
    const treatments = await db
      .select({
        id: animalTreatments.id,
        animalId: animalTreatments.animalId,
        treatmentType: animalTreatments.treatmentType,
        treatmentDate: animalTreatments.treatmentDate,
        productId: animalTreatments.productId,
        dosage: animalTreatments.dosage,
        route: animalTreatments.route,
      })
      .from(animalTreatments)
      .where(and(
        gte(animalTreatments.treatmentDate, startDate.toISOString().split('T')[0]),
        eq(animalTreatments.category, 'treatment') // Focus on treatments, not vaccinations
      ));

    // Get products to identify antibiotics
    const productsList = await db.select().from(products);
    const productMap = new Map(productsList.map(p => [p.id, p]));

    // Filter for antibiotic-like products (simplified - in production would have proper classification)
    const antibioticKeywords = ['antibiotic', 'penicillin', 'amoxicillin', 'tetracycline', 'oxytetracycline', 
      'ceftiofur', 'enrofloxacin', 'tylosin', 'tilmicosin', 'florfenicol', 'tulathromycin', 'marbofloxacin'];
    
    const antibioticTreatments = treatments.filter(t => {
      if (!t.productId) return false;
      const product = productMap.get(t.productId);
      if (!product) return false;
      const productName = (product.name || '').toLowerCase();
      return antibioticKeywords.some(kw => productName.includes(kw));
    });

    // Calculate usage by route
    const usageByRoute: Record<string, number> = {};
    const usageByMonth: Record<string, number> = {};
    const usageByCondition: Record<string, number> = {};

    antibioticTreatments.forEach(t => {
      // By route
      const route = t.route || 'Unknown';
      usageByRoute[route] = (usageByRoute[route] || 0) + 1;

      // By month
      if (t.treatmentDate) {
        const month = t.treatmentDate.substring(0, 7);
        usageByMonth[month] = (usageByMonth[month] || 0) + 1;
      }

      // By condition
      const condition = t.treatmentType || 'Unknown';
      usageByCondition[condition] = (usageByCondition[condition] || 0) + 1;
    });

    // Get unique animals treated
    const uniqueAnimalsTreated = new Set(antibioticTreatments.map(t => t.animalId)).size;

    // Get total animals for rate calculation
    const [animalCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(animals)
      .where(eq(animals.status, 'active'));

    const totalAnimals = animalCount?.count || 1;

    res.json({
      totalAntibioticTreatments: antibioticTreatments.length,
      uniqueAnimalsTreated,
      treatmentRate: ((uniqueAnimalsTreated / totalAnimals) * 100).toFixed(2),
      byRoute: Object.entries(usageByRoute).map(([route, count]) => ({ route, count })),
      byCondition: Object.entries(usageByCondition)
        .sort((a, b) => b[1] - a[1])
        .map(([condition, count]) => ({ condition, count })),
      monthlyTrend: Object.entries(usageByMonth)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, count]) => ({ month, count })),
      totalAnimals,
      periodDays: days,
    });
  } catch (error) {
    console.error("Error fetching antibiotic usage:", error);
    res.status(500).json({ error: "Failed to fetch antibiotic usage" });
  }
});

// GET /api/analytics/health/seasonal-trends - Seasonal health trends
router.get("/seasonal-trends", async (req: Request, res: Response) => {
  try {
    // Get last 2 years of data for year-over-year comparison
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 2);

    const treatments = await db
      .select({
        treatmentType: animalTreatments.treatmentType,
        treatmentDate: animalTreatments.treatmentDate,
      })
      .from(animalTreatments)
      .where(gte(animalTreatments.treatmentDate, startDate.toISOString().split('T')[0]));

    // Group by month and year
    const monthlyData: Record<string, Record<string, number>> = {};
    const yearlyData: Record<string, number> = {};
    const seasonalData: Record<string, number> = { spring: 0, summer: 0, autumn: 0, winter: 0 };

    treatments.forEach(t => {
      if (!t.treatmentDate) return;
      
      const date = new Date(t.treatmentDate);
      const year = date.getFullYear().toString();
      const month = date.getMonth(); // 0-11
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

      // Monthly
      if (!monthlyData[monthKey]) monthlyData[monthKey] = { total: 0 };
      monthlyData[monthKey].total++;
      if (t.treatmentType) {
        monthlyData[monthKey][t.treatmentType] = (monthlyData[monthKey][t.treatmentType] || 0) + 1;
      }

      // Yearly
      yearlyData[year] = (yearlyData[year] || 0) + 1;

      // Seasonal (Southern Hemisphere)
      if (month >= 8 && month <= 10) seasonalData.spring++;
      else if (month >= 11 || month <= 1) seasonalData.summer++;
      else if (month >= 2 && month <= 4) seasonalData.autumn++;
      else seasonalData.winter++;
    });

    // Calculate year-over-year change
    const years = Object.keys(yearlyData).sort();
    const yoyChange = years.length >= 2 
      ? ((yearlyData[years[years.length - 1]] - yearlyData[years[years.length - 2]]) / yearlyData[years[years.length - 2]] * 100).toFixed(1)
      : null;

    res.json({
      monthlyTrends: Object.entries(monthlyData)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, data]) => ({ month, ...data })),
      yearlyTotals: Object.entries(yearlyData).map(([year, count]) => ({ year, count })),
      seasonalDistribution: Object.entries(seasonalData).map(([season, count]) => ({ season, count })),
      yearOverYearChange: yoyChange,
      peakSeason: Object.entries(seasonalData).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown',
    });
  } catch (error) {
    console.error("Error fetching seasonal trends:", error);
    res.status(500).json({ error: "Failed to fetch seasonal trends" });
  }
});

// GET /api/analytics/health/benchmarks - Industry benchmarking
router.get("/benchmarks", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 365;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get farm metrics
    const [animalCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(animals)
      .where(eq(animals.status, 'active'));

    const [treatmentCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(animalTreatments)
      .where(gte(animalTreatments.treatmentDate, startDate.toISOString().split('T')[0]));

    const [mortalityCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(mortalityRecords)
      .where(gte(mortalityRecords.deathDate, startDate));

    const totalAnimals = animalCount?.count || 1;
    const treatmentsPerAnimal = (treatmentCount?.count || 0) / totalAnimals;
    const mortalityRate = ((mortalityCount?.count || 0) / totalAnimals) * 100;

    // Industry benchmarks (typical NZ dairy values - would be configurable in production)
    const benchmarks = {
      treatmentsPerAnimal: { industry: 2.5, label: 'Treatments per Animal' },
      mortalityRate: { industry: 3.0, label: 'Mortality Rate (%)' },
      lamenessPrevalence: { industry: 15.0, label: 'Lameness Prevalence (%)' },
      mastitisIncidence: { industry: 25.0, label: 'Mastitis Incidence (%)' },
      calvingDifficulty: { industry: 5.0, label: 'Calving Difficulty (%)' },
    };

    // Get lameness data
    const lamenessScores = await db
      .select({ score: healthScores.lamenessScore })
      .from(healthScores)
      .where(gte(healthScores.recordedAt, startDate));

    const lameAnimals = lamenessScores.filter(s => s.score && parseInt(s.score) >= 2).length;
    const lamenessPrevalence = lamenessScores.length > 0 ? (lameAnimals / lamenessScores.length) * 100 : 0;

    // Get mastitis incidence (treatments with mastitis-related types)
    const mastitisTreatments = await db
      .select({ count: sql<number>`count(distinct ${animalTreatments.animalId})::int` })
      .from(animalTreatments)
      .where(and(
        gte(animalTreatments.treatmentDate, startDate.toISOString().split('T')[0]),
        sql`lower(${animalTreatments.treatmentType}) LIKE '%mastitis%'`
      ));

    const mastitisIncidence = ((mastitisTreatments[0]?.count || 0) / totalAnimals) * 100;

    res.json({
      farmMetrics: {
        treatmentsPerAnimal: parseFloat(treatmentsPerAnimal.toFixed(2)),
        mortalityRate: parseFloat(mortalityRate.toFixed(2)),
        lamenessPrevalence: parseFloat(lamenessPrevalence.toFixed(2)),
        mastitisIncidence: parseFloat(mastitisIncidence.toFixed(2)),
      },
      industryBenchmarks: benchmarks,
      comparison: {
        treatmentsPerAnimal: {
          value: treatmentsPerAnimal,
          benchmark: benchmarks.treatmentsPerAnimal.industry,
          status: treatmentsPerAnimal <= benchmarks.treatmentsPerAnimal.industry ? 'good' : 'attention',
        },
        mortalityRate: {
          value: mortalityRate,
          benchmark: benchmarks.mortalityRate.industry,
          status: mortalityRate <= benchmarks.mortalityRate.industry ? 'good' : 'attention',
        },
        lamenessPrevalence: {
          value: lamenessPrevalence,
          benchmark: benchmarks.lamenessPrevalence.industry,
          status: lamenessPrevalence <= benchmarks.lamenessPrevalence.industry ? 'good' : 'attention',
        },
        mastitisIncidence: {
          value: mastitisIncidence,
          benchmark: benchmarks.mastitisIncidence.industry,
          status: mastitisIncidence <= benchmarks.mastitisIncidence.industry ? 'good' : 'attention',
        },
      },
      totalAnimals,
      periodDays: days,
    });
  } catch (error) {
    console.error("Error fetching benchmarks:", error);
    res.status(500).json({ error: "Failed to fetch benchmarks" });
  }
});

export default router;
