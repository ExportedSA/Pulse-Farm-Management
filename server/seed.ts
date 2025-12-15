import "dotenv/config";
import { db } from "./db";
import { hashPassword } from "./password";
import { 
  users, 
  chatChannels, 
  chatChannelMembers, 
  chatMessages,
  farmHazards,
  animals,
  pastures,
  products,
  productBatches,
  conditions,
  animalTreatments,
  reproductionEvents,
  type InsertUser,
  type InsertChatChannel,
  type InsertChatChannelMember,
  type InsertChatMessage,
  type InsertAnimal,
  type InsertPasture,
  type InsertProduct,
  type InsertProductBatch,
  type InsertCondition,
  type InsertAnimalTreatment,
  type InsertReproductionEvent
} from "@shared/schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Starting database seed...");

  try {
    // Clean existing data (in reverse order of dependencies)
    console.log("🧹 Cleaning existing data...");
    await db.delete(chatMessages);
    await db.delete(chatChannelMembers);
    await db.delete(chatChannels);
    await db.delete(animalTreatments);
    await db.delete(reproductionEvents);
    await db.delete(productBatches);
    await db.delete(products);
    await db.delete(conditions);
    await db.delete(animals);
    await db.delete(pastures);
    await db.delete(farmHazards);
    await db.delete(users);

    // Create demo users
    console.log("👥 Creating demo users...");
    const adminPassword = await hashPassword("password123");
    const staffPassword = await hashPassword("password123");

    const [adminUser] = await db.insert(users).values({
      name: "Farm Owner",
      email: "owner@demo.com",
      password: adminPassword,
      role: "owner",
      isActive: true,
      lastLoginAt: new Date(),
    } as InsertUser).returning();

    const [staffUser] = await db.insert(users).values({
      name: "Farm Worker",
      email: "worker@demo.com",
      password: staffPassword,
      role: "worker",
      isActive: true,
      lastLoginAt: new Date(),
    } as InsertUser).returning();

    const [managerUser] = await db.insert(users).values({
      name: "Farm Manager",
      email: "manager@demo.com",
      password: staffPassword,
      role: "manager",
      isActive: true,
      lastLoginAt: new Date(),
    } as InsertUser).returning();

    console.log(`✅ Created users: ${adminUser.name}, ${staffUser.name}, ${managerUser.name}`);

    // Create demo pastures
    console.log("🌾 Creating demo pastures...");
    const [pasture1] = await db.insert(pastures).values({
      name: "North Paddock",
      paddockNumber: 1,
      area: 25,
      currentStock: 5,
      status: "grazing",
      lastGrazed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      grazingDays: 14,
      restPeriodDays: 28,
      soilQuality: 7,
      grassCoverKg: 850,
      pastureType: "pasture",
      carryingCapacity: 2,
    } as InsertPasture).returning();

    const [pasture2] = await db.insert(pastures).values({
      name: "South Meadow",
      paddockNumber: 2,
      area: 18,
      currentStock: 5,
      status: "resting",
      lastGrazed: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      grazingDays: 10,
      restPeriodDays: 21,
      soilQuality: 6,
      grassCoverKg: 750,
      pastureType: "pasture",
      carryingCapacity: 2,
    } as InsertPasture).returning();

    // Create demo animals
    console.log("🐄 Creating demo animals...");
    const demoAnimals = [];
    for (let i = 1; i <= 10; i++) {
      const [animal] = await db.insert(animals).values({
        visualId: `VID${1000 + i}`,
        lifetimeId: `LID${2000 + i}`,
        naitTag: "123456789",
        eid: `EID${3000 + i}`,
        name: i === 1 ? "Daisy" : `Cow ${i}`,
        breed: "Friesian",
        dateOfBirth: "2020-03-15",
        yearBorn: 2020,
        sex: "female",
        herd: "Main Herd",
        currentPastureId: i <= 5 ? pasture1.id : pasture2.id,
        status: "active",
        milkStatus: "In Milk",
        a2Status: "A2/A2",
        bvdStatus: "Negative",
        dnaProfile: "GEv",
        startDate: new Date("2020-06-01"),
        bodyConditionScore: 4.5,
        bcsDate: new Date(),
        liveWeight: 450.0 + (i * 10),
        liveWeightDate: new Date(),
        reproductionStatus: {
          lactationNumber: 2 + Math.floor(i / 3),
          daysInMilk: 150 + (i * 20),
          milkKgMS: 1.8 + (i * 0.1),
          milkLitres: 25 + (i * 2),
          fatKg: 0.8 + (i * 0.05),
          fatPercent: 3.2 + (i * 0.1),
          proteinKg: 0.7 + (i * 0.05),
          proteinPercent: 2.8 + (i * 0.05),
        },
      } as InsertAnimal).returning();
      demoAnimals.push(animal);
    }

    // Create demo conditions
    console.log("💊 Creating demo conditions...");
    const [condition1] = await db.insert(conditions).values({
      name: "Mastitis",
      requiresBodyPart: true,
      bodyPartType: "udder",
    } as InsertCondition).returning();

    const [condition2] = await db.insert(conditions).values({
      name: "Lameness",
      requiresBodyPart: true,
      bodyPartType: "foot",
    } as InsertCondition).returning();

    // Create demo products
    console.log("📦 Creating demo products...");
    const [product1] = await db.insert(products).values({
      name: "Penicillin G Procaine",
      withdrawalDays: 4,
      milkWithdrawalDays: 3,
      meatWithdrawalDays: 10,
      useByDays: 28,
      treatmentPlan: "Inject intramuscularly once daily for 3 days",
      barcode: "1234567890123",
      stockQuantity: 50,
    } as InsertProduct).returning();

    const [product2] = await db.insert(products).values({
      name: "Ivermectin Drench",
      withdrawalDays: 14,
      milkWithdrawalDays: 35,
      meatWithdrawalDays: 42,
      useByDays: 365,
      treatmentPlan: "Oral drench - single dose",
      barcode: "2345678901234",
      stockQuantity: 100,
    } as InsertProduct).returning();

    // Create demo product batches
    console.log("📋 Creating demo product batches...");
    await db.insert(productBatches).values({
      productId: product1.id,
      productName: product1.name,
      batchNo: "B001",
      expiryDate: "2025-12-31",
      dateOpened: new Date().toISOString().split('T')[0],
      openedBy: adminUser.id,
      status: "open",
      notes: "New batch received",
    } as InsertProductBatch);

    // Create demo chat channels
    console.log("💬 Creating demo chat channels...");
    const [generalChannel] = await db.insert(chatChannels).values({
      name: "General",
      type: "group",
      createdBy: adminUser.id,
      isPrivate: false,
      description: "General farm discussions",
    } as InsertChatChannel).returning();

    const [announcementsChannel] = await db.insert(chatChannels).values({
      name: "Farm Announcements",
      type: "group",
      createdBy: adminUser.id,
      isPrivate: false,
      description: "Important farm announcements",
    } as InsertChatChannel).returning();

    const [healthChannel] = await db.insert(chatChannels).values({
      name: "Health & Safety",
      type: "group",
      createdBy: managerUser.id,
      isPrivate: false,
      description: "Health and safety discussions",
    } as InsertChatChannel).returning();

    // Add users to channels
    console.log("👥 Adding users to channels...");
    const channels = [generalChannel, announcementsChannel, healthChannel];
    const allUsers = [adminUser, staffUser, managerUser];

    for (const channel of channels) {
      for (const user of allUsers) {
        await db.insert(chatChannelMembers).values({
          channelId: channel.id,
          userId: user.id,
          joinedAt: new Date(),
        } as InsertChatChannelMember);
      }
    }

    // Create demo chat messages
    console.log("📝 Creating demo chat messages...");
    await db.insert(chatMessages).values({
      channelId: announcementsChannel.id,
      userId: adminUser.id,
      body: "Welcome to Demo Farm! 🎉 This is a test message to demonstrate the chat system.",
      messageType: "text",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    } as InsertChatMessage);

    await db.insert(chatMessages).values({
      channelId: generalChannel.id,
      userId: staffUser.id,
      body: "Good morning everyone! Ready for another productive day on the farm.",
      messageType: "text",
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
    } as InsertChatMessage);

    await db.insert(chatMessages).values({
      channelId: healthChannel.id,
      userId: managerUser.id,
      body: "Reminder: Safety induction for new equipment scheduled for tomorrow at 10 AM.",
      messageType: "text",
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
    } as InsertChatMessage);

    // Create demo farm hazards
    console.log("⚠️ Creating demo farm hazards...");
    await db.insert(farmHazards).values({
      type: "infrastructure",
      severity: "medium",
      title: "Broken fence in North Paddock",
      description: "Section of the boundary fence needs repair. Animals may be at risk of escaping.",
      latitude: -37.7889,
      longitude: 175.3098,
      location: "North Paddock - eastern boundary",
      status: "active",
      riskLevel: 3,
      mitigationRequired: true,
      reportedBy: adminUser.id,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    });

    await db.insert(farmHazards).values({
      type: "environmental",
      severity: "high",
      title: "Slippery area near milking shed",
      description: "Water accumulation causing slippery surface. Risk of slips and falls.",
      latitude: -37.7890,
      longitude: 175.3099,
      location: "Milking shed entrance",
      status: "active",
      riskLevel: 4,
      mitigationRequired: true,
      reportedBy: staffUser.id,
      assignedTo: managerUser.id,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    });

    // Create demo animal treatments
    console.log("💉 Creating demo animal treatments...");
    await db.insert(animalTreatments).values({
      animalId: demoAnimals[0].id,
      conditionId: condition1.id,
      productId: product1.id,
      treatmentPlan: "Penicillin injections for 3 days",
      notes: "Animal showing signs of mastitis in left rear quarter",
      status: "active",
      treatedBy: adminUser.id,
      treatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      expectedCompletionDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    } as InsertAnimalTreatment);

    await db.insert(animalTreatments).values({
      animalId: demoAnimals[1].id,
      conditionId: condition2.id,
      productId: product2.id,
      treatmentPlan: "Single dose of Ivermectin",
      notes: "Preventative parasite treatment",
      status: "completed",
      treatedBy: staffUser.id,
      treatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      expectedCompletionDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    } as InsertAnimalTreatment);

    // Create demo reproduction events
    console.log("🐮 Creating demo reproduction events...");
    await db.insert(reproductionEvents).values({
      animalId: demoAnimals[0].id,
      eventType: "heat",
      eventDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "Standing heat observed in morning",
      recordedBy: staffUser.id,
    } as InsertReproductionEvent);

    await db.insert(reproductionEvents).values({
      animalId: demoAnimals[2].id,
      eventType: "ai",
      eventDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "AI performed using proven sire",
      recordedBy: adminUser.id,
      aiSire: "Bull-123",
      semenCode: "ABC456",
    } as InsertReproductionEvent);

    console.log("\n✅ Database seed completed successfully!");
    console.log("\n👤 Demo Login Credentials:");
    console.log("   Owner: owner@demo.com / password123");
    console.log("   Manager: manager@demo.com / password123");
    console.log("   Worker: worker@demo.com / password123");
    console.log("\n📊 Created:");
    console.log(`   - 3 Users`);
    console.log(`   - 2 Pastures`);
    console.log(`   - 10 Animals`);
    console.log(`   - 2 Conditions`);
    console.log(`   - 2 Products`);
    console.log(`   - 3 Chat Channels`);
    console.log(`   - 3 Messages`);
    console.log(`   - 2 Hazards`);
    console.log(`   - 2 Treatments`);
    console.log(`   - 2 Reproduction Events`);

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

// Run the seed
seed().then(() => {
  console.log("\n🎉 Seed process finished. Exiting...");
  process.exit(0);
}).catch((error) => {
  console.error("❌ Seed process failed:", error);
  process.exit(1);
});
