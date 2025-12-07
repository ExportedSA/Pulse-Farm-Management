// Herd Reports & Analytics API Routes
import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { 
  animals, weightRecords, mortalityRecords, animalTreatments,
  reproductionEvents, stockTransactions, milkProduction
} from "@shared/schema";
import { eq, and, gte, lte, sql, desc, count, isNull } from "drizzle-orm";
import { format, subMonths, differenceInMonths, differenceInYears, startOfMonth, endOfMonth, subDays } from "date-fns";

const router = Router();

// ===== HERD COMPOSITION REPORT =====

// GET /api/reports/herd/composition - Complete herd composition breakdown
router.get("/herd/composition", async (req: Request, res: Response) => {
  try {
    // Get all animals
    const allAnimals = await db
      .select()
      .from(animals)
      .where(isNull(animals.deletedAt));

    const today = new Date();
    
    // Calculate composition
    const composition = {
      total: allAnimals.length,
      byStatus: {} as Record<string, number>,
      bySex: {} as Record<string, number>,
      byBreed: {} as Record<string, number>,
      byHerd: {} as Record<string, number>,
      byAgeGroup: {
        calves: 0,      // 0-6 months
        weaners: 0,     // 6-12 months
        yearlings: 0,   // 12-24 months
        heifers: 0,     // 24+ months, female, not calved
        cows: 0,        // 24+ months, female
        bulls: 0,       // 24+ months, male
        steers: 0,      // castrated males
      } as Record<string, number>,
      active: 0,
      sold: 0,
      deceased: 0,
    };

    for (const animal of allAnimals) {
      // By status
      composition.byStatus[animal.status] = (composition.byStatus[animal.status] || 0) + 1;
      
      if (animal.status === 'active') composition.active++;
      else if (animal.status === 'sold') composition.sold++;
      else if (animal.status === 'deceased') composition.deceased++;
      
      // By sex
      if (animal.sex) {
        composition.bySex[animal.sex] = (composition.bySex[animal.sex] || 0) + 1;
      }
      
      // By breed
      if (animal.breed) {
        composition.byBreed[animal.breed] = (composition.byBreed[animal.breed] || 0) + 1;
      }
      
      // By herd
      if (animal.herd) {
        composition.byHerd[animal.herd] = (composition.byHerd[animal.herd] || 0) + 1;
      }
      
      // By age group (only for active animals)
      if (animal.status === 'active' && animal.dateOfBirth) {
        const birthDate = new Date(animal.dateOfBirth);
        const ageMonths = differenceInMonths(today, birthDate);
        
        if (ageMonths < 6) {
          composition.byAgeGroup.calves++;
        } else if (ageMonths < 12) {
          composition.byAgeGroup.weaners++;
        } else if (ageMonths < 24) {
          composition.byAgeGroup.yearlings++;
        } else {
          if (animal.sex === 'female') {
            composition.byAgeGroup.cows++;
          } else if (animal.sex === 'male') {
            composition.byAgeGroup.bulls++;
          }
        }
      }
    }

    res.json(composition);
  } catch (error) {
    console.error("Error fetching herd composition:", error);
    res.status(500).json({ error: "Failed to fetch herd composition" });
  }
});

// ===== AGE DISTRIBUTION =====

// GET /api/reports/herd/age-distribution - Age distribution chart data
router.get("/herd/age-distribution", async (req: Request, res: Response) => {
  try {
    const activeAnimals = await db
      .select()
      .from(animals)
      .where(and(
        eq(animals.status, 'active'),
        sql`${animals.dateOfBirth} IS NOT NULL`
      ));

    const today = new Date();
    
    // Create age buckets
    const ageBuckets = [
      { label: '0-3 months', min: 0, max: 3, count: 0, animals: [] as any[] },
      { label: '3-6 months', min: 3, max: 6, count: 0, animals: [] as any[] },
      { label: '6-12 months', min: 6, max: 12, count: 0, animals: [] as any[] },
      { label: '1-2 years', min: 12, max: 24, count: 0, animals: [] as any[] },
      { label: '2-3 years', min: 24, max: 36, count: 0, animals: [] as any[] },
      { label: '3-5 years', min: 36, max: 60, count: 0, animals: [] as any[] },
      { label: '5-7 years', min: 60, max: 84, count: 0, animals: [] as any[] },
      { label: '7+ years', min: 84, max: Infinity, count: 0, animals: [] as any[] },
    ];

    // Detailed age stats
    const ageStats = {
      averageAgeMonths: 0,
      medianAgeMonths: 0,
      oldestAnimal: null as any,
      youngestAnimal: null as any,
      totalWithDOB: 0,
    };

    const ages: number[] = [];

    for (const animal of activeAnimals) {
      if (!animal.dateOfBirth) continue;
      
      const birthDate = new Date(animal.dateOfBirth);
      const ageMonths = differenceInMonths(today, birthDate);
      ages.push(ageMonths);
      
      // Find bucket
      for (const bucket of ageBuckets) {
        if (ageMonths >= bucket.min && ageMonths < bucket.max) {
          bucket.count++;
          bucket.animals.push({
            id: animal.id,
            cowId: animal.cowId,
            ageMonths,
          });
          break;
        }
      }
      
      // Track oldest/youngest
      if (!ageStats.oldestAnimal || ageMonths > ageStats.oldestAnimal.ageMonths) {
        ageStats.oldestAnimal = { ...animal, ageMonths };
      }
      if (!ageStats.youngestAnimal || ageMonths < ageStats.youngestAnimal.ageMonths) {
        ageStats.youngestAnimal = { ...animal, ageMonths };
      }
    }

    // Calculate stats
    if (ages.length > 0) {
      ageStats.averageAgeMonths = Math.round(ages.reduce((a, b) => a + b, 0) / ages.length);
      ages.sort((a, b) => a - b);
      ageStats.medianAgeMonths = ages[Math.floor(ages.length / 2)];
      ageStats.totalWithDOB = ages.length;
    }

    // Remove animal details from buckets for chart (keep count only)
    const chartData = ageBuckets.map(b => ({
      label: b.label,
      count: b.count,
      percentage: activeAnimals.length > 0 ? Math.round((b.count / activeAnimals.length) * 100) : 0,
    }));

    res.json({
      chartData,
      stats: ageStats,
      totalAnimals: activeAnimals.length,
    });
  } catch (error) {
    console.error("Error fetching age distribution:", error);
    res.status(500).json({ error: "Failed to fetch age distribution" });
  }
});

// ===== MORTALITY TRACKING =====

// GET /api/reports/mortality - Mortality rate and analysis
router.get("/mortality", async (req: Request, res: Response) => {
  try {
    const months = parseInt(req.query.months as string) || 12;
    const startDate = subMonths(new Date(), months);

    // Get mortality records
    const mortalities = await db
      .select()
      .from(mortalityRecords)
      .where(gte(mortalityRecords.deathDate, startDate))
      .orderBy(desc(mortalityRecords.deathDate));

    // Get deceased animals
    const deceasedAnimals = await db
      .select()
      .from(animals)
      .where(eq(animals.status, 'deceased'));

    // Get total herd size for rate calculation
    const [totalCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(animals)
      .where(isNull(animals.deletedAt));

    // Group by cause
    const byCause: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    const byBreed: Record<string, number> = {};
    const byAgeGroup: Record<string, number> = {};

    for (const record of mortalities) {
      // By cause
      const cause = record.causeOfDeath || 'Unknown';
      byCause[cause] = (byCause[cause] || 0) + 1;
      
      // By month
      const monthKey = format(new Date(record.deathDate), 'yyyy-MM');
      byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
    }

    // Analyze deceased animals
    for (const animal of deceasedAnimals) {
      if (animal.breed) {
        byBreed[animal.breed] = (byBreed[animal.breed] || 0) + 1;
      }
      
      if (animal.dateOfBirth) {
        const ageMonths = differenceInMonths(new Date(), new Date(animal.dateOfBirth));
        let ageGroup = 'Adult';
        if (ageMonths < 6) ageGroup = 'Calf';
        else if (ageMonths < 12) ageGroup = 'Weaner';
        else if (ageMonths < 24) ageGroup = 'Yearling';
        byAgeGroup[ageGroup] = (byAgeGroup[ageGroup] || 0) + 1;
      }
    }

    // Calculate rates
    const totalHerd = totalCount?.count || 1;
    const mortalityRate = ((mortalities.length / totalHerd) * 100).toFixed(2);
    const annualizedRate = ((mortalities.length / months) * 12 / totalHerd * 100).toFixed(2);

    res.json({
      summary: {
        totalDeaths: mortalities.length,
        periodMonths: months,
        mortalityRate: parseFloat(mortalityRate),
        annualizedRate: parseFloat(annualizedRate),
        totalHerdSize: totalHerd,
      },
      byCause,
      byMonth,
      byBreed,
      byAgeGroup,
      recentDeaths: mortalities.slice(0, 10).map(m => ({
        id: m.id,
        animalId: m.animalId,
        deathDate: m.deathDate,
        causeOfDeath: m.causeOfDeath,
        notes: m.notes,
      })),
    });
  } catch (error) {
    console.error("Error fetching mortality report:", error);
    res.status(500).json({ error: "Failed to fetch mortality report" });
  }
});

// ===== BREED PERFORMANCE COMPARISON =====

// GET /api/reports/breed-performance - Compare breeds
router.get("/breed-performance", async (req: Request, res: Response) => {
  try {
    // Get all active animals with breed
    const activeAnimals = await db
      .select()
      .from(animals)
      .where(and(
        eq(animals.status, 'active'),
        sql`${animals.breed} IS NOT NULL`
      ));

    // Get weight records
    const weights = await db
      .select()
      .from(weightRecords)
      .orderBy(desc(weightRecords.date));

    // Get reproduction events
    const reproEvents = await db
      .select()
      .from(reproductionEvents);

    // Get treatments
    const treatments = await db
      .select()
      .from(animalTreatments);

    // Build animal lookup
    const animalMap = new Map(activeAnimals.map(a => [a.id, a]));
    
    // Aggregate by breed
    const breedStats: Record<string, {
      count: number;
      avgWeight: number;
      weightCount: number;
      totalWeight: number;
      avgBcs: number;
      bcsCount: number;
      totalBcs: number;
      treatmentCount: number;
      reproEventCount: number;
      calvingCount: number;
    }> = {};

    // Initialize breeds
    for (const animal of activeAnimals) {
      if (!animal.breed) continue;
      if (!breedStats[animal.breed]) {
        breedStats[animal.breed] = {
          count: 0,
          avgWeight: 0,
          weightCount: 0,
          totalWeight: 0,
          avgBcs: 0,
          bcsCount: 0,
          totalBcs: 0,
          treatmentCount: 0,
          reproEventCount: 0,
          calvingCount: 0,
        };
      }
      breedStats[animal.breed].count++;
      
      if (animal.bodyConditionScore) {
        breedStats[animal.breed].totalBcs += animal.bodyConditionScore;
        breedStats[animal.breed].bcsCount++;
      }
    }

    // Add weight data
    for (const weight of weights) {
      const animal = animalMap.get(weight.animalId);
      if (animal?.breed && breedStats[animal.breed]) {
        breedStats[animal.breed].totalWeight += parseFloat(weight.weight);
        breedStats[animal.breed].weightCount++;
      }
    }

    // Add treatment data
    for (const treatment of treatments) {
      const animal = animalMap.get(treatment.animalId);
      if (animal?.breed && breedStats[animal.breed]) {
        breedStats[animal.breed].treatmentCount++;
      }
    }

    // Add reproduction data
    for (const event of reproEvents) {
      const animal = animalMap.get(event.animalId);
      if (animal?.breed && breedStats[animal.breed]) {
        breedStats[animal.breed].reproEventCount++;
        if (event.eventType === 'calving') {
          breedStats[animal.breed].calvingCount++;
        }
      }
    }

    // Calculate averages
    const breedComparison = Object.entries(breedStats).map(([breed, stats]) => ({
      breed,
      count: stats.count,
      avgWeight: stats.weightCount > 0 ? Math.round(stats.totalWeight / stats.weightCount) : null,
      avgBcs: stats.bcsCount > 0 ? (stats.totalBcs / stats.bcsCount).toFixed(1) : null,
      treatmentsPerAnimal: stats.count > 0 ? (stats.treatmentCount / stats.count).toFixed(2) : 0,
      calvingsPerCow: stats.count > 0 ? (stats.calvingCount / stats.count).toFixed(2) : 0,
    }));

    // Sort by count
    breedComparison.sort((a, b) => b.count - a.count);

    res.json({
      breeds: breedComparison,
      totalBreeds: breedComparison.length,
      totalAnimals: activeAnimals.length,
    });
  } catch (error) {
    console.error("Error fetching breed performance:", error);
    res.status(500).json({ error: "Failed to fetch breed performance" });
  }
});

// ===== FINANCIAL/ACCOUNTANT EXPORT =====

// GET /api/reports/financial/summary - Financial summary for accountant
router.get("/financial/summary", async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    // Get stock transactions
    const transactions = await db
      .select()
      .from(stockTransactions)
      .where(and(
        gte(stockTransactions.date, format(startDate, 'yyyy-MM-dd')),
        lte(stockTransactions.date, format(endDate, 'yyyy-MM-dd'))
      ));

    // Calculate totals
    const summary = {
      year,
      livestock: {
        openingStock: 0,
        purchases: { count: 0, value: 0 },
        sales: { count: 0, value: 0 },
        births: { count: 0 },
        deaths: { count: 0 },
        closingStock: 0,
      },
      byMonth: [] as any[],
    };

    // Process transactions
    for (const tx of transactions) {
      const qty = tx.quantity || 0;
      const value = tx.totalValue || 0;
      
      switch (tx.type) {
        case 'purchase':
          summary.livestock.purchases.count += qty;
          summary.livestock.purchases.value += value;
          break;
        case 'sale':
          summary.livestock.sales.count += qty;
          summary.livestock.sales.value += value;
          break;
        case 'birth':
          summary.livestock.births.count += qty;
          break;
        case 'death':
          summary.livestock.deaths.count += qty;
          break;
      }
    }

    // Get current stock count
    const [currentStock] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(animals)
      .where(eq(animals.status, 'active'));
    
    summary.livestock.closingStock = currentStock?.count || 0;
    
    // Calculate opening stock
    summary.livestock.openingStock = 
      summary.livestock.closingStock 
      - summary.livestock.purchases.count 
      - summary.livestock.births.count 
      + summary.livestock.sales.count 
      + summary.livestock.deaths.count;

    // Monthly breakdown
    for (let month = 0; month < 12; month++) {
      const monthStart = format(new Date(year, month, 1), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(new Date(year, month, 1)), 'yyyy-MM-dd');
      
      const monthTx = transactions.filter(tx => 
        tx.date >= monthStart && tx.date <= monthEnd
      );
      
      const monthData = {
        month: format(new Date(year, month, 1), 'MMM'),
        purchases: 0,
        sales: 0,
        purchaseValue: 0,
        saleValue: 0,
      };
      
      for (const tx of monthTx) {
        if (tx.type === 'purchase') {
          monthData.purchases += tx.quantity || 0;
          monthData.purchaseValue += tx.totalValue || 0;
        } else if (tx.type === 'sale') {
          monthData.sales += tx.quantity || 0;
          monthData.saleValue += tx.totalValue || 0;
        }
      }
      
      summary.byMonth.push(monthData);
    }

    res.json(summary);
  } catch (error) {
    console.error("Error fetching financial summary:", error);
    res.status(500).json({ error: "Failed to fetch financial summary" });
  }
});

// GET /api/reports/export/csv - Export data as CSV
router.get("/export/csv", async (req: Request, res: Response) => {
  try {
    const reportType = req.query.type as string || 'herd';
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    
    let csvContent = '';
    let filename = '';
    
    switch (reportType) {
      case 'herd': {
        // Export herd list
        const allAnimals = await db
          .select()
          .from(animals)
          .where(isNull(animals.deletedAt));
        
        csvContent = 'ID,NAIT Tag,EID,Visual ID,Breed,Sex,Date of Birth,Status,Herd,Body Condition Score\n';
        for (const a of allAnimals) {
          csvContent += `"${a.id}","${a.naitTag || ''}","${a.eid || ''}","${a.cowId || ''}","${a.breed || ''}","${a.sex || ''}","${a.dateOfBirth || ''}","${a.status}","${a.herd || ''}","${a.bodyConditionScore || ''}"\n`;
        }
        filename = `herd_list_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        break;
      }
      
      case 'transactions': {
        // Export stock transactions
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31);
        
        const transactions = await db
          .select()
          .from(stockTransactions)
          .where(and(
            gte(stockTransactions.date, format(startDate, 'yyyy-MM-dd')),
            lte(stockTransactions.date, format(endDate, 'yyyy-MM-dd'))
          ))
          .orderBy(stockTransactions.date);
        
        csvContent = 'Date,Type,Quantity,Description,Reference,Price Per Head,Total Value,Buyer/Seller,Notes\n';
        for (const tx of transactions) {
          csvContent += `"${tx.date}","${tx.type}","${tx.quantity}","${tx.description || ''}","${tx.reference || ''}","${tx.pricePerHead || ''}","${tx.totalValue || ''}","${tx.buyer || tx.seller || ''}","${tx.notes || ''}"\n`;
        }
        filename = `stock_transactions_${year}.csv`;
        break;
      }
      
      case 'mortality': {
        // Export mortality records
        const mortalities = await db
          .select()
          .from(mortalityRecords)
          .orderBy(desc(mortalityRecords.deathDate));
        
        csvContent = 'Animal ID,Death Date,Cause of Death,Location,Vet Attended,Necropsy Done,Notes\n';
        for (const m of mortalities) {
          csvContent += `"${m.animalId}","${m.deathDate}","${m.causeOfDeath || ''}","${m.location || ''}","${m.vetAttended ? 'Yes' : 'No'}","${m.necropsyDone ? 'Yes' : 'No'}","${m.notes || ''}"\n`;
        }
        filename = `mortality_records_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        break;
      }
      
      case 'weights': {
        // Export weight records
        const weights = await db
          .select({
            animalId: weightRecords.animalId,
            date: weightRecords.date,
            weight: weightRecords.weight,
            bcs: weightRecords.bodyConditionScore,
            notes: weightRecords.notes,
            cowId: animals.cowId,
            naitTag: animals.naitTag,
          })
          .from(weightRecords)
          .leftJoin(animals, eq(weightRecords.animalId, animals.id))
          .orderBy(desc(weightRecords.date));
        
        csvContent = 'Date,Animal ID,Visual ID,NAIT Tag,Weight (kg),Body Condition Score,Notes\n';
        for (const w of weights) {
          csvContent += `"${w.date}","${w.animalId}","${w.cowId || ''}","${w.naitTag || ''}","${w.weight}","${w.bcs || ''}","${w.notes || ''}"\n`;
        }
        filename = `weight_records_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        break;
      }
      
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error("Error exporting CSV:", error);
    res.status(500).json({ error: "Failed to export CSV" });
  }
});

// GET /api/reports/export/accountant - Comprehensive accountant report
router.get("/export/accountant", async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const formatType = req.query.format as string || 'json';
    
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    // Gather all data
    const [
      allAnimals,
      transactions,
      mortalities,
    ] = await Promise.all([
      db.select().from(animals).where(isNull(animals.deletedAt)),
      db.select().from(stockTransactions).where(and(
        gte(stockTransactions.date, format(startDate, 'yyyy-MM-dd')),
        lte(stockTransactions.date, format(endDate, 'yyyy-MM-dd'))
      )),
      db.select().from(mortalityRecords).where(and(
        gte(mortalityRecords.deathDate, startDate),
        lte(mortalityRecords.deathDate, endDate)
      )),
    ]);

    // Calculate summary
    const activeCount = allAnimals.filter(a => a.status === 'active').length;
    const soldCount = allAnimals.filter(a => a.status === 'sold').length;
    const deceasedCount = allAnimals.filter(a => a.status === 'deceased').length;

    const purchaseTx = transactions.filter(t => t.type === 'purchase');
    const saleTx = transactions.filter(t => t.type === 'sale');

    const totalPurchases = purchaseTx.reduce((sum, t) => sum + (t.totalValue || 0), 0);
    const totalSales = saleTx.reduce((sum, t) => sum + (t.totalValue || 0), 0);
    const purchaseCount = purchaseTx.reduce((sum, t) => sum + (t.quantity || 0), 0);
    const saleCount = saleTx.reduce((sum, t) => sum + (t.quantity || 0), 0);

    const report = {
      reportTitle: `Livestock Financial Report - ${year}`,
      generatedAt: new Date().toISOString(),
      period: { start: format(startDate, 'yyyy-MM-dd'), end: format(endDate, 'yyyy-MM-dd') },
      
      stockSummary: {
        currentActive: activeCount,
        totalSold: soldCount,
        totalDeceased: deceasedCount,
        totalOnRecord: allAnimals.length,
      },
      
      financialSummary: {
        totalPurchases: {
          count: purchaseCount,
          value: totalPurchases,
          valueFormatted: `$${(totalPurchases / 100).toFixed(2)}`,
        },
        totalSales: {
          count: saleCount,
          value: totalSales,
          valueFormatted: `$${(totalSales / 100).toFixed(2)}`,
        },
        netPosition: {
          value: totalSales - totalPurchases,
          valueFormatted: `$${((totalSales - totalPurchases) / 100).toFixed(2)}`,
        },
      },
      
      mortalitySummary: {
        totalDeaths: mortalities.length,
        byCause: mortalities.reduce((acc, m) => {
          const cause = m.causeOfDeath || 'Unknown';
          acc[cause] = (acc[cause] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
      
      breedBreakdown: allAnimals.reduce((acc, a) => {
        if (a.breed && a.status === 'active') {
          acc[a.breed] = (acc[a.breed] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>),
      
      transactions: transactions.map(t => ({
        date: t.date,
        type: t.type,
        quantity: t.quantity,
        value: t.totalValue,
        reference: t.reference,
        description: t.description,
      })),
    };

    if (formatType === 'csv') {
      // Generate CSV format
      let csv = 'LIVESTOCK FINANCIAL REPORT\n';
      csv += `Year,${year}\n`;
      csv += `Generated,${format(new Date(), 'yyyy-MM-dd HH:mm')}\n\n`;
      
      csv += 'STOCK SUMMARY\n';
      csv += `Current Active,${activeCount}\n`;
      csv += `Total Sold,${soldCount}\n`;
      csv += `Total Deceased,${deceasedCount}\n\n`;
      
      csv += 'FINANCIAL SUMMARY\n';
      csv += `Total Purchases,${purchaseCount} head,$${(totalPurchases / 100).toFixed(2)}\n`;
      csv += `Total Sales,${saleCount} head,$${(totalSales / 100).toFixed(2)}\n`;
      csv += `Net Position,,$${((totalSales - totalPurchases) / 100).toFixed(2)}\n\n`;
      
      csv += 'TRANSACTIONS\n';
      csv += 'Date,Type,Quantity,Value,Reference,Description\n';
      for (const t of transactions) {
        csv += `${t.date},${t.type},${t.quantity},$${((t.totalValue || 0) / 100).toFixed(2)},${t.reference || ''},${t.description || ''}\n`;
      }
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="livestock_report_${year}.csv"`);
      res.send(csv);
    } else {
      res.json(report);
    }
  } catch (error) {
    console.error("Error generating accountant report:", error);
    res.status(500).json({ error: "Failed to generate accountant report" });
  }
});

// GET /api/reports/trends - Historical trends
router.get("/trends", async (req: Request, res: Response) => {
  try {
    const months = parseInt(req.query.months as string) || 12;
    const today = new Date();
    
    const trends = {
      herdSize: [] as any[],
      weights: [] as any[],
      treatments: [] as any[],
      mortality: [] as any[],
    };

    // Generate monthly data points
    for (let i = months - 1; i >= 0; i--) {
      const monthDate = subMonths(today, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthLabel = format(monthDate, 'MMM yyyy');

      // This is a simplified approach - in production you'd want historical snapshots
      trends.herdSize.push({
        month: monthLabel,
        // Placeholder - would need historical data
      });
    }

    // Get actual weight trends
    const weightData = await db
      .select({
        month: sql<string>`to_char(${weightRecords.date}::date, 'YYYY-MM')`,
        avgWeight: sql<number>`avg(${weightRecords.weight}::numeric)::numeric(8,2)`,
        count: sql<number>`count(*)::int`,
      })
      .from(weightRecords)
      .where(gte(weightRecords.date, format(subMonths(today, months), 'yyyy-MM-dd')))
      .groupBy(sql`to_char(${weightRecords.date}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${weightRecords.date}::date, 'YYYY-MM')`);

    trends.weights = weightData.map(w => ({
      month: w.month,
      avgWeight: parseFloat(String(w.avgWeight)),
      recordCount: w.count,
    }));

    // Get treatment trends
    const treatmentData = await db
      .select({
        month: sql<string>`to_char(${animalTreatments.treatmentDate}::date, 'YYYY-MM')`,
        count: sql<number>`count(*)::int`,
      })
      .from(animalTreatments)
      .where(gte(animalTreatments.treatmentDate, format(subMonths(today, months), 'yyyy-MM-dd')))
      .groupBy(sql`to_char(${animalTreatments.treatmentDate}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${animalTreatments.treatmentDate}::date, 'YYYY-MM')`);

    trends.treatments = treatmentData;

    res.json(trends);
  } catch (error) {
    console.error("Error fetching trends:", error);
    res.status(500).json({ error: "Failed to fetch trends" });
  }
});

export default router;
