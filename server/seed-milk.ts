import { storage } from './storage';
import { InsertMilkRecord } from '@shared/schema';

const milkRecords: InsertMilkRecord[] = [
  {
    date: '2024-12-01',
    totalVolume: '2450.5',
    averageFat: '4.2',
    averageProtein: '3.4',
    averageSomaticCellCount: '180000',
    milkPrice: '0.85',
    totalValue: '2082.93',
    milkingTime: 'combined',
    temperature: '4.2',
    notes: 'Good production, slightly higher fat content',
  },
  {
    date: '2024-12-02',
    totalVolume: '2380.0',
    averageFat: '4.0',
    averageProtein: '3.3',
    averageSomaticCellCount: '195000',
    milkPrice: '0.85',
    totalValue: '2023.00',
    milkingTime: 'combined',
    temperature: '4.5',
    notes: 'Normal production',
  },
  {
    date: '2024-12-03',
    totalVolume: '2520.8',
    averageFat: '4.3',
    averageProtein: '3.5',
    averageSomaticCellCount: '165000',
    milkPrice: '0.85',
    totalValue: '2142.68',
    milkingTime: 'combined',
    temperature: '4.0',
    notes: 'Excellent production with good quality',
  },
  {
    date: '2024-12-04',
    totalVolume: '2295.3',
    averageFat: '3.8',
    averageProtein: '3.1',
    averageSomaticCellCount: '420000',
    milkPrice: '0.85',
    totalValue: '1951.01',
    milkingTime: 'combined',
    temperature: '5.8',
    notes: 'Lower quality - high SCC, elevated temperature',
  },
  {
    date: '2024-12-05',
    totalVolume: '2415.7',
    averageFat: '4.1',
    averageProtein: '3.4',
    averageSomaticCellCount: '210000',
    milkPrice: '0.85',
    totalValue: '2053.35',
    milkingTime: 'combined',
    temperature: '4.3',
    notes: 'Recovering from yesterday, quality improving',
  },
  {
    date: '2024-12-06',
    totalVolume: '2485.2',
    averageFat: '4.2',
    averageProtein: '3.5',
    averageSomaticCellCount: '175000',
    milkPrice: '0.85',
    totalValue: '2112.42',
    milkingTime: 'combined',
    temperature: '4.1',
    notes: 'Back to normal quality levels',
  },
  {
    date: '2024-12-07',
    totalVolume: '2560.0',
    averageFat: '4.4',
    averageProtein: '3.6',
    averageSomaticCellCount: '155000',
    milkPrice: '0.85',
    totalValue: '2176.00',
    milkingTime: 'combined',
    temperature: '3.9',
    notes: 'Best production this week',
  },
  {
    date: '2024-12-08',
    totalVolume: '2340.5',
    averageFat: '3.9',
    averageProtein: '3.2',
    averageSomaticCellCount: '280000',
    milkPrice: '0.85',
    totalValue: '1989.43',
    milkingTime: 'combined',
    temperature: '4.8',
    notes: 'Slightly elevated SCC, monitor closely',
  },
];

async function seedMilkProduction() {
  console.log('🥛 Seeding milk production data...');
  
  try {
    for (const record of milkRecords) {
      await storage.createMilkRecord(record);
      console.log(`✓ Created milk record for ${record.date}: ${record.totalVolume}L`);
    }
    
    console.log(`✅ Milk production data seeded successfully! (${milkRecords.length} records)`);
  } catch (error) {
    console.error('❌ Error seeding milk production data:', error);
  }
}

// Run if called directly
if (require.main === module) {
  seedMilkProduction();
}

export { seedMilkProduction };
