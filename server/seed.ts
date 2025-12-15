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

    // Create demo animals with varied breeds and lineage
    console.log("🐄 Creating demo animals...");
    const demoAnimals = [];

    // Animal breed configurations for variety
    const animalConfigs = [
      { name: "Daisy", breed: "Holstein Friesian", breedType: "Dairy", sex: "female" as const, origin: "Home bred", yearBorn: 2018 },
      { name: "Buttercup", breed: "Jersey", breedType: "Dairy", sex: "female" as const, origin: "Home bred", yearBorn: 2019 },
      { name: "Clover", breed: "Holstein Friesian", breedType: "Dairy", sex: "female" as const, origin: "Purchased - Smith Farm", yearBorn: 2020 },
      { name: "Rosie", breed: "Crossbred", breedType: "Dairy Cross", sex: "female" as const, origin: "Home bred", yearBorn: 2020 },
      { name: "Bella", breed: "Jersey", breedType: "Dairy", sex: "female" as const, origin: "Home bred", yearBorn: 2021 },
      { name: "Molly", breed: "Holstein Friesian", breedType: "Dairy", sex: "female" as const, origin: "Purchased - Jones Dairy", yearBorn: 2021 },
      { name: "Luna", breed: "Ayrshire", breedType: "Dairy", sex: "female" as const, origin: "Home bred", yearBorn: 2022 },
      { name: "Star", breed: "Holstein Friesian", breedType: "Dairy", sex: "female" as const, origin: "Home bred", yearBorn: 2022 },
      { name: "Thunder", breed: "Angus", breedType: "Beef", sex: "male" as const, origin: "Purchased - Highland Genetics", yearBorn: 2020 },
      { name: "Shadow", breed: "Hereford", breedType: "Beef", sex: "male" as const, origin: "Home bred", yearBorn: 2021 },
    ];

    for (let i = 0; i < animalConfigs.length; i++) {
      const config = animalConfigs[i];
      const [animal] = await db.insert(animals).values({
        visualId: `VID${1000 + i + 1}`,
        lifetimeId: `LID${2000 + i + 1}`,
        nationalId: `NZ${String(Date.now()).slice(-8)}${i + 1}`,
        naitTag: "123456789",
        eid: `EID${3000 + i + 1}`,
        name: config.name,
        breed: config.breed,
        breedType: config.breedType,
        origin: config.origin,
        dateOfBirth: `${config.yearBorn}-${String(3 + (i % 9)).padStart(2, '0')}-${String(10 + (i % 20)).padStart(2, '0')}`,
        yearBorn: config.yearBorn,
        sex: config.sex,
        herd: config.breedType === "Beef" ? "Beef Herd" : "Main Herd",
        currentPastureId: i < 5 ? pasture1.id : pasture2.id,
        status: "active",
        milkStatus: config.sex === "female" && config.breedType === "Dairy" ? "In Milk" : null,
        a2Status: config.breedType === "Dairy" ? (i % 3 === 0 ? "A2/A2" : "A1/A2") : null,
        bvdStatus: "Negative",
        dnaProfile: i % 2 === 0 ? "GEv" : "G3",
        startDate: new Date(`${config.yearBorn}-06-01`),
        bodyConditionScore: 4.0 + (Math.random() * 1.0),
        bcsDate: new Date(),
        liveWeight: config.sex === "male" ? 650.0 + (i * 15) : 450.0 + (i * 10),
        liveWeightDate: new Date(),
        reproductionStatus: config.sex === "female" ? {
          lactationNumber: 2024 - config.yearBorn - 1,
          daysInMilk: 100 + (i * 25),
          milkKgMS: 1.5 + (Math.random() * 0.8),
          milkLitres: 20 + (i * 2),
          fatKg: 0.7 + (Math.random() * 0.3),
          fatPercent: 3.0 + (Math.random() * 0.8),
          proteinKg: 0.6 + (Math.random() * 0.2),
          proteinPercent: 2.7 + (Math.random() * 0.4),
        } : null,
      } as InsertAnimal).returning();
      demoAnimals.push(animal);
    }

    // Update lineage relationships (Daisy is mother of Rosie and Star)
    if (demoAnimals.length >= 8) {
      // Rosie (index 3) is daughter of Daisy (index 0)
      await db.update(animals)
        .set({ damId: demoAnimals[0].id })
        .where(eq(animals.id, demoAnimals[3].id));
      
      // Star (index 7) is daughter of Daisy (index 0)
      await db.update(animals)
        .set({ damId: demoAnimals[0].id })
        .where(eq(animals.id, demoAnimals[7].id));
      
      // Luna (index 6) is daughter of Buttercup (index 1)
      await db.update(animals)
        .set({ damId: demoAnimals[1].id })
        .where(eq(animals.id, demoAnimals[6].id));

      // Shadow (index 9) has Thunder (index 8) as sire
      await db.update(animals)
        .set({ sireId: demoAnimals[8].id })
        .where(eq(animals.id, demoAnimals[9].id));
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
      staffMemberId: adminUser.id,
      staffMember: adminUser.name,
      dateTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      condition: "Mastitis",
      treatmentPlan: "Penicillin injections for 3 days",
      clinicalNotes: "Animal showing signs of mastitis in left rear quarter",
      status: "active",
    } as InsertAnimalTreatment);

    await db.insert(animalTreatments).values({
      animalId: demoAnimals[1].id,
      conditionId: condition2.id,
      productId: product2.id,
      staffMemberId: staffUser.id,
      staffMember: staffUser.name,
      dateTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      condition: "Lameness",
      treatmentPlan: "Single dose of Ivermectin",
      clinicalNotes: "Preventative parasite treatment",
      status: "completed",
      completedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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
