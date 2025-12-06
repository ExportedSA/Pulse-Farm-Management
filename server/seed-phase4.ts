/**
 * Seed script for Phase 3 & 4 features
 * Run with: npx tsx server/seed-phase4.ts
 */

import { db } from './db';
import { taskPins, expenses, killsheets } from '@shared/schema';

async function seed() {
  console.log('🌱 Seeding Phase 3 & 4 data...');

  // Seed Task Pins
  console.log('📍 Creating task pins...');
  const taskPinData = [
    {
      title: 'Fix broken fence - North paddock',
      description: 'Wire broken near gate, cattle escaping',
      latitude: '-37.7870',
      longitude: '175.2793',
      status: 'pending' as const,
      priority: 'high' as const,
      category: 'fence_repair',
      dueDate: '2024-12-10',
    },
    {
      title: 'Check water trough - East pasture',
      description: 'Reported low water flow, may need cleaning',
      latitude: '-37.7865',
      longitude: '175.2810',
      status: 'in_progress' as const,
      priority: 'medium' as const,
      category: 'water_issue',
      dueDate: '2024-12-08',
    },
    {
      title: 'Inspect sick animal - Paddock 3',
      description: 'Cow #247 showing signs of lameness',
      latitude: '-37.7880',
      longitude: '175.2785',
      status: 'pending' as const,
      priority: 'urgent' as const,
      category: 'animal_check',
      dueDate: '2024-12-05',
    },
    {
      title: 'Clear fallen tree - Access road',
      description: 'Storm damage blocking vehicle access',
      latitude: '-37.7855',
      longitude: '175.2800',
      status: 'completed' as const,
      priority: 'high' as const,
      category: 'hazard',
      completedAt: new Date('2024-12-01'),
    },
    {
      title: 'Reseed bare patch - South paddock',
      description: 'Area damaged by heavy traffic',
      latitude: '-37.7890',
      longitude: '175.2775',
      status: 'pending' as const,
      priority: 'low' as const,
      category: 'pasture_maintenance',
      dueDate: '2024-12-20',
    },
  ];

  for (const pin of taskPinData) {
    await db.insert(taskPins).values(pin);
  }
  console.log(`✅ Created ${taskPinData.length} task pins`);

  // Seed Expenses
  console.log('💰 Creating expenses...');
  const expenseData = [
    {
      date: '2024-11-15',
      category: 'feed' as const,
      description: 'Monthly hay delivery - 50 bales',
      amount: '2500.00',
      vendor: 'Rural Supplies NZ',
      invoiceNumber: 'RS-2024-1542',
    },
    {
      date: '2024-11-20',
      category: 'veterinary' as const,
      description: 'Annual vaccinations - 120 cattle',
      amount: '1800.00',
      vendor: 'Hamilton Vet Services',
      invoiceNumber: 'HVS-8821',
    },
    {
      date: '2024-11-22',
      category: 'fuel' as const,
      description: 'Diesel for farm vehicles',
      amount: '850.00',
      vendor: 'Z Energy',
      invoiceNumber: 'Z-441256',
    },
    {
      date: '2024-11-25',
      category: 'maintenance' as const,
      description: 'Tractor service and repairs',
      amount: '1200.00',
      vendor: 'Farm Machinery Ltd',
      invoiceNumber: 'FM-2024-892',
    },
    {
      date: '2024-11-28',
      category: 'supplies' as const,
      description: 'Fencing materials - posts and wire',
      amount: '650.00',
      vendor: 'Farmlands Co-op',
      invoiceNumber: 'FL-78542',
    },
    {
      date: '2024-12-01',
      category: 'utilities' as const,
      description: 'Monthly electricity',
      amount: '420.00',
      vendor: 'Mercury Energy',
    },
    {
      date: '2024-12-02',
      category: 'labor' as const,
      description: 'Casual worker - fencing',
      amount: '560.00',
      vendor: 'John Smith',
    },
    {
      date: '2024-12-03',
      category: 'equipment' as const,
      description: 'New water pump',
      amount: '380.00',
      vendor: 'Plumbing Supplies',
      invoiceNumber: 'PS-12456',
    },
  ];

  for (const expense of expenseData) {
    await db.insert(expenses).values(expense);
  }
  console.log(`✅ Created ${expenseData.length} expenses`);

  // Seed Killsheets
  console.log('📋 Creating killsheets...');
  const killsheetData = [
    {
      date: '2024-10-15',
      processorName: 'AFFCO Horotiu',
      lotNumber: 'LOT-2024-0842',
      animalCount: 25,
      totalLiveWeight: '12500.00',
      totalCarcassWeight: '6875.00',
      averageDressingPercentage: '55.00',
      pricePerKg: '6.80',
      totalValue: '46750.00',
      deductions: '450.00',
      netPayment: '46300.00',
      paymentReceived: true,
      paymentDate: '2024-10-30',
    },
    {
      date: '2024-11-10',
      processorName: 'Silver Fern Farms',
      lotNumber: 'SFF-NZ-4521',
      animalCount: 18,
      totalLiveWeight: '9000.00',
      totalCarcassWeight: '5040.00',
      averageDressingPercentage: '56.00',
      pricePerKg: '7.10',
      totalValue: '35784.00',
      deductions: '320.00',
      netPayment: '35464.00',
      paymentReceived: true,
      paymentDate: '2024-11-25',
    },
    {
      date: '2024-11-28',
      processorName: 'ANZCO Foods',
      lotNumber: 'ANZ-2024-1156',
      animalCount: 30,
      totalLiveWeight: '15600.00',
      totalCarcassWeight: '8580.00',
      averageDressingPercentage: '55.00',
      pricePerKg: '6.95',
      totalValue: '59631.00',
      deductions: '580.00',
      netPayment: '59051.00',
      paymentReceived: false,
    },
    {
      date: '2024-12-02',
      processorName: 'AFFCO Horotiu',
      lotNumber: 'LOT-2024-0901',
      animalCount: 22,
      totalLiveWeight: '11000.00',
      totalCarcassWeight: '6050.00',
      averageDressingPercentage: '55.00',
      pricePerKg: '7.00',
      totalValue: '42350.00',
      deductions: '400.00',
      netPayment: '41950.00',
      paymentReceived: false,
    },
  ];

  for (const killsheet of killsheetData) {
    await db.insert(killsheets).values(killsheet);
  }
  console.log(`✅ Created ${killsheetData.length} killsheets`);

  console.log('\n🎉 Phase 3 & 4 seed data complete!');
  console.log('Summary:');
  console.log(`  - Task Pins: ${taskPinData.length}`);
  console.log(`  - Expenses: ${expenseData.length} (Total: $${expenseData.reduce((sum, e) => sum + parseFloat(e.amount), 0).toFixed(2)})`);
  console.log(`  - Killsheets: ${killsheetData.length} (Total: $${killsheetData.reduce((sum, k) => sum + parseFloat(k.netPayment), 0).toFixed(2)})`);
  
  process.exit(0);
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
