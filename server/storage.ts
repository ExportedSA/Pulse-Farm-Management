// Reference: blueprint:javascript_database
import { db } from "./db";
import { eq, and, desc, gte, lte, or, like, sql } from "drizzle-orm";
import { hashPassword } from "./password";
import {
  users, products, productBatches, conditions, animals, pastures, animalTreatments,
  treatmentEvents, reproductionEvents, naitRecords, milkWithholdings, pastureMovements, pastureHealthRecords,
  batchLifecycleEvents, animalGroups, animalGroupMembers, alerts,
  visitors, visitorSignIns, qrCodes,
  vehicleTypes, vehicles, vehicleInspectionTemplates, vehicleInspectionItems,
  vehicleInspections, vehicleInspectionResults, vehicleMaintenanceRecords,
  farmHazards, settings, userPreferences, activityLogs, weightRecords, weightTargets, vaccinationSchedules,
  healthScores, mortalityRecords, healthAlerts,
  bulls, breedingRecords, calvingRecords, lactationRecords, heatRecords,
  veterinarians, vetVisits, labResults, prescriptions, vetCostRecords,
  type User,
  type InsertUser,
  type UserPreferences,
  type InsertUserPreferences,
  type Product,
  type InsertProduct,
  type ProductBatch,
  type InsertProductBatch,
  type Condition,
  type InsertCondition,
  type Animal,
  type InsertAnimal,
  type Pasture,
  type InsertPasture,
  type AnimalTreatment,
  type InsertAnimalTreatment,
  type TreatmentEvent,
  type ReproductionEvent,
  type InsertReproductionEvent,
  type MilkWithholding,
  type NAITRecord,
  type InsertNaitRecord,
  type ReminderSettings,
  // Visitor Management Types (Phase 1)
  type Visitor,
  type InsertVisitor,
  type VisitorSignIn,
  type InsertVisitorSignIn,
  type QRCode,
  type InsertQRCode,
  insertMilkWithholdingSchema,
  type InsertMilkWithholding,
  type AnimalGroup,
  type InsertAnimalGroup,
  type PastureMovement,
  type InsertPastureMovement,
  type AnimalGroupMember,
  type InsertAnimalGroupMember,
  type WeightRecord,
  type InsertWeightRecord,
  type WeightTarget,
  type InsertWeightTarget,
  type VaccinationSchedule,
  type InsertVaccinationSchedule,
  type HealthScore,
  type InsertHealthScore,
  type MortalityRecord,
  type InsertMortalityRecord,
  type HealthAlert,
  type InsertHealthAlert,
  type Bull,
  type InsertBull,
  type BreedingRecord,
  type InsertBreedingRecord,
  type CalvingRecord,
  type InsertCalvingRecord,
  type LactationRecord,
  type InsertLactationRecord,
  type HeatRecord,
  type InsertHeatRecord,
  type Veterinarian,
  type InsertVeterinarian,
  type VetVisit,
  type InsertVetVisit,
  type LabResult,
  type InsertLabResult,
  type Prescription,
  type InsertPrescription,
  type VetCostRecord,
  type InsertVetCostRecord,
  type PastureHealthRecord,
  type InsertPastureHealthRecord,
  type BatchLifecycleEvent,
  type InsertBatchLifecycleEvent,
  type Alert,
  type InsertAlert,
  // Vehicle Registry Types (Phase 1 Extension)
  type VehicleType,
  type Vehicle,
  type VehicleInspectionTemplate,
  type VehicleInspectionItem,
  type VehicleInspection,
  type VehicleInspectionResult,
  type VehicleMaintenanceRecord,
  // Geospatial Mapping Types
  type FarmHazard,
  // Stock Transaction Types (Phase 2)
  stockTransactions,
  type StockTransaction,
  type InsertStockTransaction,
  // Task Pin Types (Phase 3)
  taskPins,
  type TaskPin,
  type InsertTaskPin,
  // Financial Types (Phase 4)
  expenses,
  killsheets,
  killsheetItems,
  type Expense,
  type InsertExpense,
  type Killsheet,
  type InsertKillsheet,
  type KillsheetItem,
  type InsertKillsheetItem,
  // Milk Production Types (Phase 5)
  milkRecords,
  milkQualityAlerts,
  type MilkRecord,
  type InsertMilkRecord,
  type MilkQualityAlert,
  type InsertMilkQualityAlert,
  // Budgeting & Forecasting Types (Phase 5)
  budgets,
  budgetCategories,
  forecasts,
  forecastData,
  type Budget,
  type InsertBudget,
  type BudgetCategory,
  type InsertBudgetCategory,
  type Forecast,
  type InsertForecast,
  type ForecastData,
  type InsertForecastData,
  // NZFAP Compliance Types (Phase 5)
  complianceStandards,
  complianceChecks,
  complianceAudits,
  complianceDocuments,
  type ComplianceStandard,
  type InsertComplianceStandard,
  type ComplianceCheck,
  type InsertComplianceCheck,
  type ComplianceAudit,
  type InsertComplianceAudit,
  type ComplianceDocument,
  type InsertComplianceDocument,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByName(name: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;

  // User Preferences (Phase 6A)
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  upsertUserPreferences(data: InsertUserPreferences): Promise<UserPreferences>;

  // Products (Medicines)
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductByBarcode(barcode: string): Promise<Product | undefined>;
  createProduct(data: InsertProduct): Promise<Product>;
  updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  adjustProductStock(id: string, quantity: number): Promise<Product>;
  disposeExpiredStock(id: string): Promise<Product>;

  // Product Batches (Stock/Inventory)
  getProductBatches(openOnly?: boolean): Promise<ProductBatch[]>;
  getProductBatch(id: string): Promise<ProductBatch | undefined>;
  createProductBatch(data: InsertProductBatch): Promise<ProductBatch>;
  updateProductBatch(id: string, data: Partial<InsertProductBatch>): Promise<ProductBatch>;
  deleteProductBatch(id: string): Promise<void>;
  getBatchTraceability(batchId: string): Promise<{ batch: ProductBatch; treatments: AnimalTreatment[]; animals: Animal[] } | undefined>;
  getMedicineComplianceAlerts(): Promise<{ expiringBatches: ProductBatch[]; expiredBatches: ProductBatch[]; activeWithholdings: (MilkWithholding & { animal?: Animal })[]; lowStockProducts: Product[] }>;
  
  // Batch Lifecycle Events (Phase 6)
  createBatchLifecycleEvent(data: InsertBatchLifecycleEvent): Promise<BatchLifecycleEvent>;
  getBatchLifecycleEvents(batchId: string): Promise<BatchLifecycleEvent[]>;
  getBatchUsageHistory(batchId: string): Promise<{ batch: ProductBatch; events: BatchLifecycleEvent[]; treatments: AnimalTreatment[]; animals: Animal[] } | undefined>;

  // Conditions
  getConditions(): Promise<Condition[]>;
  getCondition(id: string): Promise<Condition | undefined>;
  createCondition(data: InsertCondition): Promise<Condition>;
  updateCondition(id: string, data: Partial<InsertCondition>): Promise<Condition>;
  deleteCondition(id: string): Promise<void>;

  // Animals
  getAnimals(status?: string): Promise<Animal[]>;
  getAnimal(id: string): Promise<Animal | undefined>;
  searchAnimals(query: string): Promise<Animal[]>;
  createAnimal(data: InsertAnimal): Promise<Animal>;
  updateAnimal(id: string, data: Partial<InsertAnimal>): Promise<Animal>;
  deleteAnimal(id: string): Promise<void>;

  // Pastures
  getPastures(): Promise<Pasture[]>;
  getPasture(id: string): Promise<Pasture | undefined>;
  searchPastures(query: string): Promise<Pasture[]>;
  createPasture(data: InsertPasture): Promise<Pasture>;
  updatePasture(id: string, data: Partial<InsertPasture>, userId?: string): Promise<Pasture | undefined>;
  deletePasture(id: string): Promise<void>;

  // Animal Treatments
  getAnimalTreatments(status?: string): Promise<AnimalTreatment[]>;
  getAnimalTreatment(id: string): Promise<AnimalTreatment | undefined>;
  getAnimalTreatmentsByAnimal(animalId: string): Promise<AnimalTreatment[]>;
  createAnimalTreatment(data: InsertAnimalTreatment): Promise<AnimalTreatment>;
  updateAnimalTreatment(id: string, data: Partial<InsertAnimalTreatment>): Promise<AnimalTreatment>;
  deleteAnimalTreatment(id: string): Promise<void>;

  // Treatment Events (Immutable audit trail)
  createTreatmentEvent(treatmentId: string, eventType: string, data: Partial<TreatmentEvent>): Promise<TreatmentEvent>;
  getTreatmentEvents(treatmentId: string): Promise<TreatmentEvent[]>;

  // Reproduction Events
  getReproductionEvents(animalId?: string): Promise<ReproductionEvent[]>;
  getReproductionEvent(id: string): Promise<ReproductionEvent | undefined>;
  createReproductionEvent(data: InsertReproductionEvent): Promise<ReproductionEvent>;
  updateReproductionEvent(id: string, data: Partial<InsertReproductionEvent>): Promise<ReproductionEvent>;
  deleteReproductionEvent(id: string): Promise<void>;

  // Milk Withholdings
  getActiveMilkWithholdings(): Promise<MilkWithholding[]>;
  getMilkWithholdingsByAnimal(animalId: string): Promise<MilkWithholding[]>;
  createMilkWithholding(data: InsertMilkWithholding): Promise<MilkWithholding>;
  closeMilkWithholding(id: string): Promise<MilkWithholding>;

  // NAIT Records
  getNaitRecords(): Promise<NAITRecord[]>;
  getNaitRecordByAnimal(animalId: string): Promise<NAITRecord | undefined>;
  createNaitRecord(data: InsertNaitRecord): Promise<NAITRecord>;
  updateNaitRecord(id: string, data: Partial<InsertNaitRecord>): Promise<NAITRecord>;

  // Settings
  getSetting(key: string): Promise<any>;
  setSetting(key: string, value: any): Promise<void>;

  // Animal Groups (Phase 4: Animal Intelligence)
  getAnimalGroups(): Promise<AnimalGroup[]>;
  getAnimalGroup(id: string): Promise<AnimalGroup | undefined>;
  getAnimalGroupWithMembers(id: string): Promise<{ group: AnimalGroup; members: Animal[] } | undefined>;
  createAnimalGroup(data: InsertAnimalGroup): Promise<AnimalGroup>;
  updateAnimalGroup(id: string, data: Partial<InsertAnimalGroup>): Promise<AnimalGroup>;
  deleteAnimalGroup(id: string): Promise<void>;
  addAnimalToGroup(groupId: string, animalId: string, addedBy?: string, notes?: string): Promise<AnimalGroupMember>;
  removeAnimalFromGroup(groupId: string, animalId: string): Promise<void>;
  getGroupMembers(groupId: string): Promise<Animal[]>;
  getAnimalGroupMemberships(animalId: string): Promise<AnimalGroup[]>;

  // Pasture Movements (Phase 5: Pasture Performance)
  getPastureMovements(animalId?: string, pastureId?: string): Promise<PastureMovement[]>;
  getPastureMovement(id: string): Promise<PastureMovement | undefined>;
  createPastureMovement(data: InsertPastureMovement): Promise<PastureMovement>;
  moveanimalsToPasture(animalIds: string[], toPastureId: string, movedBy: string, reason?: string): Promise<PastureMovement[]>;

  // Pasture Health Records (Phase 5.3: Health Tracking History)
  getPastureHealthRecords(pastureId: string): Promise<PastureHealthRecord[]>;
  createPastureHealthRecord(data: InsertPastureHealthRecord): Promise<PastureHealthRecord>;

  // Analytics (Phase 5.4: Advanced Analytics Dashboard)
  getAnalyticsTreatmentActivity(days: number): Promise<{ date: string; count: number }[]>;
  getAnalyticsPastureHealthTrends(days: number): Promise<{ date: string; avgGrazingDays: number; avgRestDays: number; avgSoilQuality: number; avgGrassCover: number }[]>;
  getAnalyticsMedicineUsage(days: number): Promise<{ date: string; opened: number; emptied: number; meanDaysToEmpty: number }[]>;
  getAnalyticsAnimalMovements(days: number): Promise<{ pastureId: string; pastureName: string; moveCount: number }[]>;
  getAnalyticsReproductionMetrics(days: number): Promise<{ heatCount: number; aiCount: number; pregnancyCount: number; calvingCount: number; avgCalvingInterval: number }>;
  getAnalyticsPastureRoundLength(): Promise<{ pastureId: string; pastureName: string; roundLengthDays: number; lastRotationDate: string | null }[]>;
  getAnalyticsPastureGrowthEstimate(): Promise<{ pastureId: string; pastureName: string; estimatedGrowthKgPerDay: number; daysRested: number; currentGrassCover: number }[]>;

  // Activity Logs
  createActivityLog(entry: {
    userId?: string | null;
    userName: string;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    details?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<void>;

  // Alerts
  getActiveAlerts(): Promise<Alert[]>;
  getAlertsByAnimal(animalId: string): Promise<Alert[]>;
  createAlert(data: InsertAlert): Promise<Alert>;
  dismissAlert(id: string, dismissedBy: string): Promise<Alert>;
  deleteOldAlerts(daysOld: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // ===== USERS =====
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByName(name: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.name, name));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(data: InsertUser & { password?: string }): Promise<User> {
    const { password, ...userData } = data;
    if (!password) {
      throw new Error("Password is required when creating a user");
    }
    // Note: The schema uses 'password' field, not 'passwordHash'
    // Storing hashed password in the password field as expected by schema
    const userWithHash = { ...userData, password: await hashPassword(password) };
    const [user] = await db.insert(users).values(userWithHash).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser> & { password?: string }): Promise<User> {
    const { password, ...userData } = data;
    const updateData = password
      ? { ...userData, password: await hashPassword(password), updatedAt: new Date() }
      : { ...userData, updatedAt: new Date() };
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // ===== USER PREFERENCES (Phase 6A) =====

  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);
    return prefs;
  }

  async upsertUserPreferences(data: InsertUserPreferences): Promise<UserPreferences> {
    const existing = await this.getUserPreferences(data.userId);
    
    if (existing) {
      // Update existing preferences
      const [updated] = await db
        .update(userPreferences)
        .set({ 
          dashboardWidgets: data.dashboardWidgets as any,
          notificationSettings: data.notificationSettings as any,
          theme: data.theme,
          updatedAt: new Date() 
        })
        .where(eq(userPreferences.userId, data.userId))
        .returning();
      return updated;
    } else {
      // Create new preferences
      const [created] = await db
        .insert(userPreferences)
        .values({
          userId: data.userId,
          dashboardWidgets: data.dashboardWidgets as any,
          notificationSettings: data.notificationSettings as any,
          theme: data.theme,
        } as any)
        .returning();
      return created;
    }
  }

  // ===== PRODUCTS (MEDICINES) =====
  async getProducts(): Promise<Product[]> {
    return await db.select().from(products).where(sql`${products.deletedAt} IS NULL`);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductByBarcode(barcode: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.barcode, barcode));
    return product;
  }

  async createProduct(data: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(data).returning();
    return product;
  }

  async updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product> {
    const [product] = await db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async deleteProduct(id: string): Promise<void> {
    // Soft delete
    await db.update(products).set({ deletedAt: new Date() }).where(eq(products.id, id));
  }

  async adjustProductStock(id: string, quantity: number): Promise<Product> {
    const product = await this.getProduct(id);
    if (!product) {
      throw new Error('Product not found');
    }
    
    const newQuantity = (product.stockQuantity || 0) + quantity;
    if (newQuantity < 0) {
      throw new Error('Cannot reduce stock below zero');
    }

    const [updated] = await db
      .update(products)
      .set({ 
        stockQuantity: newQuantity,
        updatedAt: new Date() 
      })
      .where(eq(products.id, id))
      .returning();
    
    return updated;
  }

  async disposeExpiredStock(id: string): Promise<Product> {
    const product = await this.getProduct(id);
    if (!product) {
      throw new Error('Product not found');
    }

    const [updated] = await db
      .update(products)
      .set({ 
        stockQuantity: 0,
        updatedAt: new Date() 
      })
      .where(eq(products.id, id))
      .returning();
    
    return updated;
  }

  // ===== PRODUCT BATCHES =====
  async getProductBatches(openOnly = false): Promise<ProductBatch[]> {
    if (openOnly) {
      return await db.select().from(productBatches).where(eq(productBatches.status, 'open'));
    }
    return await db.select().from(productBatches).orderBy(desc(productBatches.createdAt));
  }

  async getProductBatch(id: string): Promise<ProductBatch | undefined> {
    const [batch] = await db.select().from(productBatches).where(eq(productBatches.id, id));
    return batch;
  }

  async createProductBatch(data: InsertProductBatch): Promise<ProductBatch> {
    const [batch] = await db.insert(productBatches).values(data).returning();
    return batch;
  }

  async updateProductBatch(id: string, data: Partial<InsertProductBatch>): Promise<ProductBatch> {
    const [batch] = await db
      .update(productBatches)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productBatches.id, id))
      .returning();
    return batch;
  }

  async deleteProductBatch(id: string): Promise<void> {
    await db.delete(productBatches).where(eq(productBatches.id, id));
  }

  async getBatchTraceability(batchId: string): Promise<{ batch: ProductBatch; treatments: AnimalTreatment[]; animals: Animal[] } | undefined> {
    const batch = await this.getProductBatch(batchId);
    if (!batch) return undefined;

    const treatments = await db
      .select()
      .from(animalTreatments)
      .where(
        and(
          eq(animalTreatments.productId, batch.productId),
          sql`${animalTreatments.dateTime} >= ${batch.dateOpened}`,
          batch.emptiedDate 
            ? sql`${animalTreatments.dateTime} <= ${batch.emptiedDate}`
            : sql`TRUE`
        )
      )
      .orderBy(desc(animalTreatments.dateTime));

    const animalIds = Array.from(new Set(treatments.map(t => t.animalId).filter(Boolean)));
    if (animalIds.length === 0) {
      return { batch, treatments, animals: [] };
    }
    const uniqueAnimals = await db
      .select()
      .from(animals)
      .where(sql`${animals.id} IN (${sql.join(animalIds.map(id => sql`${id}`), sql`, `)})`);

    return {
      batch,
      treatments,
      animals: uniqueAnimals
    };
  }

  async getMedicineComplianceAlerts(): Promise<{
    expiringBatches: ProductBatch[];
    expiredBatches: ProductBatch[];
    activeWithholdings: (MilkWithholding & { animal?: Animal })[];
    lowStockProducts: Product[];
  }> {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0];

    const openBatches = await db
      .select()
      .from(productBatches)
      .where(eq(productBatches.status, 'open'));

    const expiringBatches = openBatches.filter(b => 
      b.expiryDate && b.expiryDate >= today && b.expiryDate <= sevenDaysStr
    );

    const expiredBatches = openBatches.filter(b => 
      b.expiryDate && b.expiryDate < today
    );

    const activeWithholdings = await db
      .select()
      .from(milkWithholdings)
      .leftJoin(animals, eq(milkWithholdings.animalId, animals.id))
      .where(
        and(
          eq(milkWithholdings.isActive, true),
          gte(milkWithholdings.endDate, today)
        )
      )
      .orderBy(milkWithholdings.endDate);

    const withholdings = activeWithholdings.map(row => ({
      ...row.milk_withholdings,
      animal: row.animals || undefined
    }));

    const allProducts = await this.getProducts();
    const productBatchCounts = openBatches.reduce((acc, batch) => {
      acc[batch.productId] = (acc[batch.productId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const lowStockProducts = allProducts.filter(p => 
      (productBatchCounts[p.id] || 0) < 2
    );

    return {
      expiringBatches,
      expiredBatches,
      activeWithholdings: withholdings,
      lowStockProducts
    };
  }

  // ===== BATCH LIFECYCLE EVENTS (Phase 6) =====
  async createBatchLifecycleEvent(data: InsertBatchLifecycleEvent): Promise<BatchLifecycleEvent> {
    const [event] = await db.insert(batchLifecycleEvents).values(data).returning();
    return event;
  }

  async getBatchLifecycleEvents(batchId: string): Promise<BatchLifecycleEvent[]> {
    return await db
      .select()
      .from(batchLifecycleEvents)
      .where(eq(batchLifecycleEvents.batchId, batchId))
      .orderBy(desc(batchLifecycleEvents.eventTimestamp));
  }

  async getBatchUsageHistory(batchId: string): Promise<{ batch: ProductBatch; events: BatchLifecycleEvent[]; treatments: AnimalTreatment[]; animals: Animal[] } | undefined> {
    const batch = await this.getProductBatch(batchId);
    if (!batch) return undefined;

    const events = await this.getBatchLifecycleEvents(batchId);
    
    const treatmentIds = events
      .filter(e => e.relatedTreatmentId)
      .map(e => e.relatedTreatmentId as string);

    let treatments: AnimalTreatment[] = [];
    if (treatmentIds.length > 0) {
      treatments = await db
        .select()
        .from(animalTreatments)
        .where(sql`${animalTreatments.id} IN (${sql.join(treatmentIds.map(id => sql`${id}`), sql`, `)})`)
        .orderBy(desc(animalTreatments.dateTime));
    }

    const animalIds = Array.from(new Set(treatments.map(t => t.animalId).filter(Boolean)));
    if (animalIds.length === 0) {
      return { batch, events, treatments: [], animals: [] };
    }
    const uniqueAnimals = await db
      .select()
      .from(animals)
      .where(sql`${animals.id} IN (${sql.join(animalIds.map(id => sql`${id}`), sql`, `)})`);

    return {
      batch,
      events,
      treatments,
      animals: uniqueAnimals
    };
  }

  // ===== CONDITIONS =====
  async getConditions(): Promise<Condition[]> {
    return await db.select().from(conditions);
  }

  async getCondition(id: string): Promise<Condition | undefined> {
    const [condition] = await db.select().from(conditions).where(eq(conditions.id, id));
    return condition;
  }

  async createCondition(data: InsertCondition): Promise<Condition> {
    const [condition] = await db.insert(conditions).values(data).returning();
    return condition;
  }

  async updateCondition(id: string, data: Partial<InsertCondition>): Promise<Condition> {
    const [condition] = await db
      .update(conditions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(conditions.id, id))
      .returning();
    return condition;
  }

  async deleteCondition(id: string): Promise<void> {
    await db.delete(conditions).where(eq(conditions.id, id));
  }

  // ===== ANIMALS =====
  async getAnimals(status?: string): Promise<Animal[]> {
    if (status) {
      return await db.select().from(animals).where(
        and(
          eq(animals.status, status as any),
          sql`${animals.deletedAt} IS NULL`
        )
      );
    }
    return await db.select().from(animals).where(sql`${animals.deletedAt} IS NULL`).orderBy(desc(animals.createdAt));
  }

  async getAnimal(id: string): Promise<Animal | undefined> {
    const [animal] = await db.select().from(animals).where(eq(animals.id, id));
    return animal;
  }

  async searchAnimals(query: string): Promise<Animal[]> {
    const searchPattern = `%${query}%`;
    return await db
      .select()
      .from(animals)
      .where(
        and(
          sql`${animals.deletedAt} IS NULL`,
          or(
            like(animals.cowId, searchPattern),
            like(animals.naitTag, searchPattern),
            like(animals.breed, searchPattern)
          )
        )
      );
  }

  async createAnimal(data: InsertAnimal): Promise<Animal> {
    const [animal] = await db.insert(animals).values(data).returning();
    return animal;
  }

  async updateAnimal(id: string, data: Partial<InsertAnimal>): Promise<Animal> {
    const currentAnimal = await this.getAnimal(id);
    if (!currentAnimal) throw new Error("Animal not found");

    const [animal] = await db
      .update(animals)
      .set({ 
        ...data, 
        updatedAt: new Date(),
        version: currentAnimal.version + 1
      })
      .where(eq(animals.id, id))
      .returning();
    return animal;
  }

  async deleteAnimal(id: string): Promise<void> {
    // Soft delete for audit compliance
    await db.update(animals).set({ deletedAt: new Date() }).where(eq(animals.id, id));
  }

  // ===== PASTURES =====
  async getPastures(): Promise<Pasture[]> {
    return await db.select().from(pastures).where(sql`${pastures.deletedAt} IS NULL`);
  }

  async getPasture(id: string): Promise<Pasture | undefined> {
    const [pasture] = await db.select().from(pastures).where(eq(pastures.id, id));
    return pasture;
  }

  async searchPastures(query: string): Promise<Pasture[]> {
    const searchPattern = `%${query}%`;
    return await db
      .select()
      .from(pastures)
      .where(
        and(
          sql`${pastures.deletedAt} IS NULL`,
          like(pastures.name, searchPattern)
        )
      );
  }

  async createPasture(data: InsertPasture): Promise<Pasture> {
    const [pasture] = await db.insert(pastures).values(data).returning();
    return pasture;
  }

  async updatePasture(id: string, data: Partial<InsertPasture>, userId?: string): Promise<Pasture | undefined> {
    // Fetch existing pasture to compare health metrics
    const existing = await this.getPasture(id);
    
    // Update pasture
    const [pasture] = await db
      .update(pastures)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pastures.id, id))
      .returning();
    
    // Guard: Return undefined if pasture doesn't exist (route will return 404)
    if (!pasture) {
      return undefined;
    }
    
    // Auto-snapshot: Create health record if any health metric changed
    if (existing && userId) {
      const healthMetricsChanged = 
        (data.grazingDays !== undefined && data.grazingDays !== existing.grazingDays) ||
        (data.restPeriodDays !== undefined && data.restPeriodDays !== existing.restPeriodDays) ||
        (data.soilQuality !== undefined && data.soilQuality !== existing.soilQuality) ||
        (data.grassCoverKg !== undefined && data.grassCoverKg !== existing.grassCoverKg);
      
      if (healthMetricsChanged) {
        try {
          await this.createPastureHealthRecord({
            pastureId: id,
            recordedBy: userId,
            grazingDays: data.grazingDays !== undefined ? data.grazingDays : (existing.grazingDays ?? undefined),
            restPeriodDays: data.restPeriodDays !== undefined ? data.restPeriodDays : (existing.restPeriodDays ?? undefined),
            soilQuality: data.soilQuality !== undefined ? data.soilQuality : (existing.soilQuality ?? undefined),
            grassCoverKg: data.grassCoverKg !== undefined ? data.grassCoverKg : (existing.grassCoverKg ?? undefined),
            notes: `Auto-snapshot on pasture update`,
          });
        } catch (error) {
          console.error("Failed to create health snapshot:", error);
          throw new Error("Failed to create health record snapshot");
        }
      }
    }
    
    return pasture;
  }

  async deletePasture(id: string): Promise<void> {
    // Soft delete
    await db.update(pastures).set({ deletedAt: new Date() }).where(eq(pastures.id, id));
  }

  // ===== ANIMAL TREATMENTS =====
  async getAnimalTreatments(status?: string): Promise<AnimalTreatment[]> {
    if (status) {
      return await db.select().from(animalTreatments).where(
        and(
          eq(animalTreatments.status, status as any),
          sql`${animalTreatments.deletedAt} IS NULL`
        )
      ).orderBy(desc(animalTreatments.dateTime));
    }
    return await db.select().from(animalTreatments).where(sql`${animalTreatments.deletedAt} IS NULL`).orderBy(desc(animalTreatments.dateTime));
  }

  async getAnimalTreatment(id: string): Promise<AnimalTreatment | undefined> {
    const [treatment] = await db.select().from(animalTreatments).where(eq(animalTreatments.id, id));
    return treatment;
  }

  async getAnimalTreatmentsByAnimal(animalId: string): Promise<AnimalTreatment[]> {
    return await db
      .select()
      .from(animalTreatments)
      .where(
        and(
          eq(animalTreatments.animalId, animalId),
          sql`${animalTreatments.deletedAt} IS NULL`
        )
      )
      .orderBy(desc(animalTreatments.dateTime));
  }

  async createAnimalTreatment(data: InsertAnimalTreatment): Promise<AnimalTreatment> {
    const [treatment] = await db.insert(animalTreatments).values(data).returning();
    
    // Create immutable audit event
    await this.createTreatmentEvent(treatment.id, 'created', {
      actorName: data.staffMember,
      phase: data.awaitingTreatment ? 'awaiting' : 'treatment',
      payload: { ...data },
      sequence: 1,
    });

    // Phase 2: Evaluate and create/dismiss alerts related to this treatment
    await this.ensureTreatmentAlerts(treatment);

    return treatment;
  }

  async updateAnimalTreatment(id: string, data: Partial<InsertAnimalTreatment>): Promise<AnimalTreatment> {
    const currentTreatment = await this.getAnimalTreatment(id);
    if (!currentTreatment) throw new Error("Treatment not found");

    const [treatment] = await db
      .update(animalTreatments)
      .set({ 
        ...data, 
        updatedAt: new Date(),
        version: currentTreatment.version + 1
      })
      .where(eq(animalTreatments.id, id))
      .returning();

    // Create audit event for the update
    const events = await this.getTreatmentEvents(id);
    await this.createTreatmentEvent(id, 'updated', {
      actorName: data.staffMember || currentTreatment.staffMember,
      payload: { ...data },
      sequence: events.length + 1,
    });

    // Phase 2: Evaluate and create/dismiss alerts related to this treatment
    await this.ensureTreatmentAlerts(treatment);

    return treatment;
  }

  async deleteAnimalTreatment(id: string): Promise<void> {
    // Soft delete for RVM audit compliance
    await db.update(animalTreatments).set({ deletedAt: new Date() }).where(eq(animalTreatments.id, id));
  }

  // ===== TREATMENT EVENTS (Immutable) =====
  async createTreatmentEvent(treatmentId: string, eventType: string, data: Partial<TreatmentEvent>): Promise<TreatmentEvent> {
    const [event] = await db
      .insert(treatmentEvents)
      .values({
        treatmentId,
        eventType,
        ...data,
      } as any)
      .returning();
    return event;
  }

  async getTreatmentEvents(treatmentId: string): Promise<TreatmentEvent[]> {
    return await db
      .select()
      .from(treatmentEvents)
      .where(eq(treatmentEvents.treatmentId, treatmentId))
      .orderBy(treatmentEvents.sequence);
  }

  // ===== REPRODUCTION EVENTS =====
  async getReproductionEvents(animalId?: string): Promise<ReproductionEvent[]> {
    if (animalId) {
      return await db
        .select()
        .from(reproductionEvents)
        .where(eq(reproductionEvents.animalId, animalId))
        .orderBy(desc(reproductionEvents.eventDate));
    }
    return await db.select().from(reproductionEvents).orderBy(desc(reproductionEvents.eventDate));
  }

  async getReproductionEvent(id: string): Promise<ReproductionEvent | undefined> {
    const [event] = await db.select().from(reproductionEvents).where(eq(reproductionEvents.id, id));
    return event;
  }

  async createReproductionEvent(data: InsertReproductionEvent): Promise<ReproductionEvent> {
    const [event] = await db.insert(reproductionEvents).values(data as any).returning();
    return event;
  }

  async updateReproductionEvent(id: string, data: Partial<InsertReproductionEvent>): Promise<ReproductionEvent> {
    const [event] = await db
      .update(reproductionEvents)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(reproductionEvents.id, id))
      .returning();
    return event;
  }

  async deleteReproductionEvent(id: string): Promise<void> {
    await db.delete(reproductionEvents).where(eq(reproductionEvents.id, id));
  }

  // ===== MILK WITHHOLDINGS =====
  async getActiveMilkWithholdings(): Promise<MilkWithholding[]> {
    const today = new Date().toISOString().split('T')[0];
    return await db
      .select()
      .from(milkWithholdings)
      .where(
        and(
          eq(milkWithholdings.isActive, true),
          gte(milkWithholdings.endDate, today)
        )
      );
  }

  async getMilkWithholdingsByAnimal(animalId: string): Promise<MilkWithholding[]> {
    return await db
      .select()
      .from(milkWithholdings)
      .where(eq(milkWithholdings.animalId, animalId))
      .orderBy(desc(milkWithholdings.createdAt));
  }

  async createMilkWithholding(data: InsertMilkWithholding): Promise<MilkWithholding> {
    const [withholding] = await db.insert(milkWithholdings).values(data).returning();
    return withholding;
  }

  async closeMilkWithholding(id: string): Promise<MilkWithholding> {
    const [withholding] = await db
      .update(milkWithholdings)
      .set({ isActive: false })
      .where(eq(milkWithholdings.id, id))
      .returning();
    return withholding;
  }

  // ===== NAIT RECORDS =====
  async getNaitRecords(): Promise<NAITRecord[]> {
    return await db.select().from(naitRecords);
  }

  async getNaitRecordByAnimal(animalId: string): Promise<NAITRecord | undefined> {
    const [record] = await db.select().from(naitRecords).where(eq(naitRecords.animalId, animalId));
    return record;
  }

  async createNaitRecord(data: InsertNaitRecord): Promise<NAITRecord> {
    const [record] = await db.insert(naitRecords).values(data).returning();
    return record;
  }

  async updateNaitRecord(id: string, data: Partial<InsertNaitRecord>): Promise<NAITRecord> {
    const [record] = await db
      .update(naitRecords)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(naitRecords.id, id))
      .returning();
    return record;
  }

  // ===== SETTINGS =====
  async getSetting(key: string): Promise<any> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting?.value;
  }

  async setSetting(key: string, value: any): Promise<void> {
    const existing = await db.select().from(settings).where(eq(settings.key, key));
    
    if (existing.length > 0) {
      await db
        .update(settings)
        .set({ value, updatedAt: new Date() })
        .where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value });
    }
  }

  // ===== ANIMAL GROUPS (Phase 4: Animal Intelligence) =====
  async getAnimalGroups(): Promise<(AnimalGroup & { memberCount: number })[]> {
    // Efficient single query with aggregated member counts
    const result = await db
      .select({
        id: animalGroups.id,
        name: animalGroups.name,
        description: animalGroups.description,
        color: animalGroups.color,
        groupType: animalGroups.groupType,
        criteria: animalGroups.criteria,
        sortOrder: animalGroups.sortOrder,
        metadata: animalGroups.metadata,
        createdBy: animalGroups.createdBy,
        createdAt: animalGroups.createdAt,
        updatedAt: animalGroups.updatedAt,
        deletedAt: animalGroups.deletedAt,
        memberCount: sql<number>`COALESCE(COUNT(${animalGroupMembers.id}), 0)::int`,
      })
      .from(animalGroups)
      .leftJoin(animalGroupMembers, eq(animalGroups.id, animalGroupMembers.groupId))
      .where(sql`${animalGroups.deletedAt} IS NULL`)
      .groupBy(animalGroups.id)
      .orderBy(animalGroups.sortOrder, animalGroups.name);

    return result as (AnimalGroup & { memberCount: number })[];
  }

  async getAnimalGroup(id: string): Promise<AnimalGroup | undefined> {
    const [group] = await db
      .select()
      .from(animalGroups)
      .where(and(
        eq(animalGroups.id, id),
        sql`${animalGroups.deletedAt} IS NULL`
      ));
    return group;
  }

  async getAnimalGroupWithMembers(id: string): Promise<{ group: AnimalGroup; members: Animal[] } | undefined> {
    const group = await this.getAnimalGroup(id);
    if (!group) return undefined;

    const members = await this.getGroupMembers(id);
    return { group, members };
  }

  async createAnimalGroup(data: InsertAnimalGroup): Promise<AnimalGroup> {
    const [group] = await db.insert(animalGroups).values(data).returning();
    return group;
  }

  async updateAnimalGroup(id: string, data: Partial<InsertAnimalGroup>): Promise<AnimalGroup> {
    const [group] = await db
      .update(animalGroups)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(animalGroups.id, id))
      .returning();
    return group;
  }

  async deleteAnimalGroup(id: string): Promise<void> {
    // Soft delete the group
    await db
      .update(animalGroups)
      .set({ deletedAt: new Date() })
      .where(eq(animalGroups.id, id));
  }

  async addAnimalToGroup(groupId: string, animalId: string, addedBy?: string, notes?: string): Promise<AnimalGroupMember> {
    // Database unique constraint prevents duplicates - no need for application-level check
    const [member] = await db
      .insert(animalGroupMembers)
      .values({ groupId, animalId, addedBy, notes })
      .returning();
    return member;
  }

  async removeAnimalFromGroup(groupId: string, animalId: string): Promise<void> {
    await db
      .delete(animalGroupMembers)
      .where(and(
        eq(animalGroupMembers.groupId, groupId),
        eq(animalGroupMembers.animalId, animalId)
      ));
  }

  async getGroupMembers(groupId: string): Promise<Animal[]> {
    const members = await db
      .select({ animal: animals })
      .from(animalGroupMembers)
      .innerJoin(animals, eq(animalGroupMembers.animalId, animals.id))
      .where(and(
        eq(animalGroupMembers.groupId, groupId),
        sql`${animals.deletedAt} IS NULL`
      ));
    
    return members.map(m => m.animal);
  }

  async getAnimalGroupMemberships(animalId: string): Promise<AnimalGroup[]> {
    const memberships = await db
      .select({ group: animalGroups })
      .from(animalGroupMembers)
      .innerJoin(animalGroups, eq(animalGroupMembers.groupId, animalGroups.id))
      .where(and(
        eq(animalGroupMembers.animalId, animalId),
        sql`${animalGroups.deletedAt} IS NULL`
      ))
      .orderBy(animalGroups.sortOrder, animalGroups.name);
    
    return memberships.map(m => m.group);
  }

  // Bulk membership lookup for efficient client-side filtering (Phase 4.1)
  // Returns lightweight ID pairs for all non-deleted groups
  // TODO: Consider denormalization if herd/group counts exceed 10k animals + 100 groups
  async getAllGroupMembershipPairs(): Promise<{ groupId: string; animalId: string }[]> {
    const result = await db
      .select({
        groupId: animalGroupMembers.groupId,
        animalId: animalGroupMembers.animalId,
      })
      .from(animalGroupMembers)
      .innerJoin(animalGroups, eq(animalGroupMembers.groupId, animalGroups.id))
      .where(sql`${animalGroups.deletedAt} IS NULL`);

    return result;
  }

  // ===== PASTURE MOVEMENTS (Phase 5: Pasture Performance) =====
  
  async getPastureMovements(animalId?: string, pastureId?: string): Promise<PastureMovement[]> {
    const conditions = [];
    
    if (animalId) {
      conditions.push(eq(pastureMovements.animalId, animalId));
    }
    
    if (pastureId) {
      conditions.push(
        or(
          eq(pastureMovements.fromPastureId, pastureId),
          eq(pastureMovements.toPastureId, pastureId)
        )!
      );
    }
    
    const movements = await db
      .select()
      .from(pastureMovements)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(pastureMovements.movedAt));
    
    return movements;
  }

  async getPastureMovement(id: string): Promise<PastureMovement | undefined> {
    const [movement] = await db
      .select()
      .from(pastureMovements)
      .where(eq(pastureMovements.id, id));
    return movement;
  }

  async createPastureMovement(data: InsertPastureMovement): Promise<PastureMovement> {
    const [movement] = await db.insert(pastureMovements).values(data).returning();
    
    // Update animal's current pasture
    await db
      .update(animals)
      .set({ currentPastureId: data.toPastureId })
      .where(eq(animals.id, data.animalId));
    
    // Update pasture stock counts
    if (data.fromPastureId) {
      await db
        .update(pastures)
        .set({ currentStock: sql`${pastures.currentStock} - 1` })
        .where(eq(pastures.id, data.fromPastureId));
    }
    
    await db
      .update(pastures)
      .set({ currentStock: sql`${pastures.currentStock} + 1` })
      .where(eq(pastures.id, data.toPastureId));
    
    return movement;
  }

  async moveanimalsToPasture(animalIds: string[], toPastureId: string, movedBy: string, reason?: string): Promise<PastureMovement[]> {
    const movements: PastureMovement[] = [];
    
    // Get current pasture IDs for all animals in one query
    const animalsData = await db
      .select({ id: animals.id, currentPastureId: animals.currentPastureId })
      .from(animals)
      .where(sql`${animals.id} = ANY(${animalIds})`);
    
    // Count animals by source pasture for efficient updates
    const fromPastureCounts = new Map<string, number>();
    
    for (const animal of animalsData) {
      if (animal.currentPastureId) {
        fromPastureCounts.set(
          animal.currentPastureId,
          (fromPastureCounts.get(animal.currentPastureId) || 0) + 1
        );
      }
      
      // Create movement record
      const [movement] = await db
        .insert(pastureMovements)
        .values({
          animalId: animal.id,
          fromPastureId: animal.currentPastureId,
          toPastureId,
          movedBy,
          reason,
        })
        .returning();
      
      movements.push(movement);
    }
    
    // Bulk update animals' current pasture
    await db
      .update(animals)
      .set({ currentPastureId: toPastureId })
      .where(sql`${animals.id} = ANY(${animalIds})`);
    
    // Update stock counts for source pastures
    for (const [pastureId, count] of Array.from(fromPastureCounts.entries())) {
      await db
        .update(pastures)
        .set({ currentStock: sql`${pastures.currentStock} - ${count}` })
        .where(eq(pastures.id, pastureId));
    }
    
    // Update stock count for destination pasture
    await db
      .update(pastures)
      .set({ currentStock: sql`${pastures.currentStock} + ${animalIds.length}` })
      .where(eq(pastures.id, toPastureId));
    
    return movements;
  }

  // ===== PASTURE HEALTH RECORDS (Phase 5.3) =====
  async getPastureHealthRecords(pastureId: string): Promise<PastureHealthRecord[]> {
    const records = await db
      .select()
      .from(pastureHealthRecords)
      .where(eq(pastureHealthRecords.pastureId, pastureId))
      .orderBy(desc(pastureHealthRecords.recordedAt));
    
    return records;
  }

  async createPastureHealthRecord(data: InsertPastureHealthRecord): Promise<PastureHealthRecord> {
    const [record] = await db
      .insert(pastureHealthRecords)
      .values(data)
      .returning();
    
    return record;
  }

  // ===== ANALYTICS (Phase 5.4) =====
  async getAnalyticsTreatmentActivity(days: number): Promise<{ date: string; count: number }[]> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    
    const result = await db
      .select({
        date: sql<string>`DATE(${treatmentEvents.timestamp})`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(treatmentEvents)
      .where(gte(treatmentEvents.timestamp, sinceDate))
      .groupBy(sql`DATE(${treatmentEvents.timestamp})`)
      .orderBy(sql`DATE(${treatmentEvents.timestamp})`);
    
    return result;
  }

  async getAnalyticsPastureHealthTrends(days: number): Promise<{ date: string; avgGrazingDays: number; avgRestDays: number; avgSoilQuality: number; avgGrassCover: number }[]> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    
    const result = await db
      .select({
        date: sql<string>`DATE(${pastureHealthRecords.recordedAt})`,
        avgGrazingDays: sql<number>`ROUND(AVG(${pastureHealthRecords.grazingDays})::numeric, 1)`,
        avgRestDays: sql<number>`ROUND(AVG(${pastureHealthRecords.restPeriodDays})::numeric, 1)`,
        avgSoilQuality: sql<number>`ROUND(AVG(${pastureHealthRecords.soilQuality})::numeric, 1)`,
        avgGrassCover: sql<number>`ROUND(AVG(${pastureHealthRecords.grassCoverKg})::numeric, 0)`,
      })
      .from(pastureHealthRecords)
      .where(gte(pastureHealthRecords.recordedAt, sinceDate))
      .groupBy(sql`DATE(${pastureHealthRecords.recordedAt})`)
      .orderBy(sql`DATE(${pastureHealthRecords.recordedAt})`);
    
    return result;
  }

  async getAnalyticsMedicineUsage(days: number): Promise<{ date: string; opened: number; emptied: number; meanDaysToEmpty: number }[]> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    
    // Get daily counts of opened and emptied batches
    const result = await db
      .select({
        date: sql<string>`COALESCE(${productBatches.dateOpened}, ${productBatches.emptiedDate})`,
        opened: sql<number>`COUNT(CASE WHEN ${productBatches.dateOpened} >= ${sinceDate.toISOString().split('T')[0]} THEN 1 END)::int`,
        emptied: sql<number>`COUNT(CASE WHEN ${productBatches.emptiedDate} IS NOT NULL AND ${productBatches.emptiedDate} >= ${sinceDate.toISOString().split('T')[0]} THEN 1 END)::int`,
        meanDaysToEmpty: sql<number>`ROUND(AVG(CASE WHEN ${productBatches.emptiedDate} IS NOT NULL THEN DATE(${productBatches.emptiedDate}) - DATE(${productBatches.dateOpened}) END)::numeric, 0)`,
      })
      .from(productBatches)
      .where(
        or(
          gte(sql`${productBatches.dateOpened}`, sinceDate.toISOString().split('T')[0]),
          and(
            sql`${productBatches.emptiedDate} IS NOT NULL`,
            gte(sql`${productBatches.emptiedDate}`, sinceDate.toISOString().split('T')[0])
          )
        )
      )
      .groupBy(sql`COALESCE(${productBatches.dateOpened}, ${productBatches.emptiedDate})`)
      .orderBy(sql`COALESCE(${productBatches.dateOpened}, ${productBatches.emptiedDate})`);
    
    return result;
  }

  async getAnalyticsAnimalMovements(days: number): Promise<{ pastureId: string; pastureName: string; moveCount: number }[]> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    
    const result = await db
      .select({
        pastureId: pastureMovements.toPastureId,
        pastureName: sql<string>`COALESCE(${pastures.name}, 'Unknown')`,
        moveCount: sql<number>`COUNT(*)::int`,
      })
      .from(pastureMovements)
      .leftJoin(pastures, eq(pastureMovements.toPastureId, pastures.id))
      .where(gte(pastureMovements.movedAt, sinceDate))
      .groupBy(pastureMovements.toPastureId, pastures.name)
      .orderBy(desc(sql`COUNT(*)`));
    
    return result;
  }

  async getAnalyticsReproductionMetrics(days: number): Promise<{ heatCount: number; aiCount: number; pregnancyCount: number; calvingCount: number; avgCalvingInterval: number }> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    
    const [metrics] = await db
      .select({
        heatCount: sql<number>`COUNT(CASE WHEN ${reproductionEvents.eventType} = 'heat' THEN 1 END)::int`,
        aiCount: sql<number>`COUNT(CASE WHEN ${reproductionEvents.eventType} = 'ai' THEN 1 END)::int`,
        pregnancyCount: sql<number>`COUNT(CASE WHEN ${reproductionEvents.eventType} = 'pregnancy_check' AND ${reproductionEvents.pregnancyDetails}->>'result' = 'pregnant' THEN 1 END)::int`,
        calvingCount: sql<number>`COUNT(CASE WHEN ${reproductionEvents.eventType} = 'calving' THEN 1 END)::int`,
        avgCalvingInterval: sql<number>`ROUND(AVG(calving_interval)::numeric, 0)`,
      })
      .from(sql`(
        SELECT 
          animal_id,
          event_date,
          LAG(event_date) OVER (PARTITION BY animal_id ORDER BY event_date) as prev_calving_date,
          CASE 
            WHEN LAG(event_date) OVER (PARTITION BY animal_id ORDER BY event_date) IS NOT NULL 
            THEN DATE(event_date) - DATE(LAG(event_date) OVER (PARTITION BY animal_id ORDER BY event_date))
          END as calving_interval
        FROM ${reproductionEvents}
        WHERE event_type = 'calving' AND event_date >= ${sinceDate.toISOString().split('T')[0]}
      ) as calving_intervals`)
      .innerJoin(reproductionEvents, sql`true`);
    
    return metrics || { heatCount: 0, aiCount: 0, pregnancyCount: 0, calvingCount: 0, avgCalvingInterval: 0 };
  }

  // ===== ALERTS =====
  async getActiveAlerts(): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(sql`${alerts.dismissedAt} IS NULL`)
      .orderBy(desc(alerts.createdAt));
  }

  async getAlertsByAnimal(animalId: string): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(and(
        eq(alerts.animalId, animalId),
        sql`${alerts.dismissedAt} IS NULL`
      ))
      .orderBy(desc(alerts.createdAt));
  }

  async getAlerts(filters?: {
    vehicleId?: string;
    type?: string;
    severity?: string;
  }): Promise<Alert[]> {
    try {
      const conditions = [sql`${alerts.dismissedAt} IS NULL`];

      if (filters?.vehicleId) {
        conditions.push(eq(alerts.vehicleId, filters.vehicleId));
      }
      if (filters?.type) {
        conditions.push(sql`${alerts.type} = ${filters.type}`);
      }
      if (filters?.severity) {
        conditions.push(sql`${alerts.severity} = ${filters.severity}`);
      }

      return await db
        .select()
        .from(alerts)
        .where(and(...conditions))
        .orderBy(desc(alerts.createdAt));
    } catch (error) {
      console.error("Error getting alerts:", error);
      throw error;
    }
  }

  async createAlert(data: InsertAlert): Promise<Alert> {
    try {
      const [alert] = await db.insert(alerts).values(data).returning();
      return alert;
    } catch (error) {
      console.error("Error creating alert:", error);
      throw error;
    }
  }

  async dismissAlert(id: string, dismissedBy: string): Promise<Alert> {
    const [alert] = await db
      .update(alerts)
      .set({ dismissedAt: new Date(), dismissedBy })
      .where(eq(alerts.id, id))
      .returning();
    return alert;
  }

  async deleteOldAlerts(daysOld: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    await db
      .delete(alerts)
      .where(lte(alerts.createdAt, cutoffDate));
  }

  // ===== ALERT HELPERS (Phase 2) =====
  private getQuarter(date: Date) {
    return Math.floor(date.getMonth() / 3) + 1;
  }

  private startOfQuarter(date: Date) {
    const q = this.getQuarter(date);
    const startMonth = (q - 1) * 3;
    return new Date(date.getFullYear(), startMonth, 1);
  }

  private endOfQuarter(date: Date) {
    const q = this.getQuarter(date);
    const endMonth = q * 3; // first day of next quarter
    return new Date(date.getFullYear(), endMonth, 0, 23, 59, 59, 999);
  }

  private async upsertAlert(params: {
    type: 'treatment_overdue' | 'mastitis_quarter_repeat' | 'rtv_ready' | 'awaiting_treatment' | 'withholding_ending' | 'monitoring_complete';
    severity: 'low' | 'medium' | 'high' | 'critical';
    animalId?: string | null;
    treatmentId?: string | null;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    const existing = await db
      .select()
      .from(alerts)
      .where(and(
        params.treatmentId ? eq(alerts.treatmentId, params.treatmentId as any) : sql`true`,
        eq(alerts.type, params.type),
        sql`${alerts.dismissedAt} IS NULL`
      ));

    if (existing.length === 0) {
      await db.insert(alerts).values({
        type: params.type,
        severity: params.severity,
        animalId: params.animalId as any,
        treatmentId: params.treatmentId as any,
        title: params.title,
        message: params.message,
        metadata: params.metadata as any,
      }).returning();
    } else {
      // Update message/severity if changed (keep single active alert)
      await db.update(alerts)
        .set({
          severity: params.severity,
          title: params.title,
          message: params.message,
          metadata: params.metadata as any,
        } as any)
        .where(eq(alerts.id, (existing[0] as any).id));
    }
  }

  private async dismissAlertByTypeForTreatment(treatmentId: string, type: Alert['type']) {
    await db
      .update(alerts)
      .set({ dismissedAt: new Date() })
      .where(and(
        eq(alerts.treatmentId, treatmentId as any),
        eq(alerts.type, type as any),
        sql`${alerts.dismissedAt} IS NULL`
      ));
  }

  private parseDate(value?: string | null): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
    
  }

  private hoursSince(date?: string | null): number | null {
    const d = this.parseDate(date);
    if (!d) return null;
    return (Date.now() - d.getTime()) / (1000 * 60 * 60);
  }

  private async getReminderSettings(): Promise<{ treatmentAlertBufferHours: number }> {
    try {
      const settings = await this.getSetting('reminders');
      const buffer = settings?.treatmentAlertBufferHours ?? 0;
      return { treatmentAlertBufferHours: typeof buffer === 'number' ? buffer : 0 };
    } catch {
      return { treatmentAlertBufferHours: 0 };
    }
  }

  // Core: recompute alerts for a single treatment
  async ensureTreatmentAlerts(treatment: AnimalTreatment): Promise<void> {
    const { treatmentAlertBufferHours } = await this.getReminderSettings();
    const animalId = treatment.animalId || null;

    // 1) Awaiting treatment > 24h
    const hoursSinceCreated = this.hoursSince(treatment.dateTime) ?? 0;
    if (treatment.awaitingTreatment && hoursSinceCreated >= 24) {
      await this.upsertAlert({
        type: 'awaiting_treatment',
        severity: 'medium',
        animalId: animalId as any,
        treatmentId: treatment.id as any,
        title: 'Awaiting Treatment',
        message: 'Treatment is awaiting plan for over 24 hours.',
        metadata: { hours: Math.floor(hoursSinceCreated) },
      });
    } else {
      await this.dismissAlertByTypeForTreatment(treatment.id, 'awaiting_treatment');
    }

    // 2) Overdue next dose > 12h (+ buffer)
    const needMoreDoses = (treatment.totalDoses || 1) > (treatment.dosesGiven || 0);
    const hoursSinceLastDose = this.hoursSince(treatment.lastDoseDate);
    const overdueThreshold = 12 + (treatmentAlertBufferHours || 0);
    if (treatment.status === 'active' && needMoreDoses && hoursSinceLastDose !== null && hoursSinceLastDose > overdueThreshold) {
      await this.upsertAlert({
        type: 'treatment_overdue',
        severity: 'high',
        animalId: animalId as any,
        treatmentId: treatment.id as any,
        title: 'Treatment Overdue',
        message: `Next dose overdue by ${Math.floor(hoursSinceLastDose - overdueThreshold)} hours`,
        metadata: { overdueHours: Math.floor(hoursSinceLastDose), threshold: overdueThreshold },
      });
    } else {
      await this.dismissAlertByTypeForTreatment(treatment.id, 'treatment_overdue');
    }

    // 3) RTV Ready: doses complete and withdrawal ended
    const dosesComplete = !needMoreDoses;
    const withdrawalEnd = this.parseDate(treatment.milkWithdrawalEndDate);
    if (dosesComplete && withdrawalEnd && withdrawalEnd.getTime() <= Date.now()) {
      await this.upsertAlert({
        type: 'rtv_ready',
        severity: 'low',
        animalId: animalId as any,
        treatmentId: treatment.id as any,
        title: 'Return to Vat',
        message: 'Milk withholding period ended; cow ready to return to vat.',
      });
    } else {
      await this.dismissAlertByTypeForTreatment(treatment.id, 'rtv_ready');
    }

    // 4) Mastitis third treatment in same quarter (case-insensitive contains "mastitis")
    const cond = (treatment.condition || '').toLowerCase();
    if (cond.includes('mastitis') && treatment.dateTime) {
      const dt = this.parseDate(treatment.dateTime)!;
      const startQ = this.startOfQuarter(dt);
      const endQ = this.endOfQuarter(dt);

      // Gather treatments for this animal within quarter
      const allAnimalTreatments = await this.getAnimalTreatmentsByAnimal(treatment.animalId!);
      const quarterMastitisCount = allAnimalTreatments.filter(t => {
        const tdt = this.parseDate(t.dateTime);
        if (!tdt) return false;
        const inQuarter = tdt >= startQ && tdt <= endQ;
        const isMastitis = (t.condition || '').toLowerCase().includes('mastitis');
        return inQuarter && isMastitis;
      }).length;

      if (quarterMastitisCount >= 3) {
        await this.upsertAlert({
          type: 'mastitis_quarter_repeat',
          severity: 'critical',
          animalId: animalId as any,
          treatmentId: treatment.id as any,
          title: 'Mastitis: 3rd Treatment This Quarter',
          message: 'Animal has received a third mastitis treatment within the current quarter.',
          metadata: { quarter: this.getQuarter(dt), year: dt.getFullYear(), count: quarterMastitisCount },
        });
      } else {
        await this.dismissAlertByTypeForTreatment(treatment.id, 'mastitis_quarter_repeat');
      }
    } else {
      await this.dismissAlertByTypeForTreatment(treatment.id, 'mastitis_quarter_repeat');
    }
  }

  // Recompute alerts for all active treatments (called before responding with /api/alerts)
  async recomputeTreatmentAlerts(): Promise<void> {
    const activeTreatments = await this.getAnimalTreatments('active');
    for (const t of activeTreatments) {
      await this.ensureTreatmentAlerts(t);
    }
  }

  async getAnalyticsPastureRoundLength(): Promise<{ pastureId: string; pastureName: string; roundLengthDays: number; lastRotationDate: string | null }[]> {
    // Calculate round length based on when each pasture was last grazed and how long it took to return to it
    const pasturesList = await this.getPastures();
    const result: { pastureId: string; pastureName: string; roundLengthDays: number; lastRotationDate: string | null }[] = [];

    for (const pasture of pasturesList) {
      // Get movements to this pasture
      const movements = await db.select()
        .from(pastureMovements)
        .where(eq(pastureMovements.toPastureId, pasture.id))
        .orderBy(desc(pastureMovements.movedAt))
        .limit(2);

      if (movements.length >= 2) {
        // Calculate days between last two rotations to this pasture
        const lastMove = new Date(movements[0].movedAt);
        const previousMove = new Date(movements[1].movedAt);
        const roundLength = Math.round((lastMove.getTime() - previousMove.getTime()) / (1000 * 60 * 60 * 24));

        result.push({
          pastureId: pasture.id,
          pastureName: pasture.name,
          roundLengthDays: roundLength,
          lastRotationDate: movements[0].movedAt.toString(),
        });
      } else if (movements.length === 1) {
        // Only one rotation recorded, show days since last move
        const lastMove = new Date(movements[0].movedAt);
        const now = new Date();
        const daysSince = Math.round((now.getTime() - lastMove.getTime()) / (1000 * 60 * 60 * 24));

        result.push({
          pastureId: pasture.id,
          pastureName: pasture.name,
          roundLengthDays: daysSince,
          lastRotationDate: movements[0].movedAt.toString(),
        });
      } else {
        // No movements recorded
        result.push({
          pastureId: pasture.id,
          pastureName: pasture.name,
          roundLengthDays: 0,
          lastRotationDate: null,
        });
      }
    }

    return result;
  }

  async getAnalyticsPastureGrowthEstimate(): Promise<{ pastureId: string; pastureName: string; estimatedGrowthKgPerDay: number; daysRested: number; currentGrassCover: number }[]> {
    // Estimate pasture growth based on rest period and grass cover changes
    const pasturesList = await this.getPastures();
    const result: { pastureId: string; pastureName: string; estimatedGrowthKgPerDay: number; daysRested: number; currentGrassCover: number }[] = [];

    for (const pasture of pasturesList) {
      // Get the last movement OUT of this pasture (when animals left)
      const lastExit = await db.select()
        .from(pastureMovements)
        .where(eq(pastureMovements.fromPastureId, pasture.id))
        .orderBy(desc(pastureMovements.movedAt))
        .limit(1);

      let daysRested = pasture.restPeriodDays || 0;
      let estimatedGrowth = 0;

      if (lastExit.length > 0) {
        // Calculate days since animals left
        const exitDate = new Date(lastExit[0].movedAt);
        const now = new Date();
        daysRested = Math.round((now.getTime() - exitDate.getTime()) / (1000 * 60 * 60 * 24));

        // Estimate growth: average 50-70 kg/ha/day for good conditions, adjusted by soil quality
        const baseGrowth = 60; // kg/ha/day baseline
        const soilFactor = (pasture.soilQuality || 5) / 5; // 0-10 scale, normalize to factor
        estimatedGrowth = baseGrowth * soilFactor;
      }

      result.push({
        pastureId: pasture.id,
        pastureName: pasture.name,
        estimatedGrowthKgPerDay: Math.round(estimatedGrowth * 10) / 10, // Round to 1 decimal
        daysRested: daysRested,
        currentGrassCover: pasture.grassCoverKg || 0,
      });
    }

    return result;
  }

  async createActivityLog(entry: {
    userId?: string | null;
    userName: string;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    details?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    await db.insert(activityLogs).values({
      userId: entry.userId ?? null,
      userName: entry.userName,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      details: entry.details ?? {},
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    });
  }

  // ===== VISITOR MANAGEMENT METHODS (PHASE 1) =====

  async createVisitor(visitor: InsertVisitor): Promise<Visitor> {
    const [newVisitor] = await db.insert(visitors).values(visitor).returning();
    return newVisitor;
  }

  async getVisitorById(id: string): Promise<Visitor | null> {
    const [visitor] = await db.select().from(visitors).where(eq(visitors.id, id));
    return visitor || null;
  }

  async getVisitorByEmail(email: string): Promise<Visitor | null> {
    const [visitor] = await db.select().from(visitors).where(eq(visitors.email, email));
    return visitor || null;
  }

  async getVisitorByPhone(phone: string): Promise<Visitor | null> {
    const [visitor] = await db.select().from(visitors).where(eq(visitors.phone, phone));
    return visitor || null;
  }

  async getAllVisitors(): Promise<Visitor[]> {
    return await db.select().from(visitors).where(eq(visitors.isActive, true));
  }

  async updateVisitor(id: string, updates: Partial<InsertVisitor>): Promise<Visitor | null> {
    const [updatedVisitor] = await db
      .update(visitors)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(visitors.id, id))
      .returning();
    return updatedVisitor || null;
  }

  async createVisitorSignIn(signIn: InsertVisitorSignIn): Promise<VisitorSignIn> {
    const [newSignIn] = await db.insert(visitorSignIns).values(signIn).returning();
    return newSignIn;
  }

  async getVisitorSignInById(id: string): Promise<VisitorSignIn | null> {
    const [signIn] = await db.select().from(visitorSignIns).where(eq(visitorSignIns.id, id));
    return signIn || null;
  }

  async getActiveVisitorSignIns(): Promise<VisitorSignIn[]> {
    return await db
      .select()
      .from(visitorSignIns)
      .where(eq(visitorSignIns.signOutTime, null as any))
      .orderBy(desc(visitorSignIns.signInTime));
  }

  async getVisitorSignInsByVisitor(visitorId: string): Promise<VisitorSignIn[]> {
    return await db
      .select()
      .from(visitorSignIns)
      .where(eq(visitorSignIns.visitorId, visitorId))
      .orderBy(desc(visitorSignIns.signInTime));
  }

  async getVisitorSignInsByDateRange(startDate: Date, endDate: Date): Promise<VisitorSignIn[]> {
    return await db
      .select()
      .from(visitorSignIns)
      .where(
        and(
          gte(visitorSignIns.signInTime, startDate),
          lte(visitorSignIns.signInTime, endDate)
        )
      )
      .orderBy(desc(visitorSignIns.signInTime));
  }

  async signOutVisitor(signInId: string): Promise<VisitorSignIn | null> {
    const [signedOutVisitor] = await db
      .update(visitorSignIns)
      .set({ signOutTime: new Date(), updatedAt: new Date() })
      .where(eq(visitorSignIns.id, signInId))
      .returning();
    return signedOutVisitor || null;
  }

  async createQRCode(qrCode: InsertQRCode): Promise<QRCode> {
    const [newQRCode] = await db.insert(qrCodes).values(qrCode).returning();
    return newQRCode;
  }

  async getQRCodeByCode(code: string): Promise<QRCode | null> {
    const [qrCode] = await db
      .select()
      .from(qrCodes)
      .where(and(eq(qrCodes.code, code), eq(qrCodes.isActive, true)));
    return qrCode || null;
  }

  async getQRCodeById(id: string): Promise<QRCode | null> {
    const [qrCode] = await db.select().from(qrCodes).where(eq(qrCodes.id, id));
    return qrCode || null;
  }

  async getAllQRCodes(): Promise<QRCode[]> {
    return await db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.isActive, true))
      .orderBy(desc(qrCodes.createdAt));
  }

  async updateQRCode(id: string, updates: Partial<InsertQRCode>): Promise<QRCode | null> {
    const [updatedQRCode] = await db
      .update(qrCodes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(qrCodes.id, id))
      .returning();
    return updatedQRCode || null;
  }

  async incrementQRCodeUsage(code: string): Promise<QRCode | null> {
    const [updatedQRCode] = await db
      .update(qrCodes)
      .set({ 
        usageCount: sql`${qrCodes.usageCount} + 1`,
        updatedAt: new Date() 
      })
      .where(eq(qrCodes.code, code))
      .returning();
    return updatedQRCode || null;
  }

  async deactivateQRCode(id: string): Promise<QRCode | null> {
    const [deactivatedQRCode] = await db
      .update(qrCodes)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(qrCodes.id, id))
      .returning();
    return deactivatedQRCode || null;
  }

  async getVisitorStats(): Promise<{
    totalVisitors: number;
    activeVisitors: number;
    totalSignIns: number;
    todaySignIns: number;
  }> {
    const totalVisitors = await db.select().from(visitors);
    const activeVisitors = await db.select().from(visitors).where(eq(visitors.isActive, true));
    const totalSignIns = await db.select().from(visitorSignIns);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todaySignIns = await db
      .select()
      .from(visitorSignIns)
      .where(
        and(
          gte(visitorSignIns.signInTime, today),
          lte(visitorSignIns.signInTime, tomorrow)
        )
      );

    return {
      totalVisitors: totalVisitors.length,
      activeVisitors: activeVisitors.length,
      totalSignIns: totalSignIns.length,
      todaySignIns: todaySignIns.length,
    };
  }

  // ===== GEOSPATIAL MAPPING METHODS =====
  async updatePastureBoundaries(id: string, boundaries: any, centerLat: number, centerLng: number): Promise<Pasture | undefined> {
    try {
      const [pasture] = await db
        .update(pastures)
        .set({ 
          boundaries, 
          centerLatitude: String(centerLat), 
          centerLongitude: String(centerLng),
          updatedAt: new Date()
        })
        .where(eq(pastures.id, id))
        .returning();
      return pasture;
    } catch (error) {
      console.error("Error updating pasture boundaries:", error);
      throw error;
    }
  }

  async getPasturesWithBoundaries(): Promise<Pasture[]> {
    try {
      const pastureList = await db
        .select()
        .from(pastures)
        .where(sql`${pastures.boundaries} IS NOT NULL`);
      return pastureList;
    } catch (error) {
      console.error("Error getting pastures with boundaries:", error);
      throw error;
    }
  }

  async createFarmHazard(hazard: any): Promise<FarmHazard> {
    try {
      const [newHazard] = await db.insert(farmHazards).values(hazard).returning();
      return newHazard;
    } catch (error) {
      console.error("Error creating farm hazard:", error);
      throw error;
    }
  }

  async getFarmHazards(filters?: {
    type?: string;
    severity?: string;
    status?: string;
    latitude?: number;
    longitude?: number;
    radius?: number; // in kilometers
  }): Promise<FarmHazard[]> {
    try {
      const conditions = [];

      if (filters?.type) {
        conditions.push(eq(farmHazards.type, filters.type));
      }
      if (filters?.severity) {
        conditions.push(eq(farmHazards.severity, filters.severity));
      }
      if (filters?.status) {
        conditions.push(eq(farmHazards.status, filters.status));
      }

      // Add spatial filtering if coordinates and radius provided
      if (filters?.latitude && filters?.longitude && filters?.radius) {
        conditions.push(sql`
          (
            6371 * acos(
              cos(radians(${filters.latitude})) * 
              cos(radians(${farmHazards.latitude})) * 
              cos(radians(${farmHazards.longitude}) - radians(${filters.longitude})) + 
              sin(radians(${filters.latitude})) * 
              sin(radians(${farmHazards.latitude}))
            )
          ) <= ${filters.radius}
        `);
      }

      if (conditions.length > 0) {
        return await db.select().from(farmHazards).where(and(...conditions)).orderBy(desc(farmHazards.createdAt));
      }
      
      return await db.select().from(farmHazards).orderBy(desc(farmHazards.createdAt));
    } catch (error) {
      console.error("Error getting farm hazards:", error);
      throw error;
    }
  }

  async updateFarmHazard(id: string, updates: any): Promise<FarmHazard | undefined> {
    try {
      const [hazard] = await db
        .update(farmHazards)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(farmHazards.id, id))
        .returning();
      return hazard;
    } catch (error) {
      console.error("Error updating farm hazard:", error);
      throw error;
    }
  }

  async resolveFarmHazard(id: string, resolvedBy: string): Promise<FarmHazard | undefined> {
    try {
      const [hazard] = await db
        .update(farmHazards)
        .set({ 
          status: 'resolved', 
          resolvedBy, 
          resolvedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(farmHazards.id, id))
        .returning();
      return hazard;
    } catch (error) {
      console.error("Error resolving farm hazard:", error);
      throw error;
    }
  }

  async deleteFarmHazard(id: string): Promise<boolean> {
    try {
      const result = await db.delete(farmHazards).where(eq(farmHazards.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error deleting farm hazard:", error);
      throw error;
    }
  }

  // ===== VEHICLE REGISTRY METHODS =====
  async getVehicleTypes(): Promise<VehicleType[]> {
    try {
      return await db.select().from(vehicleTypes).where(eq(vehicleTypes.isActive, true));
    } catch (error) {
      console.error("Error getting vehicle types:", error);
      throw error;
    }
  }

  async createVehicleType(vehicleType: any): Promise<VehicleType> {
    try {
      const [newVehicleType] = await db.insert(vehicleTypes).values(vehicleType).returning();
      return newVehicleType;
    } catch (error) {
      console.error("Error creating vehicle type:", error);
      throw error;
    }
  }

  async updateVehicleType(id: string, updates: any): Promise<VehicleType | undefined> {
    try {
      const [vehicleType] = await db
        .update(vehicleTypes)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(vehicleTypes.id, id))
        .returning();
      return vehicleType;
    } catch (error) {
      console.error("Error updating vehicle type:", error);
      throw error;
    }
  }

  async deleteVehicleType(id: string): Promise<boolean> {
    try {
      const result = await db
        .update(vehicleTypes)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(vehicleTypes.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error deleting vehicle type:", error);
      throw error;
    }
  }

  async getVehicles(filters?: {
    type?: string;
    status?: string;
    search?: string;
  }): Promise<any[]> {
    try {
      const conditions = [eq(vehicles.isActive, true)];

      if (filters?.type) {
        conditions.push(eq(vehicleTypes.name, filters.type));
      }
      if (filters?.status) {
        conditions.push(eq(vehicles.status, filters.status));
      }
      if (filters?.search) {
        conditions.push(
          sql`(${vehicles.registration} ILIKE ${'%' + filters.search + '%'} OR 
               ${vehicles.make} ILIKE ${'%' + filters.search + '%'} OR 
               ${vehicles.model} ILIKE ${'%' + filters.search + '%'})`
        );
      }

      return await db.select({
        id: vehicles.id,
        registration: vehicles.registration,
        make: vehicles.make,
        model: vehicles.model,
        year: vehicles.year,
        typeId: vehicles.typeId,
        vin: vehicles.vin,
        engineNumber: vehicles.engineNumber,
        color: vehicles.color,
        fuelType: vehicles.fuelType,
        odometerReading: vehicles.odometerReading,
        purchaseDate: vehicles.purchaseDate,
        purchasePrice: vehicles.purchasePrice,
        currentOwner: vehicles.currentOwner,
        insuranceCompany: vehicles.insuranceCompany,
        insurancePolicyNumber: vehicles.insurancePolicyNumber,
        insuranceExpiry: vehicles.insuranceExpiry,
        registrationExpiry: vehicles.registrationExpiry,
        wofExpiry: vehicles.wofExpiry,
        cofExpiry: vehicles.cofExpiry,
        rucExpiry: vehicles.rucExpiry,
        lastServiceDate: vehicles.lastServiceDate,
        nextServiceDue: vehicles.nextServiceDue,
        lastWofDate: vehicles.lastWofDate,
        lastCofDate: vehicles.lastCofDate,
        lastRucDate: vehicles.lastRucDate,
        status: vehicles.status,
        location: vehicles.location,
        assignedTo: vehicles.assignedTo,
        notes: vehicles.notes,
        isActive: vehicles.isActive,
        createdAt: vehicles.createdAt,
        updatedAt: vehicles.updatedAt,
        typeName: vehicleTypes.name,
        typeCategory: vehicleTypes.category,
      })
      .from(vehicles)
      .leftJoin(vehicleTypes, eq(vehicles.typeId, vehicleTypes.id))
      .where(and(...conditions))
      .orderBy(desc(vehicles.createdAt));
    } catch (error) {
      console.error("Error getting vehicles:", error);
      throw error;
    }
  }

  async getVehicleById(id: string): Promise<any> {
    try {
      const [vehicle] = await db
        .select({
          id: vehicles.id,
          registration: vehicles.registration,
          make: vehicles.make,
          model: vehicles.model,
          year: vehicles.year,
          typeId: vehicles.typeId,
          vin: vehicles.vin,
          engineNumber: vehicles.engineNumber,
          color: vehicles.color,
          fuelType: vehicles.fuelType,
          odometerReading: vehicles.odometerReading,
          purchaseDate: vehicles.purchaseDate,
          purchasePrice: vehicles.purchasePrice,
          currentOwner: vehicles.currentOwner,
          insuranceCompany: vehicles.insuranceCompany,
          insurancePolicyNumber: vehicles.insurancePolicyNumber,
          insuranceExpiry: vehicles.insuranceExpiry,
          registrationExpiry: vehicles.registrationExpiry,
          wofExpiry: vehicles.wofExpiry,
          cofExpiry: vehicles.cofExpiry,
          rucExpiry: vehicles.rucExpiry,
          lastServiceDate: vehicles.lastServiceDate,
          nextServiceDue: vehicles.nextServiceDue,
          lastWofDate: vehicles.lastWofDate,
          lastCofDate: vehicles.lastCofDate,
          lastRucDate: vehicles.lastRucDate,
          status: vehicles.status,
          location: vehicles.location,
          assignedTo: vehicles.assignedTo,
          notes: vehicles.notes,
          isActive: vehicles.isActive,
          createdAt: vehicles.createdAt,
          updatedAt: vehicles.updatedAt,
          typeName: vehicleTypes.name,
          typeCategory: vehicleTypes.category,
        })
        .from(vehicles)
        .leftJoin(vehicleTypes, eq(vehicles.typeId, vehicleTypes.id))
        .where(eq(vehicles.id, id));
      return vehicle;
    } catch (error) {
      console.error("Error getting vehicle by ID:", error);
      throw error;
    }
  }

  async createVehicle(vehicle: any): Promise<Vehicle> {
    try {
      const [newVehicle] = await db.insert(vehicles).values(vehicle).returning();
      return newVehicle;
    } catch (error) {
      console.error("Error creating vehicle:", error);
      throw error;
    }
  }

  async updateVehicle(id: string, updates: any): Promise<Vehicle | undefined> {
    try {
      const [vehicle] = await db
        .update(vehicles)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(vehicles.id, id))
        .returning();
      return vehicle;
    } catch (error) {
      console.error("Error updating vehicle:", error);
      throw error;
    }
  }

  async deleteVehicle(id: string): Promise<boolean> {
    try {
      const result = await db
        .update(vehicles)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(vehicles.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      throw error;
    }
  }

  async getVehicleInspections(vehicleId: string, filters?: {
    status?: string;
    limit?: number;
  }): Promise<VehicleInspection[]> {
    try {
      const conditions = [eq(vehicleInspections.vehicleId, vehicleId)];
      
      if (filters?.status) {
        conditions.push(eq(vehicleInspections.overallStatus, filters.status));
      }

      const query = db.select().from(vehicleInspections)
        .where(and(...conditions))
        .orderBy(desc(vehicleInspections.inspectionDate));

      if (filters?.limit) {
        return await query.limit(filters.limit);
      }

      return await query;
    } catch (error) {
      console.error("Error getting vehicle inspections:", error);
      throw error;
    }
  }

  async createVehicleInspection(inspection: any): Promise<VehicleInspection> {
    try {
      const [newInspection] = await db.insert(vehicleInspections).values(inspection).returning();
      return newInspection;
    } catch (error) {
      console.error("Error creating vehicle inspection:", error);
      throw error;
    }
  }

  async getVehicleInspectionById(id: string): Promise<VehicleInspection | undefined> {
    try {
      const [inspection] = await db
        .select()
        .from(vehicleInspections)
        .where(eq(vehicleInspections.id, id));
      return inspection;
    } catch (error) {
      console.error("Error getting vehicle inspection by ID:", error);
      throw error;
    }
  }

  async updateVehicleInspection(id: string, updates: any): Promise<VehicleInspection | undefined> {
    try {
      const [inspection] = await db
        .update(vehicleInspections)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(vehicleInspections.id, id))
        .returning();
      return inspection;
    } catch (error) {
      console.error("Error updating vehicle inspection:", error);
      throw error;
    }
  }

  async getVehicleInspectionResults(inspectionId: string): Promise<VehicleInspectionResult[]> {
    try {
      return await db
        .select()
        .from(vehicleInspectionResults)
        .where(eq(vehicleInspectionResults.inspectionId, inspectionId))
        .orderBy(vehicleInspectionResults.createdAt);
    } catch (error) {
      console.error("Error getting vehicle inspection results:", error);
      throw error;
    }
  }

  async createVehicleInspectionResult(result: any): Promise<VehicleInspectionResult> {
    try {
      const [newResult] = await db.insert(vehicleInspectionResults).values(result).returning();
      return newResult;
    } catch (error) {
      console.error("Error creating vehicle inspection result:", error);
      throw error;
    }
  }

  async getVehicleMaintenanceRecords(vehicleId: string, filters?: {
    type?: string;
    limit?: number;
  }): Promise<VehicleMaintenanceRecord[]> {
    try {
      const conditions = [eq(vehicleMaintenanceRecords.vehicleId, vehicleId)];

      if (filters?.type) {
        conditions.push(eq(vehicleMaintenanceRecords.type, filters.type));
      }

      const query = db.select().from(vehicleMaintenanceRecords)
        .where(and(...conditions))
        .orderBy(desc(vehicleMaintenanceRecords.performedDate));

      if (filters?.limit) {
        return await query.limit(filters.limit);
      }

      return await query;
    } catch (error) {
      console.error("Error getting vehicle maintenance records:", error);
      throw error;
    }
  }

  async createVehicleMaintenanceRecord(record: any): Promise<VehicleMaintenanceRecord> {
    try {
      const [newRecord] = await db.insert(vehicleMaintenanceRecords).values(record).returning();
      return newRecord;
    } catch (error) {
      console.error("Error creating vehicle maintenance record:", error);
      throw error;
    }
  }

  async getVehicleStats(): Promise<{
    total: number;
    active: number;
    needsInspection: number;
    overdueInspection: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    try {
      const allVehicles = await db.select().from(vehicles).where(eq(vehicles.isActive, true));
      const today = new Date();
      
      const stats = {
        total: allVehicles.length,
        active: allVehicles.filter(v => v.status === 'active').length,
        needsInspection: 0,
        overdueInspection: 0,
        byType: {} as Record<string, number>,
        byStatus: {} as Record<string, number>,
      };

      // Calculate inspection needs
      for (const vehicle of allVehicles) {
        if (vehicle.nextServiceDue) {
          const nextService = new Date(vehicle.nextServiceDue);
          const daysUntil = Math.ceil((nextService.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntil < 0) {
            stats.overdueInspection++;
          } else if (daysUntil <= 7) {
            stats.needsInspection++;
          }
        }

        // Count by type and status
        const typeKey = vehicle.typeId || 'unknown';
        stats.byType[typeKey] = (stats.byType[typeKey] || 0) + 1;
        stats.byStatus[vehicle.status] = (stats.byStatus[vehicle.status] || 0) + 1;
      }

      return stats;
    } catch (error) {
      console.error("Error getting vehicle stats:", error);
      throw error;
    }
  }

  async getUpcomingInspections(days: number): Promise<Array<{
    vehicle: Vehicle;
    nextInspectionDate: string;
    daysUntil: number;
  }>> {
    try {
      const allVehicles = await this.getVehicles();
      const today = new Date();
      const cutoffDate = new Date(today.getTime() + (days * 24 * 60 * 60 * 1000));
      
      const upcoming = [];
      
      for (const vehicle of allVehicles) {
        if (vehicle.nextServiceDue) {
          const nextService = new Date(vehicle.nextServiceDue);
          if (nextService <= cutoffDate && nextService >= today) {
            const daysUntil = Math.ceil((nextService.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            upcoming.push({
              vehicle,
              nextInspectionDate: vehicle.nextServiceDue,
              daysUntil,
            });
          }
        }
      }

      return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
    } catch (error) {
      console.error("Error getting upcoming inspections:", error);
      throw error;
    }
  }

  // ===== STOCK TRANSACTIONS =====
  async getStockTransactions(filters?: {
    type?: string;
    startDate?: string;
    endDate?: string;
  }, limit: number = 50): Promise<StockTransaction[]> {
    try {
      const conditions = [];
      
      if (filters?.type) {
        conditions.push(sql`${stockTransactions.type} = ${filters.type}`);
      }
      if (filters?.startDate) {
        conditions.push(sql`${stockTransactions.date} >= ${filters.startDate}`);
      }
      if (filters?.endDate) {
        conditions.push(sql`${stockTransactions.date} <= ${filters.endDate}`);
      }

      let query = db.select().from(stockTransactions);
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      return await query.orderBy(desc(stockTransactions.date)).limit(limit);
    } catch (error) {
      console.error("Error getting stock transactions:", error);
      throw error;
    }
  }

  async getStockTransactionById(id: string): Promise<StockTransaction | undefined> {
    try {
      const [transaction] = await db
        .select()
        .from(stockTransactions)
        .where(eq(stockTransactions.id, id));
      return transaction;
    } catch (error) {
      console.error("Error getting stock transaction:", error);
      throw error;
    }
  }

  async createStockTransaction(data: InsertStockTransaction): Promise<StockTransaction> {
    try {
      const [transaction] = await db.insert(stockTransactions).values(data).returning();
      return transaction;
    } catch (error) {
      console.error("Error creating stock transaction:", error);
      throw error;
    }
  }

  async updateStockTransaction(id: string, data: Partial<InsertStockTransaction>): Promise<StockTransaction | undefined> {
    try {
      const [transaction] = await db
        .update(stockTransactions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(stockTransactions.id, id))
        .returning();
      return transaction;
    } catch (error) {
      console.error("Error updating stock transaction:", error);
      throw error;
    }
  }

  async deleteStockTransaction(id: string): Promise<boolean> {
    try {
      const result = await db.delete(stockTransactions).where(eq(stockTransactions.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error deleting stock transaction:", error);
      throw error;
    }
  }

  // ===== TASK PINS (Phase 3) =====
  async getTaskPins(filters?: {
    status?: string;
    priority?: string;
    category?: string;
    pastureId?: string;
    assignedTo?: string;
  }): Promise<TaskPin[]> {
    try {
      const conditions = [];
      
      if (filters?.status) {
        conditions.push(sql`${taskPins.status} = ${filters.status}`);
      }
      if (filters?.priority) {
        conditions.push(sql`${taskPins.priority} = ${filters.priority}`);
      }
      if (filters?.category) {
        conditions.push(eq(taskPins.category, filters.category));
      }
      if (filters?.pastureId) {
        conditions.push(eq(taskPins.pastureId, filters.pastureId));
      }
      if (filters?.assignedTo) {
        conditions.push(eq(taskPins.assignedTo, filters.assignedTo));
      }

      if (conditions.length > 0) {
        return await db.select().from(taskPins).where(and(...conditions)).orderBy(desc(taskPins.createdAt));
      }
      
      return await db.select().from(taskPins).orderBy(desc(taskPins.createdAt));
    } catch (error) {
      console.error("Error getting task pins:", error);
      throw error;
    }
  }

  async getTaskPinById(id: string): Promise<TaskPin | undefined> {
    try {
      const [pin] = await db.select().from(taskPins).where(eq(taskPins.id, id));
      return pin;
    } catch (error) {
      console.error("Error getting task pin:", error);
      throw error;
    }
  }

  async createTaskPin(data: InsertTaskPin): Promise<TaskPin> {
    try {
      const [pin] = await db.insert(taskPins).values(data).returning();
      return pin;
    } catch (error) {
      console.error("Error creating task pin:", error);
      throw error;
    }
  }

  async updateTaskPin(id: string, data: Partial<InsertTaskPin>): Promise<TaskPin | undefined> {
    try {
      const [pin] = await db
        .update(taskPins)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(taskPins.id, id))
        .returning();
      return pin;
    } catch (error) {
      console.error("Error updating task pin:", error);
      throw error;
    }
  }

  async completeTaskPin(id: string, completedBy: string, notes?: string): Promise<TaskPin | undefined> {
    try {
      const [pin] = await db
        .update(taskPins)
        .set({ 
          status: 'completed',
          completedAt: new Date(),
          completedBy,
          notes: notes || undefined,
          updatedAt: new Date()
        })
        .where(eq(taskPins.id, id))
        .returning();
      return pin;
    } catch (error) {
      console.error("Error completing task pin:", error);
      throw error;
    }
  }

  async deleteTaskPin(id: string): Promise<boolean> {
    try {
      const result = await db.delete(taskPins).where(eq(taskPins.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error deleting task pin:", error);
      throw error;
    }
  }

  async getTaskPinsNearby(lat: number, lng: number, radiusKm: number): Promise<TaskPin[]> {
    try {
      // Use Haversine formula to find pins within radius
      return await db.select().from(taskPins).where(
        sql`(
          6371 * acos(
            cos(radians(${lat})) * 
            cos(radians(CAST(${taskPins.latitude} AS FLOAT))) * 
            cos(radians(CAST(${taskPins.longitude} AS FLOAT)) - radians(${lng})) + 
            sin(radians(${lat})) * 
            sin(radians(CAST(${taskPins.latitude} AS FLOAT)))
          )
        ) <= ${radiusKm}`
      ).orderBy(desc(taskPins.createdAt));
    } catch (error) {
      console.error("Error getting nearby task pins:", error);
      throw error;
    }
  }

  // ===== FINANCIAL METHODS (Phase 4) =====
  
  // Expenses
  async getExpenses(filters?: {
    category?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<Expense[]> {
    try {
      const conditions = [];
      
      if (filters?.category) {
        conditions.push(sql`${expenses.category} = ${filters.category}`);
      }
      if (filters?.startDate) {
        conditions.push(sql`${expenses.date} >= ${filters.startDate}`);
      }
      if (filters?.endDate) {
        conditions.push(sql`${expenses.date} <= ${filters.endDate}`);
      }

      let query = db.select().from(expenses);
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      query = query.orderBy(desc(expenses.date)) as any;
      
      if (filters?.limit) {
        query = query.limit(filters.limit) as any;
      }

      return await query;
    } catch (error) {
      console.error("Error getting expenses:", error);
      throw error;
    }
  }

  async getExpenseSummary(startDate?: string, endDate?: string): Promise<any> {
    try {
      const conditions = [];
      if (startDate) conditions.push(sql`${expenses.date} >= ${startDate}`);
      if (endDate) conditions.push(sql`${expenses.date} <= ${endDate}`);

      const result = await db.select({
        category: expenses.category,
        total: sql<string>`SUM(CAST(${expenses.amount} AS DECIMAL))`,
        count: sql<number>`COUNT(*)`,
      })
      .from(expenses)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(expenses.category);

      const byCategory = result.reduce((acc: any, row) => {
        acc[row.category] = { total: parseFloat(row.total || '0'), count: row.count };
        return acc;
      }, {});

      const total = result.reduce((sum, row) => sum + parseFloat(row.total || '0'), 0);

      return { byCategory, total };
    } catch (error) {
      console.error("Error getting expense summary:", error);
      throw error;
    }
  }

  async getExpenseById(id: string): Promise<Expense | undefined> {
    try {
      const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
      return expense;
    } catch (error) {
      console.error("Error getting expense:", error);
      throw error;
    }
  }

  async createExpense(data: InsertExpense): Promise<Expense> {
    try {
      const [expense] = await db.insert(expenses).values(data).returning();
      return expense;
    } catch (error) {
      console.error("Error creating expense:", error);
      throw error;
    }
  }

  async updateExpense(id: string, data: Partial<InsertExpense>): Promise<Expense | undefined> {
    try {
      const [expense] = await db
        .update(expenses)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(expenses.id, id))
        .returning();
      return expense;
    } catch (error) {
      console.error("Error updating expense:", error);
      throw error;
    }
  }

  async deleteExpense(id: string): Promise<boolean> {
    try {
      const result = await db.delete(expenses).where(eq(expenses.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error deleting expense:", error);
      throw error;
    }
  }

  // Killsheets
  async getKillsheets(filters?: {
    startDate?: string;
    endDate?: string;
    processor?: string;
    paymentReceived?: boolean;
    limit?: number;
  }): Promise<Killsheet[]> {
    try {
      const conditions = [];
      
      if (filters?.startDate) {
        conditions.push(sql`${killsheets.date} >= ${filters.startDate}`);
      }
      if (filters?.endDate) {
        conditions.push(sql`${killsheets.date} <= ${filters.endDate}`);
      }
      if (filters?.processor) {
        conditions.push(eq(killsheets.processorName, filters.processor));
      }
      if (filters?.paymentReceived !== undefined) {
        conditions.push(eq(killsheets.paymentReceived, filters.paymentReceived));
      }

      let query = db.select().from(killsheets);
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      query = query.orderBy(desc(killsheets.date)) as any;
      
      if (filters?.limit) {
        query = query.limit(filters.limit) as any;
      }

      return await query;
    } catch (error) {
      console.error("Error getting killsheets:", error);
      throw error;
    }
  }

  async getKillsheetSummary(startDate?: string, endDate?: string): Promise<any> {
    try {
      const conditions = [];
      if (startDate) conditions.push(sql`${killsheets.date} >= ${startDate}`);
      if (endDate) conditions.push(sql`${killsheets.date} <= ${endDate}`);

      const result = await db.select({
        totalAnimals: sql<number>`SUM(${killsheets.animalCount})`,
        totalCarcassWeight: sql<string>`SUM(CAST(${killsheets.totalCarcassWeight} AS DECIMAL))`,
        totalValue: sql<string>`SUM(CAST(${killsheets.totalValue} AS DECIMAL))`,
        totalNetPayment: sql<string>`SUM(CAST(${killsheets.netPayment} AS DECIMAL))`,
        count: sql<number>`COUNT(*)`,
      })
      .from(killsheets)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

      return {
        totalAnimals: result[0]?.totalAnimals || 0,
        totalCarcassWeight: parseFloat(result[0]?.totalCarcassWeight || '0'),
        totalValue: parseFloat(result[0]?.totalValue || '0'),
        totalNetPayment: parseFloat(result[0]?.totalNetPayment || '0'),
        count: result[0]?.count || 0,
      };
    } catch (error) {
      console.error("Error getting killsheet summary:", error);
      throw error;
    }
  }

  async getKillsheetById(id: string): Promise<Killsheet | undefined> {
    try {
      const [killsheet] = await db.select().from(killsheets).where(eq(killsheets.id, id));
      return killsheet;
    } catch (error) {
      console.error("Error getting killsheet:", error);
      throw error;
    }
  }

  async getKillsheetItems(killsheetId: string): Promise<KillsheetItem[]> {
    try {
      return await db.select().from(killsheetItems).where(eq(killsheetItems.killsheetId, killsheetId));
    } catch (error) {
      console.error("Error getting killsheet items:", error);
      throw error;
    }
  }

  async createKillsheet(data: InsertKillsheet): Promise<Killsheet> {
    try {
      const [killsheet] = await db.insert(killsheets).values(data).returning();
      return killsheet;
    } catch (error) {
      console.error("Error creating killsheet:", error);
      throw error;
    }
  }

  async updateKillsheet(id: string, data: Partial<InsertKillsheet>): Promise<Killsheet | undefined> {
    try {
      const [killsheet] = await db
        .update(killsheets)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(killsheets.id, id))
        .returning();
      return killsheet;
    } catch (error) {
      console.error("Error updating killsheet:", error);
      throw error;
    }
  }

  async markKillsheetPaymentReceived(id: string, paymentDate?: string): Promise<Killsheet | undefined> {
    try {
      const [killsheet] = await db
        .update(killsheets)
        .set({ 
          paymentReceived: true, 
          paymentDate: paymentDate || new Date().toISOString().split('T')[0],
          updatedAt: new Date() 
        })
        .where(eq(killsheets.id, id))
        .returning();
      return killsheet;
    } catch (error) {
      console.error("Error marking killsheet payment received:", error);
      throw error;
    }
  }

  async deleteKillsheet(id: string): Promise<boolean> {
    try {
      // Delete items first
      await db.delete(killsheetItems).where(eq(killsheetItems.killsheetId, id));
      const result = await db.delete(killsheets).where(eq(killsheets.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error deleting killsheet:", error);
      throw error;
    }
  }

  async createKillsheetItem(data: InsertKillsheetItem): Promise<KillsheetItem> {
    try {
      const [item] = await db.insert(killsheetItems).values(data).returning();
      return item;
    } catch (error) {
      console.error("Error creating killsheet item:", error);
      throw error;
    }
  }

  async deleteKillsheetItem(id: string): Promise<boolean> {
    try {
      const result = await db.delete(killsheetItems).where(eq(killsheetItems.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error deleting killsheet item:", error);
      throw error;
    }
  }

  // ===== MILK PRODUCTION METHODS (Phase 5) =====
  
  // Milk Records
  async getMilkRecords(filters?: {
    startDate?: string;
    endDate?: string;
    herdId?: string;
    limit?: number;
  }): Promise<MilkRecord[]> {
    try {
      const conditions = [];
      
      if (filters?.startDate) {
        conditions.push(sql`${milkRecords.date} >= ${filters.startDate}`);
      }
      if (filters?.endDate) {
        conditions.push(sql`${milkRecords.date} <= ${filters.endDate}`);
      }
      if (filters?.herdId) {
        conditions.push(eq(milkRecords.herdId, filters.herdId));
      }

      let query = db.select().from(milkRecords);
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      query = query.orderBy(desc(milkRecords.date)) as any;
      
      if (filters?.limit) {
        query = query.limit(filters.limit) as any;
      }

      return await query;
    } catch (error) {
      console.error("Error getting milk records:", error);
      throw error;
    }
  }

  async getMilkSummary(startDate?: string, endDate?: string, period?: string): Promise<any> {
    try {
      const conditions = [];
      if (startDate) conditions.push(sql`${milkRecords.date} >= ${startDate}`);
      if (endDate) conditions.push(sql`${milkRecords.date} <= ${endDate}`);

      const result = await db.select({
        totalVolume: sql<string>`SUM(CAST(${milkRecords.totalVolume} AS DECIMAL))`,
        averageFat: sql<string>`AVG(CAST(${milkRecords.averageFat} AS DECIMAL))`,
        averageProtein: sql<string>`AVG(CAST(${milkRecords.averageProtein} AS DECIMAL))`,
        averageScc: sql<string>`AVG(CAST(${milkRecords.averageSomaticCellCount} AS DECIMAL))`,
        totalValue: sql<string>`SUM(CAST(${milkRecords.totalValue} AS DECIMAL))`,
        recordCount: sql<number>`COUNT(*)`,
        averageVolume: sql<string>`AVG(CAST(${milkRecords.totalVolume} AS DECIMAL))`,
      })
      .from(milkRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

      const summary = result[0] || {};
      
      return {
        totalVolume: parseFloat(summary.totalVolume || '0'),
        averageFat: parseFloat(summary.averageFat || '0'),
        averageProtein: parseFloat(summary.averageProtein || '0'),
        averageScc: parseFloat(summary.averageScc || '0'),
        totalValue: parseFloat(summary.totalValue || '0'),
        recordCount: summary.recordCount || 0,
        averageVolume: parseFloat(summary.averageVolume || '0'),
        period: period || 'all',
      };
    } catch (error) {
      console.error("Error getting milk summary:", error);
      throw error;
    }
  }

  async getMilkTrends(days: number = 30): Promise<any[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      return await db.select({
        date: milkRecords.date,
        volume: sql<string>`CAST(${milkRecords.totalVolume} AS DECIMAL)`,
        fat: sql<string>`CAST(${milkRecords.averageFat} AS DECIMAL)`,
        protein: sql<string>`CAST(${milkRecords.averageProtein} AS DECIMAL)`,
        scc: sql<string>`CAST(${milkRecords.averageSomaticCellCount} AS DECIMAL)`,
        value: sql<string>`CAST(${milkRecords.totalValue} AS DECIMAL)`,
      })
      .from(milkRecords)
      .where(sql`${milkRecords.date} >= ${startDate.toISOString().split('T')[0]}`)
      .orderBy(milkRecords.date);
    } catch (error) {
      console.error("Error getting milk trends:", error);
      throw error;
    }
  }

  async getMilkRecordById(id: string): Promise<MilkRecord | undefined> {
    try {
      const [record] = await db.select().from(milkRecords).where(eq(milkRecords.id, id));
      return record;
    } catch (error) {
      console.error("Error getting milk record:", error);
      throw error;
    }
  }

  async createMilkRecord(data: InsertMilkRecord): Promise<MilkRecord> {
    try {
      const [record] = await db.insert(milkRecords).values(data).returning();
      return record;
    } catch (error) {
      console.error("Error creating milk record:", error);
      throw error;
    }
  }

  async updateMilkRecord(id: string, data: Partial<InsertMilkRecord>): Promise<MilkRecord | undefined> {
    try {
      const [record] = await db
        .update(milkRecords)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(milkRecords.id, id))
        .returning();
      return record;
    } catch (error) {
      console.error("Error updating milk record:", error);
      throw error;
    }
  }

  async deleteMilkRecord(id: string): Promise<boolean> {
    try {
      const result = await db.delete(milkRecords).where(eq(milkRecords.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error deleting milk record:", error);
      throw error;
    }
  }

  // Milk Quality Alerts
  async getMilkQualityAlerts(filters?: {
    acknowledged?: boolean;
    severity?: string;
    limit?: number;
  }): Promise<MilkQualityAlert[]> {
    try {
      const conditions = [];
      
      if (filters?.acknowledged !== undefined) {
        conditions.push(eq(milkQualityAlerts.acknowledged, filters.acknowledged));
      }
      if (filters?.severity) {
        conditions.push(eq(milkQualityAlerts.severity, filters.severity));
      }

      let query = db.select().from(milkQualityAlerts);
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      query = query.orderBy(desc(milkQualityAlerts.date)) as any;
      
      if (filters?.limit) {
        query = query.limit(filters.limit) as any;
      }

      return await query;
    } catch (error) {
      console.error("Error getting milk quality alerts:", error);
      throw error;
    }
  }

  async acknowledgeMilkQualityAlert(id: string, userId: string): Promise<MilkQualityAlert | undefined> {
    try {
      const [alert] = await db
        .update(milkQualityAlerts)
        .set({ 
          acknowledged: true, 
          acknowledgedBy: userId,
          acknowledgedAt: new Date(),
        })
        .where(eq(milkQualityAlerts.id, id))
        .returning();
      return alert;
    } catch (error) {
      console.error("Error acknowledging milk quality alert:", error);
      throw error;
    }
  }

  async checkMilkQuality(record: MilkRecord): Promise<void> {
    try {
      const alerts = [];
      
      // Check Somatic Cell Count
      if (record.averageSomaticCellCount && parseFloat(record.averageSomaticCellCount) > 400000) {
        alerts.push({
          date: record.date,
          alertType: 'high_scc',
          severity: parseFloat(record.averageSomaticCellCount) > 750000 ? 'critical' : 'high',
          message: `High somatic cell count: ${record.averageSomaticCellCount} cells/ml`,
          value: record.averageSomaticCellCount,
          threshold: '400000',
          milkRecordId: record.id,
        });
      }
      
      // Check Fat Content
      if (record.averageFat && parseFloat(record.averageFat) < 3.5) {
        alerts.push({
          date: record.date,
          alertType: 'low_fat',
          severity: parseFloat(record.averageFat) < 3.0 ? 'high' : 'medium',
          message: `Low fat content: ${record.averageFat}%`,
          value: record.averageFat,
          threshold: '3.5',
          milkRecordId: record.id,
        });
      }
      
      // Check Protein Content
      if (record.averageProtein && parseFloat(record.averageProtein) < 3.0) {
        alerts.push({
          date: record.date,
          alertType: 'low_protein',
          severity: parseFloat(record.averageProtein) < 2.8 ? 'high' : 'medium',
          message: `Low protein content: ${record.averageProtein}%`,
          value: record.averageProtein,
          threshold: '3.0',
          milkRecordId: record.id,
        });
      }
      
      // Check Temperature
      if (record.temperature && parseFloat(record.temperature) > 8) {
        alerts.push({
          date: record.date,
          alertType: 'temperature',
          severity: parseFloat(record.temperature) > 12 ? 'critical' : 'high',
          message: `High milk temperature: ${record.temperature}°C`,
          value: record.temperature,
          threshold: '8',
          milkRecordId: record.id,
        });
      }
      
      // Insert alerts
      for (const alert of alerts) {
        await db.insert(milkQualityAlerts).values(alert);
      }
    } catch (error) {
      console.error("Error checking milk quality:", error);
      throw error;
    }
  }

  // Milk Analytics
  async getMilkQualityAnalytics(startDate?: string, endDate?: string): Promise<any> {
    try {
      const conditions = [];
      if (startDate) conditions.push(sql`${milkRecords.date} >= ${startDate}`);
      if (endDate) conditions.push(sql`${milkRecords.date} <= ${endDate}`);

      const result = await db.select({
        avgFat: sql<string>`AVG(CAST(${milkRecords.averageFat} AS DECIMAL))`,
        avgProtein: sql<string>`AVG(CAST(${milkRecords.averageProtein} AS DECIMAL))`,
        avgScc: sql<string>`AVG(CAST(${milkRecords.averageSomaticCellCount} AS DECIMAL))`,
        maxScc: sql<string>`MAX(CAST(${milkRecords.averageSomaticCellCount} AS DECIMAL))`,
        minFat: sql<string>`MIN(CAST(${milkRecords.averageFat} AS DECIMAL))`,
        maxFat: sql<string>`MAX(CAST(${milkRecords.averageFat} AS DECIMAL))`,
        minProtein: sql<string>`MIN(CAST(${milkRecords.averageProtein} AS DECIMAL))`,
        maxProtein: sql<string>`MAX(CAST(${milkRecords.averageProtein} AS DECIMAL))`,
      })
      .from(milkRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

      return {
        average: {
          fat: parseFloat(result[0]?.avgFat || '0'),
          protein: parseFloat(result[0]?.avgProtein || '0'),
          somaticCellCount: parseFloat(result[0]?.avgScc || '0'),
        },
        range: {
          fat: {
            min: parseFloat(result[0]?.minFat || '0'),
            max: parseFloat(result[0]?.maxFat || '0'),
          },
          protein: {
            min: parseFloat(result[0]?.minProtein || '0'),
            max: parseFloat(result[0]?.maxProtein || '0'),
          },
        },
        somaticCellCount: {
          average: parseFloat(result[0]?.avgScc || '0'),
          maximum: parseFloat(result[0]?.maxScc || '0'),
        },
      };
    } catch (error) {
      console.error("Error getting milk quality analytics:", error);
      throw error;
    }
  }

  async getMilkEfficiencyAnalytics(startDate?: string, endDate?: string): Promise<any> {
    try {
      const conditions = [];
      if (startDate) conditions.push(sql`${milkRecords.date} >= ${startDate}`);
      if (endDate) conditions.push(sql`${milkRecords.date} <= ${endDate}`);

      const result = await db.select({
        totalVolume: sql<string>`SUM(CAST(${milkRecords.totalVolume} AS DECIMAL))`,
        totalValue: sql<string>`SUM(CAST(${milkRecords.totalValue} AS DECIMAL))`,
        avgVolume: sql<string>`AVG(CAST(${milkRecords.totalVolume} AS DECIMAL))`,
        avgPrice: sql<string>`AVG(CAST(${milkRecords.milkPrice} AS DECIMAL))`,
        recordCount: sql<number>`COUNT(*)`,
      })
      .from(milkRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

      const totalVolume = parseFloat(result[0]?.totalVolume || '0');
      const totalValue = parseFloat(result[0]?.totalValue || '0');
      const avgVolume = parseFloat(result[0]?.avgVolume || '0');
      const avgPrice = parseFloat(result[0]?.avgPrice || '0');

      return {
        totalVolume,
        totalValue,
        averageVolume: avgVolume,
        averagePrice: avgPrice,
        recordCount: result[0]?.recordCount || 0,
        pricePerLitre: totalVolume > 0 ? totalValue / totalVolume : 0,
        dailyAverage: result[0]?.recordCount ? totalVolume / result[0].recordCount : 0,
      };
    } catch (error) {
      console.error("Error getting milk efficiency analytics:", error);
      throw error;
    }
  }

  // ===== BUDGETING & FORECASTING METHODS (Phase 5) =====
  
  // Budgets
  async getBudgets(filters?: {
    status?: string;
    limit?: number;
  }): Promise<Budget[]> {
    try {
      const conditions = [];
      
      if (filters?.status) {
        conditions.push(eq(budgets.status, filters.status));
      }

      let query = db.select().from(budgets);
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      query = query.orderBy(desc(budgets.createdAt)) as any;
      
      if (filters?.limit) {
        query = query.limit(filters.limit) as any;
      }

      return await query;
    } catch (error) {
      console.error("Error getting budgets:", error);
      throw error;
    }
  }

  async getBudgetById(id: string): Promise<Budget | undefined> {
    try {
      const [budget] = await db.select().from(budgets).where(eq(budgets.id, id));
      return budget;
    } catch (error) {
      console.error("Error getting budget:", error);
      throw error;
    }
  }

  async createBudget(data: InsertBudget): Promise<Budget> {
    try {
      const [budget] = await db.insert(budgets).values(data).returning();
      return budget;
    } catch (error) {
      console.error("Error creating budget:", error);
      throw error;
    }
  }

  async updateBudget(id: string, data: Partial<InsertBudget>): Promise<Budget | undefined> {
    try {
      const [budget] = await db
        .update(budgets)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(budgets.id, id))
        .returning();
      return budget;
    } catch (error) {
      console.error("Error updating budget:", error);
      throw error;
    }
  }

  async deleteBudget(id: string): Promise<boolean> {
    try {
      const result = await db.delete(budgets).where(eq(budgets.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error deleting budget:", error);
      throw error;
    }
  }

  // Budget Categories
  async getBudgetCategories(budgetId: string): Promise<BudgetCategory[]> {
    try {
      return await db
        .select()
        .from(budgetCategories)
        .where(eq(budgetCategories.budgetId, budgetId))
        .orderBy(budgetCategories.name);
    } catch (error) {
      console.error("Error getting budget categories:", error);
      throw error;
    }
  }

  async createBudgetCategory(data: InsertBudgetCategory): Promise<BudgetCategory> {
    try {
      const [category] = await db.insert(budgetCategories).values(data).returning();
      return category;
    } catch (error) {
      console.error("Error creating budget category:", error);
      throw error;
    }
  }

  async updateBudgetCategory(id: string, data: Partial<InsertBudgetCategory>): Promise<BudgetCategory | undefined> {
    try {
      const [category] = await db
        .update(budgetCategories)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(budgetCategories.id, id))
        .returning();
      return category;
    } catch (error) {
      console.error("Error updating budget category:", error);
      throw error;
    }
  }

  async deleteBudgetCategory(id: string): Promise<boolean> {
    try {
      const result = await db.delete(budgetCategories).where(eq(budgetCategories.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error deleting budget category:", error);
      throw error;
    }
  }

  // Forecasts
  async getForecasts(filters?: {
    forecastType?: string;
    limit?: number;
  }): Promise<Forecast[]> {
    try {
      const conditions = [];
      
      if (filters?.forecastType) {
        conditions.push(eq(forecasts.forecastType, filters.forecastType));
      }

      let query = db.select().from(forecasts);
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      query = query.orderBy(desc(forecasts.createdAt)) as any;
      
      if (filters?.limit) {
        query = query.limit(filters.limit) as any;
      }

      return await query;
    } catch (error) {
      console.error("Error getting forecasts:", error);
      throw error;
    }
  }

  async getForecastById(id: string): Promise<Forecast | undefined> {
    try {
      const [forecast] = await db.select().from(forecasts).where(eq(forecasts.id, id));
      return forecast;
    } catch (error) {
      console.error("Error getting forecast:", error);
      throw error;
    }
  }

  async createForecast(data: InsertForecast): Promise<Forecast> {
    try {
      const [forecast] = await db.insert(forecasts).values(data).returning();
      return forecast;
    } catch (error) {
      console.error("Error creating forecast:", error);
      throw error;
    }
  }

  async generateForecast(options: {
    forecastType: string;
    startDate: string;
    endDate: string;
    periodType: string;
    assumptions?: any;
  }): Promise<Forecast> {
    try {
      // Create forecast record
      const forecast = await this.createForecast({
        name: `${options.forecastType} Forecast - ${new Date().toLocaleDateString()}`,
        description: `Auto-generated ${options.forecastType} forecast`,
        forecastType: options.forecastType,
        startDate: options.startDate,
        endDate: options.endDate,
        periodType: options.periodType,
        assumptions: JSON.stringify(options.assumptions || {}),
        createdBy: 'system',
      });

      // Generate forecast data based on type
      const dataPoints = await this.generateForecastData(forecast.id, options);
      
      // Insert forecast data
      for (const dataPoint of dataPoints) {
        await this.createForecastData(dataPoint);
      }

      return forecast;
    } catch (error) {
      console.error("Error generating forecast:", error);
      throw error;
    }
  }

  private async generateForecastData(forecastId: string, options: any): Promise<InsertForecastData[]> {
    const dataPoints: InsertForecastData[] = [];
    
    if (options.forecastType === 'cash_flow') {
      // Generate cash flow forecast based on historical data
      const startDate = new Date(options.startDate);
      const endDate = new Date(options.endDate);
      
      // Simple linear projection based on last 3 months
      const milkSummary = await this.getMilkSummary(
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
      );
      
      const monthlyMilkRevenue = (milkSummary.totalValue || 0) / 3;
      const monthlyExpenses = 50000; // Example fixed expenses
      
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        dataPoints.push({
          forecastId,
          period: currentDate.toISOString().split('T')[0],
          category: 'milk_revenue',
          metricType: 'revenue',
          predictedValue: String(monthlyMilkRevenue),
          confidenceLevel: '0.75',
        });
        
        dataPoints.push({
          forecastId,
          period: currentDate.toISOString().split('T')[0],
          category: 'operating_expenses',
          metricType: 'expense',
          predictedValue: String(monthlyExpenses),
          confidenceLevel: '0.80',
        });
        
        // Move to next period
        if (options.periodType === 'monthly') {
          currentDate.setMonth(currentDate.getMonth() + 1);
        } else if (options.periodType === 'quarterly') {
          currentDate.setMonth(currentDate.getMonth() + 3);
        } else {
          currentDate.setFullYear(currentDate.getFullYear() + 1);
        }
      }
    }
    
    return dataPoints;
  }

  async createForecastData(data: InsertForecastData): Promise<ForecastData> {
    try {
      const [forecastData] = await db.insert(forecastData).values(data).returning();
      return forecastData;
    } catch (error) {
      console.error("Error creating forecast data:", error);
      throw error;
    }
  }

  async getForecastData(forecastId: string): Promise<ForecastData[]> {
    try {
      return await db
        .select()
        .from(forecastData)
        .where(eq(forecastData.forecastId, forecastId))
        .orderBy(forecastData.period);
    } catch (error) {
      console.error("Error getting forecast data:", error);
      throw error;
    }
  }

  // Budget Analytics
  async getBudgetPerformance(budgetId: string): Promise<any> {
    try {
      const budget = await this.getBudgetById(budgetId);
      if (!budget) throw new Error('Budget not found');
      
      const categories = await this.getBudgetCategories(budgetId);
      
      let totalBudgetedIncome = 0;
      let totalBudgetedExpenses = 0;
      let totalActualIncome = 0;
      let totalActualExpenses = 0;
      
      for (const category of categories) {
        const budgeted = parseFloat(category.budgetedAmount || '0');
        const actual = parseFloat(category.actualAmount || '0');
        
        if (category.type === 'income') {
          totalBudgetedIncome += budgeted;
          totalActualIncome += actual;
        } else {
          totalBudgetedExpenses += budgeted;
          totalActualExpenses += actual;
        }
      }
      
      const budgetedProfit = totalBudgetedIncome - totalBudgetedExpenses;
      const actualProfit = totalActualIncome - totalActualExpenses;
      const variance = actualProfit - budgetedProfit;
      const variancePercentage = budgetedProfit !== 0 ? (variance / budgetedProfit) * 100 : 0;
      
      return {
        budgetedIncome: totalBudgetedIncome,
        budgetedExpenses: totalBudgetedExpenses,
        budgetedProfit,
        actualIncome: totalActualIncome,
        actualExpenses: totalActualExpenses,
        actualProfit,
        variance,
        variancePercentage,
        performance: variancePercentage >= 0 ? 'ahead' : 'behind',
        categories: categories.map(cat => ({
          ...cat,
          variance: parseFloat(cat.actualAmount || '0') - parseFloat(cat.budgetedAmount),
          variancePercentage: parseFloat(cat.budgetedAmount) !== 0 
            ? ((parseFloat(cat.actualAmount || '0') - parseFloat(cat.budgetedAmount)) / parseFloat(cat.budgetedAmount)) * 100 
            : 0,
        })),
      };
    } catch (error) {
      console.error("Error getting budget performance:", error);
      throw error;
    }
  }

  async getBudgetVsActual(budgetId: string): Promise<any> {
    try {
      const categories = await this.getBudgetCategories(budgetId);
      
      return categories.map(category => ({
        name: category.name,
        type: category.type,
        budgeted: parseFloat(category.budgetedAmount),
        actual: parseFloat(category.actualAmount || '0'),
        variance: parseFloat(category.actualAmount || '0') - parseFloat(category.budgetedAmount),
        variancePercentage: parseFloat(category.budgetedAmount) !== 0 
          ? ((parseFloat(category.actualAmount || '0') - parseFloat(category.budgetedAmount)) / parseFloat(category.budgetedAmount)) * 100 
          : 0,
        status: parseFloat(category.actualAmount || '0') >= parseFloat(category.budgetedAmount) ? 'on_track' : 'over_budget',
      }));
    } catch (error) {
      console.error("Error getting budget vs actual:", error);
      throw error;
    }
  }

  async getForecastAccuracy(forecastId: string): Promise<any> {
    try {
      const data = await this.getForecastData(forecastId);
      const dataWithActuals = data.filter(d => d.actualValue !== null);
      
      if (dataWithActuals.length === 0) {
        return {
          overallAccuracy: 0,
          metricAccuracy: [],
          totalDataPoints: data.length,
          dataPointsWithActuals: 0,
        };
      }
      
      let totalAccuracy = 0;
      const metricAccuracy: { [key: string]: { total: number; count: number } } = {};
      
      for (const point of dataWithActuals) {
        const predicted = parseFloat(point.predictedValue);
        const actual = parseFloat(point.actualValue || '0');
        const accuracy = predicted !== 0 ? Math.min(1, actual / predicted) : 0;
        
        totalAccuracy += accuracy;
        
        if (!metricAccuracy[point.metricType]) {
          metricAccuracy[point.metricType] = { total: 0, count: 0 };
        }
        metricAccuracy[point.metricType].total += accuracy;
        metricAccuracy[point.metricType].count += 1;
      }
      
      const overallAccuracy = totalAccuracy / dataWithActuals.length;
      
      return {
        overallAccuracy,
        metricAccuracy: Object.entries(metricAccuracy).map(([metric, data]) => ({
          metric,
          accuracy: data.total / data.count,
          dataPoints: data.count,
        })),
        totalDataPoints: data.length,
        dataPointsWithActuals: dataWithActuals.length,
      };
    } catch (error) {
      console.error("Error getting forecast accuracy:", error);
      throw error;
    }
  }

  // ===== NZFAP COMPLIANCE METHODS (Phase 5) =====
  
  // Compliance Standards
  async getComplianceStandards(filters?: {
    category?: string;
    requirementLevel?: string;
    isActive?: boolean;
  }): Promise<ComplianceStandard[]> {
    try {
      const conditions = [];
      
      if (filters?.category) {
        conditions.push(eq(complianceStandards.category, filters.category));
      }
      if (filters?.requirementLevel) {
        conditions.push(eq(complianceStandards.requirementLevel, filters.requirementLevel));
      }
      if (filters?.isActive !== undefined) {
        conditions.push(eq(complianceStandards.isActive, filters.isActive));
      }

      let query = db.select().from(complianceStandards);
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      return await query.orderBy(complianceStandards.code);
    } catch (error) {
      console.error("Error getting compliance standards:", error);
      throw error;
    }
  }

  async getComplianceStandardById(id: string): Promise<ComplianceStandard | undefined> {
    try {
      const [standard] = await db.select().from(complianceStandards).where(eq(complianceStandards.id, id));
      return standard;
    } catch (error) {
      console.error("Error getting compliance standard:", error);
      throw error;
    }
  }

  async createComplianceStandard(data: InsertComplianceStandard): Promise<ComplianceStandard> {
    try {
      const [standard] = await db.insert(complianceStandards).values(data).returning();
      return standard;
    } catch (error) {
      console.error("Error creating compliance standard:", error);
      throw error;
    }
  }

  // Compliance Checks
  async getComplianceChecks(filters?: {
    standardId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<ComplianceCheck[]> {
    try {
      const conditions = [];
      
      if (filters?.standardId) {
        conditions.push(eq(complianceChecks.standardId, filters.standardId));
      }
      if (filters?.status) {
        conditions.push(eq(complianceChecks.status, filters.status));
      }
      if (filters?.startDate) {
        conditions.push(sql`${complianceChecks.checkDate} >= ${filters.startDate}`);
      }
      if (filters?.endDate) {
        conditions.push(sql`${complianceChecks.checkDate} <= ${filters.endDate}`);
      }

      let query = db.select().from(complianceChecks);
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      query = query.orderBy(desc(complianceChecks.checkDate)) as any;
      
      if (filters?.limit) {
        query = query.limit(filters.limit) as any;
      }

      return await query;
    } catch (error) {
      console.error("Error getting compliance checks:", error);
      throw error;
    }
  }

  async createComplianceCheck(data: InsertComplianceCheck): Promise<ComplianceCheck> {
    try {
      const [check] = await db.insert(complianceChecks).values(data).returning();
      return check;
    } catch (error) {
      console.error("Error creating compliance check:", error);
      throw error;
    }
  }

  async updateComplianceCheck(id: string, data: Partial<InsertComplianceCheck>): Promise<ComplianceCheck | undefined> {
    try {
      const [check] = await db
        .update(complianceChecks)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(complianceChecks.id, id))
        .returning();
      return check;
    } catch (error) {
      console.error("Error updating compliance check:", error);
      throw error;
    }
  }

  // Compliance Audits
  async getComplianceAudits(filters?: {
    auditType?: string;
    status?: string;
    limit?: number;
  }): Promise<ComplianceAudit[]> {
    try {
      const conditions = [];
      
      if (filters?.auditType) {
        conditions.push(eq(complianceAudits.auditType, filters.auditType));
      }
      if (filters?.status) {
        conditions.push(eq(complianceAudits.status, filters.status));
      }

      let query = db.select().from(complianceAudits);
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      query = query.orderBy(desc(complianceAudits.auditDate)) as any;
      
      if (filters?.limit) {
        query = query.limit(filters.limit) as any;
      }

      return await query;
    } catch (error) {
      console.error("Error getting compliance audits:", error);
      throw error;
    }
  }

  async getComplianceAuditById(id: string): Promise<ComplianceAudit | undefined> {
    try {
      const [audit] = await db.select().from(complianceAudits).where(eq(complianceAudits.id, id));
      return audit;
    } catch (error) {
      console.error("Error getting compliance audit:", error);
      throw error;
    }
  }

  async createComplianceAudit(data: InsertComplianceAudit): Promise<ComplianceAudit> {
    try {
      const [audit] = await db.insert(complianceAudits).values(data).returning();
      return audit;
    } catch (error) {
      console.error("Error creating compliance audit:", error);
      throw error;
    }
  }

  async updateComplianceAudit(id: string, data: Partial<InsertComplianceAudit>): Promise<ComplianceAudit | undefined> {
    try {
      const [audit] = await db
        .update(complianceAudits)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(complianceAudits.id, id))
        .returning();
      return audit;
    } catch (error) {
      console.error("Error updating compliance audit:", error);
      throw error;
    }
  }

  // Compliance Documents
  async getComplianceDocuments(filters?: {
    category?: string;
    documentType?: string;
    isRequired?: boolean;
    isCurrent?: boolean;
  }): Promise<ComplianceDocument[]> {
    try {
      const conditions = [];
      
      if (filters?.category) {
        conditions.push(eq(complianceDocuments.category, filters.category));
      }
      if (filters?.documentType) {
        conditions.push(eq(complianceDocuments.documentType, filters.documentType));
      }
      if (filters?.isRequired !== undefined) {
        conditions.push(eq(complianceDocuments.isRequired, filters.isRequired));
      }
      if (filters?.isCurrent !== undefined) {
        conditions.push(eq(complianceDocuments.isCurrent, filters.isCurrent));
      }

      let query = db.select().from(complianceDocuments);
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      return await query.orderBy(complianceDocuments.title);
    } catch (error) {
      console.error("Error getting compliance documents:", error);
      throw error;
    }
  }

  async getComplianceDocumentById(id: string): Promise<ComplianceDocument | undefined> {
    try {
      const [document] = await db.select().from(complianceDocuments).where(eq(complianceDocuments.id, id));
      return document;
    } catch (error) {
      console.error("Error getting compliance document:", error);
      throw error;
    }
  }

  async createComplianceDocument(data: InsertComplianceDocument): Promise<ComplianceDocument> {
    try {
      const [document] = await db.insert(complianceDocuments).values(data).returning();
      return document;
    } catch (error) {
      console.error("Error creating compliance document:", error);
      throw error;
    }
  }

  async updateComplianceDocument(id: string, data: Partial<InsertComplianceDocument>): Promise<ComplianceDocument | undefined> {
    try {
      const [document] = await db
        .update(complianceDocuments)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(complianceDocuments.id, id))
        .returning();
      return document;
    } catch (error) {
      console.error("Error updating compliance document:", error);
      throw error;
    }
  }

  async deleteComplianceDocument(id: string): Promise<boolean> {
    try {
      const result = await db.delete(complianceDocuments).where(eq(complianceDocuments.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error deleting compliance document:", error);
      throw error;
    }
  }

  // Compliance Dashboard & Analytics
  async getComplianceDashboard(): Promise<any> {
    try {
      const standards = await this.getComplianceStandards({ isActive: true });
      const checks = await this.getComplianceChecks({ limit: 100 });
      const audits = await this.getComplianceAudits({ limit: 10 });
      const documents = await this.getComplianceDocuments({ isCurrent: true });

      // Calculate compliance scores
      const totalStandards = standards.length;
      const compliantChecks = checks.filter(c => c.status === 'compliant').length;
      const nonCompliantChecks = checks.filter(c => c.status === 'non_compliant').length;
      const pendingChecks = checks.filter(c => c.status === 'pending_review').length;

      const overallScore = totalStandards > 0 ? (compliantChecks / totalStandards) * 100 : 0;

      // Get upcoming audits
      const upcomingAudits = audits.filter(a => 
        a.status === 'scheduled' && 
        new Date(a.auditDate) > new Date()
      );

      // Get overdue items
      const today = new Date().toISOString().split('T')[0];
      const overdueChecks = checks.filter(c => 
        c.dueDate && 
        new Date(c.dueDate) < new Date(today) && 
        c.status !== 'compliant'
      );

      const expiredDocuments = documents.filter(d => 
        d.expiryDate && 
        new Date(d.expiryDate) < new Date(today)
      );

      return {
        overview: {
          totalStandards,
          overallScore: Math.round(overallScore * 100) / 100,
          compliantChecks,
          nonCompliantChecks,
          pendingChecks,
          totalAudits: audits.length,
          totalDocuments: documents.length,
        },
        upcomingAudits: upcomingAudits.length,
        overdueItems: {
          checks: overdueChecks.length,
          documents: expiredDocuments.length,
        },
        recentActivity: {
          latestChecks: checks.slice(0, 5),
          latestAudits: audits.slice(0, 3),
        },
        statusBreakdown: {
          compliant: compliantChecks,
          nonCompliant: nonCompliantChecks,
          pending: pendingChecks,
          notApplicable: checks.filter(c => c.status === 'not_applicable').length,
        },
      };
    } catch (error) {
      console.error("Error getting compliance dashboard:", error);
      throw error;
    }
  }

  async getComplianceScores(category?: string): Promise<any> {
    try {
      const standards = await this.getComplianceStandards({ category, isActive: true });
      const checks = await this.getComplianceChecks({ limit: 200 });

      const scoresByCategory: { [key: string]: any } = {};

      for (const standard of standards) {
        const categoryChecks = checks.filter(c => c.standardId === standard.id);
        const compliantCount = categoryChecks.filter(c => c.status === 'compliant').length;
        const score = categoryChecks.length > 0 ? (compliantCount / categoryChecks.length) * 100 : 0;

        if (!scoresByCategory[standard.category]) {
          scoresByCategory[standard.category] = {
            category: standard.category,
            totalStandards: 0,
            totalChecks: 0,
            compliantChecks: 0,
            score: 0,
          };
        }

        scoresByCategory[standard.category].totalStandards++;
        scoresByCategory[standard.category].totalChecks += categoryChecks.length;
        scoresByCategory[standard.category].compliantChecks += compliantCount;
      }

      // Calculate final scores
      Object.keys(scoresByCategory).forEach(cat => {
        const catData = scoresByCategory[cat];
        catData.score = catData.totalChecks > 0 
          ? Math.round((catData.compliantChecks / catData.totalChecks) * 100 * 100) / 100 
          : 0;
      });

      return Object.values(scoresByCategory);
    } catch (error) {
      console.error("Error getting compliance scores:", error);
      throw error;
    }
  }

  async getUpcomingComplianceTasks(days: number = 30): Promise<any[]> {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      const checks = await this.getComplianceChecks();
      const audits = await this.getComplianceAudits();
      const documents = await this.getComplianceDocuments();

      const tasks = [];

      // Upcoming checks
      const upcomingChecks = checks.filter(c => 
        c.dueDate && 
        c.dueDate >= today && 
        c.dueDate <= futureDateStr &&
        c.status !== 'compliant'
      );

      for (const check of upcomingChecks) {
        const standard = await this.getComplianceStandardById(check.standardId);
        tasks.push({
          id: check.id,
          type: 'check',
          title: `Compliance Check: ${standard?.title || 'Unknown Standard'}`,
          dueDate: check.dueDate,
          priority: new Date(check.dueDate) <= new Date(today + 7 * 24 * 60 * 60 * 1000) ? 'high' : 'medium',
          status: check.status,
        });
      }

      // Upcoming audits
      const upcomingAudits = audits.filter(a => 
        a.auditDate >= today && 
        a.auditDate <= futureDateStr &&
        a.status === 'scheduled'
      );

      for (const audit of upcomingAudits) {
        tasks.push({
          id: audit.id,
          type: 'audit',
          title: `Audit: ${audit.auditType}`,
          dueDate: audit.auditDate,
          priority: 'high',
          status: audit.status,
        });
      }

      // Expiring documents
      const expiringDocuments = documents.filter(d => 
        d.expiryDate && 
        d.expiryDate >= today && 
        d.expiryDate <= futureDateStr
      );

      for (const doc of expiringDocuments) {
        tasks.push({
          id: doc.id,
          type: 'document',
          title: `Document Expiry: ${doc.title}`,
          dueDate: doc.expiryDate,
          priority: doc.isRequired ? 'high' : 'medium',
          status: 'expiring',
        });
      }

      return tasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    } catch (error) {
      console.error("Error getting upcoming compliance tasks:", error);
      throw error;
    }
  }

  async getOverdueComplianceItems(): Promise<any[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const checks = await this.getComplianceChecks();
      const documents = await this.getComplianceDocuments();

      const overdue = [];

      // Overdue checks
      const overdueChecks = checks.filter(c => 
        c.dueDate && 
        new Date(c.dueDate) < new Date(today) && 
        c.status !== 'compliant'
      );

      for (const check of overdueChecks) {
        const standard = await this.getComplianceStandardById(check.standardId);
        overdue.push({
          id: check.id,
          type: 'check',
          title: `Overdue Check: ${standard?.title || 'Unknown Standard'}`,
          dueDate: check.dueDate,
          daysOverdue: Math.floor((new Date(today).getTime() - new Date(check.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
          status: check.status,
        });
      }

      // Expired documents
      const expiredDocuments = documents.filter(d => 
        d.expiryDate && 
        new Date(d.expiryDate) < new Date(today)
      );

      for (const doc of expiredDocuments) {
        overdue.push({
          id: doc.id,
          type: 'document',
          title: `Expired Document: ${doc.title}`,
          dueDate: doc.expiryDate,
          daysOverdue: Math.floor((new Date(today).getTime() - new Date(doc.expiryDate).getTime()) / (1000 * 60 * 60 * 24)),
          status: 'expired',
        });
      }

      return overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
    } catch (error) {
      console.error("Error getting overdue compliance items:", error);
      throw error;
    }
  }

  async generateComplianceReport(options: {
    reportType: string;
    startDate: string;
    endDate: string;
    category?: string;
  }): Promise<any> {
    try {
      const { reportType, startDate, endDate, category } = options;

      if (reportType === 'summary') {
        const dashboard = await this.getComplianceDashboard();
        const scores = await this.getComplianceScores(category);
        const checks = await this.getComplianceChecks({ startDate, endDate });

        return {
          reportType: 'Compliance Summary Report',
          generatedAt: new Date().toISOString(),
          period: { startDate, endDate },
          overview: dashboard.overview,
          scoresByCategory: category ? scores.filter(s => s.category === category) : scores,
          trends: {
            totalChecks: checks.length,
            complianceRate: checks.length > 0 ? (checks.filter(c => c.status === 'compliant').length / checks.length) * 100 : 0,
          },
        };
      }

      throw new Error(`Unknown report type: ${reportType}`);
    } catch (error) {
      console.error("Error generating compliance report:", error);
      throw error;
    }
  }

  async initializeNZFAPStandards(): Promise<void> {
    try {
      const standards: InsertComplianceStandard[] = [
        {
          code: 'NZFAP-001',
          title: 'Animal Health and Welfare',
          description: 'Ensure all animals are healthy, well-cared for, and handled humanely',
          category: 'animal_welfare',
          requirementLevel: 'mandatory',
          checkFrequency: 'daily',
          documentationRequired: true,
          isActive: true,
          lastUpdated: new Date().toISOString().split('T')[0],
        },
        {
          code: 'NZFAP-002',
          title: 'Biosecurity Management',
          description: 'Implement biosecurity measures to prevent disease introduction and spread',
          category: 'biosecurity',
          requirementLevel: 'mandatory',
          checkFrequency: 'weekly',
          documentationRequired: true,
          isActive: true,
          lastUpdated: new Date().toISOString().split('T')[0],
        },
        {
          code: 'NZFAP-003',
          title: 'Environmental Management',
          description: 'Manage environmental impacts including water, soil, and biodiversity',
          category: 'environment',
          requirementLevel: 'mandatory',
          checkFrequency: 'monthly',
          documentationRequired: true,
          isActive: true,
          lastUpdated: new Date().toISOString().split('T')[0],
        },
        {
          code: 'NZFAP-004',
          title: 'Milk Quality and Safety',
          description: 'Ensure milk production meets quality and safety standards',
          category: 'milk_quality',
          requirementLevel: 'mandatory',
          checkFrequency: 'daily',
          documentationRequired: true,
          isActive: true,
          lastUpdated: new Date().toISOString().split('T')[0],
        },
        {
          code: 'NZFAP-005',
          title: 'Staff Training and Competency',
          description: 'Ensure all staff are properly trained and competent for their roles',
          category: 'human_resources',
          requirementLevel: 'recommended',
          checkFrequency: 'quarterly',
          documentationRequired: true,
          isActive: true,
          lastUpdated: new Date().toISOString().split('T')[0],
        },
        {
          code: 'NZFAP-006',
          title: 'Chemical and Medicine Management',
          description: 'Safe storage, handling, and use of agricultural chemicals and medicines',
          category: 'chemical_management',
          requirementLevel: 'mandatory',
          checkFrequency: 'monthly',
          documentationRequired: true,
          isActive: true,
          lastUpdated: new Date().toISOString().split('T')[0],
        },
        {
          code: 'NZFAP-007',
          title: 'Record Keeping',
          description: 'Maintain accurate and up-to-date farm records',
          category: 'record_keeping',
          requirementLevel: 'mandatory',
          checkFrequency: 'weekly',
          documentationRequired: true,
          isActive: true,
          lastUpdated: new Date().toISOString().split('T')[0],
        },
        {
          code: 'NZFAP-008',
          title: 'Infrastructure and Equipment',
          description: 'Maintain farm infrastructure and equipment in good working condition',
          category: 'infrastructure',
          requirementLevel: 'recommended',
          checkFrequency: 'monthly',
          documentationRequired: false,
          isActive: true,
          lastUpdated: new Date().toISOString().split('T')[0],
        },
      ];

      for (const standard of standards) {
        await this.createComplianceStandard(standard);
      }
    } catch (error) {
      console.error("Error initializing NZFAP standards:", error);
      throw error;
    }
  }

  // ===== WEIGHT TRACKING METHODS =====

  async getWeightRecordsByAnimal(animalId: string): Promise<WeightRecord[]> {
    const records = await db
      .select()
      .from(weightRecords)
      .where(eq(weightRecords.animalId, animalId))
      .orderBy(desc(weightRecords.date));
    return records;
  }

  async getLatestWeightRecord(animalId: string): Promise<WeightRecord | null> {
    const records = await db
      .select()
      .from(weightRecords)
      .where(eq(weightRecords.animalId, animalId))
      .orderBy(desc(weightRecords.date))
      .limit(1);
    return records[0] || null;
  }

  async createWeightRecord(record: InsertWeightRecord): Promise<WeightRecord> {
    const [newRecord] = await db.insert(weightRecords).values(record).returning();
    return newRecord;
  }

  async getWeightRecord(id: string): Promise<WeightRecord | null> {
    const [record] = await db.select().from(weightRecords).where(eq(weightRecords.id, id));
    return record || null;
  }

  async updateWeightRecord(id: string, updates: Partial<InsertWeightRecord>): Promise<WeightRecord> {
    const [updatedRecord] = await db
      .update(weightRecords)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(weightRecords.id, id))
      .returning();
    return updatedRecord;
  }

  async deleteWeightRecord(id: string): Promise<void> {
    await db.delete(weightRecords).where(eq(weightRecords.id, id));
  }

  async getWeightTargets(): Promise<WeightTarget[]> {
    return await db.select().from(weightTargets).orderBy(desc(weightTargets.createdAt));
  }

  async getWeightTargetsByGroup(groupId: string): Promise<WeightTarget[]> {
    return await db
      .select()
      .from(weightTargets)
      .where(eq(weightTargets.groupId, groupId))
      .orderBy(desc(weightTargets.createdAt));
  }

  async createWeightTarget(target: InsertWeightTarget): Promise<WeightTarget> {
    const [newTarget] = await db.insert(weightTargets).values(target).returning();
    return newTarget;
  }

  async getWeightTarget(id: string): Promise<WeightTarget | null> {
    const [target] = await db.select().from(weightTargets).where(eq(weightTargets.id, id));
    return target || null;
  }

  async updateWeightTarget(id: string, updates: Partial<InsertWeightTarget>): Promise<WeightTarget> {
    const [updatedTarget] = await db
      .update(weightTargets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(weightTargets.id, id))
      .returning();
    return updatedTarget;
  }

  async deleteWeightTarget(id: string): Promise<void> {
    await db.delete(weightTargets).where(eq(weightTargets.id, id));
  }

  // ===== VACCINATION SCHEDULE METHODS =====

  async getVaccinationSchedules(): Promise<VaccinationSchedule[]> {
    return await db.select().from(vaccinationSchedules).orderBy(desc(vaccinationSchedules.createdAt));
  }

  async getVaccinationSchedulesByGroup(groupId: string): Promise<VaccinationSchedule[]> {
    return await db
      .select()
      .from(vaccinationSchedules)
      .where(eq(vaccinationSchedules.groupId, groupId))
      .orderBy(desc(vaccinationSchedules.createdAt));
  }

  async getVaccinationSchedule(id: string): Promise<VaccinationSchedule | null> {
    const [schedule] = await db.select().from(vaccinationSchedules).where(eq(vaccinationSchedules.id, id));
    return schedule || null;
  }

  async createVaccinationSchedule(schedule: InsertVaccinationSchedule): Promise<VaccinationSchedule> {
    const [newSchedule] = await db.insert(vaccinationSchedules).values(schedule).returning();
    return newSchedule;
  }

  async updateVaccinationSchedule(id: string, updates: Partial<InsertVaccinationSchedule>): Promise<VaccinationSchedule> {
    const [updatedSchedule] = await db
      .update(vaccinationSchedules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(vaccinationSchedules.id, id))
      .returning();
    return updatedSchedule;
  }

  async deleteVaccinationSchedule(id: string): Promise<void> {
    await db.delete(vaccinationSchedules).where(eq(vaccinationSchedules.id, id));
  }

  async getVaccinationRecordsByAnimal(animalId: string): Promise<AnimalTreatment[]> {
    const records = await db
      .select()
      .from(animalTreatments)
      .where(and(
        eq(animalTreatments.animalId, animalId),
        or(
          eq(animalTreatments.category, 'vaccination'),
          eq(animalTreatments.category, 'drench')
        )
      ))
      .orderBy(desc(animalTreatments.dateTime));
    return records;
  }

  async getVaccinationRecordsByGroup(groupId: string): Promise<AnimalTreatment[]> {
    // Get all animals in the group
    const groupAnimals = await db
      .select({ animalId: animalGroupMembers.animalId })
      .from(animalGroupMembers)
      .where(eq(animalGroupMembers.groupId, groupId));
    
    if (groupAnimals.length === 0) return [];

    const animalIds = groupAnimals.map(ga => ga.animalId);
    
    // Get vaccination/drench records for these animals
    const records = await db
      .select()
      .from(animalTreatments)
      .where(and(
        sql`${animalTreatments.animalId} = ANY(${animalIds})`,
        or(
          eq(animalTreatments.category, 'vaccination'),
          eq(animalTreatments.category, 'drench')
        )
      ))
      .orderBy(desc(animalTreatments.dateTime));
    
    return records;
  }

  async getUpcomingVaccinations(days: number = 30): Promise<VaccinationSchedule[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return await db
      .select()
      .from(vaccinationSchedules)
      .where(and(
        eq(vaccinationSchedules.isActive, true),
        gte(vaccinationSchedules.nextDueDate, new Date()),
        lte(vaccinationSchedules.nextDueDate, futureDate)
      ))
      .orderBy(vaccinationSchedules.nextDueDate);
  }

  // ===== HEALTH SCORE METHODS =====

  async getHealthScoresByAnimal(animalId: string): Promise<HealthScore[]> {
    return await db
      .select()
      .from(healthScores)
      .where(eq(healthScores.animalId, animalId))
      .orderBy(desc(healthScores.recordDate));
  }

  async getLatestHealthScore(animalId: string): Promise<HealthScore | null> {
    const [score] = await db
      .select()
      .from(healthScores)
      .where(eq(healthScores.animalId, animalId))
      .orderBy(desc(healthScores.recordDate))
      .limit(1);
    return score || null;
  }

  async getHealthScore(id: string): Promise<HealthScore | null> {
    const [score] = await db.select().from(healthScores).where(eq(healthScores.id, id));
    return score || null;
  }

  async createHealthScore(score: InsertHealthScore): Promise<HealthScore> {
    const [newScore] = await db.insert(healthScores).values(score).returning();
    return newScore;
  }

  async updateHealthScore(id: string, updates: Partial<InsertHealthScore>): Promise<HealthScore> {
    const [updatedScore] = await db
      .update(healthScores)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(healthScores.id, id))
      .returning();
    return updatedScore;
  }

  async deleteHealthScore(id: string): Promise<void> {
    await db.delete(healthScores).where(eq(healthScores.id, id));
  }

  async getHealthScoresWithHighSCC(threshold: number = 200): Promise<HealthScore[]> {
    return await db
      .select()
      .from(healthScores)
      .where(gte(healthScores.somaticCellCount, threshold))
      .orderBy(desc(healthScores.recordDate));
  }

  async getHealthScoresWithLameness(minScore: '1' | '2' | '3' | '4' | '5' = '3'): Promise<HealthScore[]> {
    // Use SQL for enum comparison since drizzle gte doesn't work well with enums
    return await db
      .select()
      .from(healthScores)
      .where(sql`${healthScores.lamenessScore} >= ${minScore}`)
      .orderBy(desc(healthScores.recordDate));
  }

  async getHealthScoresWithFever(threshold: number = 39.5): Promise<HealthScore[]> {
    return await db
      .select()
      .from(healthScores)
      .where(gte(healthScores.temperature, threshold.toString()))
      .orderBy(desc(healthScores.recordDate));
  }

  // ===== MORTALITY RECORD METHODS =====

  async getMortalityRecords(): Promise<MortalityRecord[]> {
    return await db.select().from(mortalityRecords).orderBy(desc(mortalityRecords.deathDate));
  }

  async getMortalityRecordsByAnimal(animalId: string): Promise<MortalityRecord[]> {
    return await db
      .select()
      .from(mortalityRecords)
      .where(eq(mortalityRecords.animalId, animalId))
      .orderBy(desc(mortalityRecords.deathDate));
  }

  async getMortalityRecord(id: string): Promise<MortalityRecord | null> {
    const [record] = await db.select().from(mortalityRecords).where(eq(mortalityRecords.id, id));
    return record || null;
  }

  async createMortalityRecord(record: InsertMortalityRecord): Promise<MortalityRecord> {
    const [newRecord] = await db.insert(mortalityRecords).values(record).returning();
    return newRecord;
  }

  async updateMortalityRecord(id: string, updates: Partial<InsertMortalityRecord>): Promise<MortalityRecord> {
    const [updatedRecord] = await db
      .update(mortalityRecords)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(mortalityRecords.id, id))
      .returning();
    return updatedRecord;
  }

  async deleteMortalityRecord(id: string): Promise<void> {
    await db.delete(mortalityRecords).where(eq(mortalityRecords.id, id));
  }

  async getMortalityStatsByPeriod(startDate: Date, endDate: Date): Promise<MortalityRecord[]> {
    return await db
      .select()
      .from(mortalityRecords)
      .where(and(
        gte(mortalityRecords.deathDate, startDate),
        lte(mortalityRecords.deathDate, endDate)
      ))
      .orderBy(desc(mortalityRecords.deathDate));
  }

  // ===== HEALTH ALERT METHODS =====

  async getHealthAlerts(): Promise<HealthAlert[]> {
    return await db.select().from(healthAlerts).orderBy(desc(healthAlerts.createdAt));
  }

  async getActiveHealthAlerts(): Promise<HealthAlert[]> {
    return await db
      .select()
      .from(healthAlerts)
      .where(eq(healthAlerts.isActive, true))
      .orderBy(desc(healthAlerts.createdAt));
  }

  async getHealthAlertsByAnimal(animalId: string): Promise<HealthAlert[]> {
    return await db
      .select()
      .from(healthAlerts)
      .where(eq(healthAlerts.animalId, animalId))
      .orderBy(desc(healthAlerts.createdAt));
  }

  async getHealthAlert(id: string): Promise<HealthAlert | null> {
    const [alert] = await db.select().from(healthAlerts).where(eq(healthAlerts.id, id));
    return alert || null;
  }

  async createHealthAlert(alert: InsertHealthAlert): Promise<HealthAlert> {
    const [newAlert] = await db.insert(healthAlerts).values(alert).returning();
    return newAlert;
  }

  async updateHealthAlert(id: string, updates: Partial<InsertHealthAlert>): Promise<HealthAlert> {
    const [updatedAlert] = await db
      .update(healthAlerts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(healthAlerts.id, id))
      .returning();
    return updatedAlert;
  }

  async acknowledgeHealthAlert(id: string, userId: string): Promise<HealthAlert> {
    const [updatedAlert] = await db
      .update(healthAlerts)
      .set({ 
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
        updatedAt: new Date()
      })
      .where(eq(healthAlerts.id, id))
      .returning();
    return updatedAlert;
  }

  async resolveHealthAlert(id: string, userId: string, notes?: string): Promise<HealthAlert> {
    const [updatedAlert] = await db
      .update(healthAlerts)
      .set({ 
        isActive: false,
        resolvedAt: new Date(),
        resolvedBy: userId,
        resolutionNotes: notes,
        updatedAt: new Date()
      })
      .where(eq(healthAlerts.id, id))
      .returning();
    return updatedAlert;
  }

  async deleteHealthAlert(id: string): Promise<void> {
    await db.delete(healthAlerts).where(eq(healthAlerts.id, id));
  }

  // ===== BULL METHODS =====

  async getBulls(): Promise<Bull[]> {
    return await db.select().from(bulls).where(eq(bulls.isActive, true)).orderBy(bulls.name);
  }

  async getBull(id: string): Promise<Bull | null> {
    const [bull] = await db.select().from(bulls).where(eq(bulls.id, id));
    return bull || null;
  }

  async createBull(bull: InsertBull): Promise<Bull> {
    const [newBull] = await db.insert(bulls).values(bull).returning();
    return newBull;
  }

  async updateBull(id: string, updates: Partial<InsertBull>): Promise<Bull> {
    const [updatedBull] = await db
      .update(bulls)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bulls.id, id))
      .returning();
    return updatedBull;
  }

  async deleteBull(id: string): Promise<void> {
    await db.update(bulls).set({ isActive: false, updatedAt: new Date() }).where(eq(bulls.id, id));
  }

  // ===== BREEDING RECORD METHODS =====

  async getBreedingRecords(): Promise<BreedingRecord[]> {
    return await db.select().from(breedingRecords).orderBy(desc(breedingRecords.breedingDate));
  }

  async getBreedingRecordsByAnimal(animalId: string): Promise<BreedingRecord[]> {
    return await db
      .select()
      .from(breedingRecords)
      .where(eq(breedingRecords.animalId, animalId))
      .orderBy(desc(breedingRecords.breedingDate));
  }

  async getBreedingRecordsByBull(bullId: string): Promise<BreedingRecord[]> {
    return await db
      .select()
      .from(breedingRecords)
      .where(eq(breedingRecords.bullId, bullId))
      .orderBy(desc(breedingRecords.breedingDate));
  }

  async getBreedingRecord(id: string): Promise<BreedingRecord | null> {
    const [record] = await db.select().from(breedingRecords).where(eq(breedingRecords.id, id));
    return record || null;
  }

  async createBreedingRecord(record: InsertBreedingRecord): Promise<BreedingRecord> {
    const [newRecord] = await db.insert(breedingRecords).values(record).returning();
    return newRecord;
  }

  async updateBreedingRecord(id: string, updates: Partial<InsertBreedingRecord>): Promise<BreedingRecord> {
    const [updatedRecord] = await db
      .update(breedingRecords)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(breedingRecords.id, id))
      .returning();
    return updatedRecord;
  }

  async deleteBreedingRecord(id: string): Promise<void> {
    await db.delete(breedingRecords).where(eq(breedingRecords.id, id));
  }

  async getExpectedCalvings(startDate: Date, endDate: Date): Promise<BreedingRecord[]> {
    return await db
      .select()
      .from(breedingRecords)
      .where(and(
        eq(breedingRecords.conceptionConfirmed, true),
        gte(breedingRecords.expectedCalvingDate, startDate),
        lte(breedingRecords.expectedCalvingDate, endDate)
      ))
      .orderBy(breedingRecords.expectedCalvingDate);
  }

  // ===== CALVING RECORD METHODS =====

  async getCalvingRecords(): Promise<CalvingRecord[]> {
    return await db.select().from(calvingRecords).orderBy(desc(calvingRecords.calvingDate));
  }

  async getCalvingRecordsByDam(damId: string): Promise<CalvingRecord[]> {
    return await db
      .select()
      .from(calvingRecords)
      .where(eq(calvingRecords.damId, damId))
      .orderBy(desc(calvingRecords.calvingDate));
  }

  async getCalvingRecord(id: string): Promise<CalvingRecord | null> {
    const [record] = await db.select().from(calvingRecords).where(eq(calvingRecords.id, id));
    return record || null;
  }

  async createCalvingRecord(record: InsertCalvingRecord): Promise<CalvingRecord> {
    const [newRecord] = await db.insert(calvingRecords).values(record).returning();
    return newRecord;
  }

  async updateCalvingRecord(id: string, updates: Partial<InsertCalvingRecord>): Promise<CalvingRecord> {
    const [updatedRecord] = await db
      .update(calvingRecords)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(calvingRecords.id, id))
      .returning();
    return updatedRecord;
  }

  async deleteCalvingRecord(id: string): Promise<void> {
    await db.delete(calvingRecords).where(eq(calvingRecords.id, id));
  }

  async getCalvingDifficultyStats(): Promise<{ difficulty: string; count: number }[]> {
    const results = await db
      .select({
        difficulty: calvingRecords.calvingDifficulty,
        count: sql<number>`count(*)::int`,
      })
      .from(calvingRecords)
      .groupBy(calvingRecords.calvingDifficulty);
    return results.map(r => ({ difficulty: r.difficulty || 'unknown', count: r.count }));
  }

  // ===== LACTATION RECORD METHODS =====

  async getLactationRecords(): Promise<LactationRecord[]> {
    return await db.select().from(lactationRecords).orderBy(desc(lactationRecords.calvingDate));
  }

  async getLactationRecordsByAnimal(animalId: string): Promise<LactationRecord[]> {
    return await db
      .select()
      .from(lactationRecords)
      .where(eq(lactationRecords.animalId, animalId))
      .orderBy(desc(lactationRecords.lactationNumber));
  }

  async getCurrentLactation(animalId: string): Promise<LactationRecord | null> {
    const [record] = await db
      .select()
      .from(lactationRecords)
      .where(and(
        eq(lactationRecords.animalId, animalId),
        eq(lactationRecords.status, 'milking')
      ))
      .orderBy(desc(lactationRecords.lactationNumber))
      .limit(1);
    return record || null;
  }

  async getLactationRecord(id: string): Promise<LactationRecord | null> {
    const [record] = await db.select().from(lactationRecords).where(eq(lactationRecords.id, id));
    return record || null;
  }

  async createLactationRecord(record: InsertLactationRecord): Promise<LactationRecord> {
    const [newRecord] = await db.insert(lactationRecords).values(record).returning();
    return newRecord;
  }

  async updateLactationRecord(id: string, updates: Partial<InsertLactationRecord>): Promise<LactationRecord> {
    const [updatedRecord] = await db
      .update(lactationRecords)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(lactationRecords.id, id))
      .returning();
    return updatedRecord;
  }

  async deleteLactationRecord(id: string): Promise<void> {
    await db.delete(lactationRecords).where(eq(lactationRecords.id, id));
  }

  async getDryCows(): Promise<LactationRecord[]> {
    return await db
      .select()
      .from(lactationRecords)
      .where(eq(lactationRecords.status, 'dry'))
      .orderBy(lactationRecords.dryOffDate);
  }

  // ===== HEAT RECORD METHODS =====

  async getHeatRecords(): Promise<HeatRecord[]> {
    return await db.select().from(heatRecords).orderBy(desc(heatRecords.detectionDate));
  }

  async getHeatRecordsByAnimal(animalId: string): Promise<HeatRecord[]> {
    return await db
      .select()
      .from(heatRecords)
      .where(eq(heatRecords.animalId, animalId))
      .orderBy(desc(heatRecords.detectionDate));
  }

  async getHeatRecord(id: string): Promise<HeatRecord | null> {
    const [record] = await db.select().from(heatRecords).where(eq(heatRecords.id, id));
    return record || null;
  }

  async createHeatRecord(record: InsertHeatRecord): Promise<HeatRecord> {
    const [newRecord] = await db.insert(heatRecords).values(record).returning();
    return newRecord;
  }

  async updateHeatRecord(id: string, updates: Partial<InsertHeatRecord>): Promise<HeatRecord> {
    const [updatedRecord] = await db
      .update(heatRecords)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(heatRecords.id, id))
      .returning();
    return updatedRecord;
  }

  async deleteHeatRecord(id: string): Promise<void> {
    await db.delete(heatRecords).where(eq(heatRecords.id, id));
  }

  async getPredictedHeats(startDate: Date, endDate: Date): Promise<HeatRecord[]> {
    return await db
      .select()
      .from(heatRecords)
      .where(and(
        eq(heatRecords.isPredicted, true),
        gte(heatRecords.detectionDate, startDate),
        lte(heatRecords.detectionDate, endDate)
      ))
      .orderBy(heatRecords.detectionDate);
  }

  // ===== CONCEPTION RATE CALCULATION =====

  async getConceptionRateByBull(bullId: string): Promise<{ total: number; confirmed: number; rate: number }> {
    const records = await db
      .select()
      .from(breedingRecords)
      .where(eq(breedingRecords.bullId, bullId));
    
    const total = records.length;
    const confirmed = records.filter(r => r.conceptionConfirmed).length;
    const rate = total > 0 ? (confirmed / total) * 100 : 0;
    
    return { total, confirmed, rate };
  }

  async getConceptionRateByTechnician(technicianId: string): Promise<{ total: number; confirmed: number; rate: number }> {
    const records = await db
      .select()
      .from(breedingRecords)
      .where(eq(breedingRecords.technicianId, technicianId));
    
    const total = records.length;
    const confirmed = records.filter(r => r.conceptionConfirmed).length;
    const rate = total > 0 ? (confirmed / total) * 100 : 0;
    
    return { total, confirmed, rate };
  }

  // ===== VETERINARIAN METHODS =====

  async getVeterinarians(): Promise<Veterinarian[]> {
    return await db.select().from(veterinarians).where(eq(veterinarians.isActive, true)).orderBy(veterinarians.name);
  }

  async getVeterinarian(id: string): Promise<Veterinarian | null> {
    const [vet] = await db.select().from(veterinarians).where(eq(veterinarians.id, id));
    return vet || null;
  }

  async createVeterinarian(vet: InsertVeterinarian): Promise<Veterinarian> {
    const [newVet] = await db.insert(veterinarians).values(vet).returning();
    return newVet;
  }

  async updateVeterinarian(id: string, updates: Partial<InsertVeterinarian>): Promise<Veterinarian> {
    const [updatedVet] = await db
      .update(veterinarians)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(veterinarians.id, id))
      .returning();
    return updatedVet;
  }

  async deleteVeterinarian(id: string): Promise<void> {
    await db.update(veterinarians).set({ isActive: false, updatedAt: new Date() }).where(eq(veterinarians.id, id));
  }

  // ===== VET VISIT METHODS =====

  async getVetVisits(): Promise<VetVisit[]> {
    return await db.select().from(vetVisits).orderBy(desc(vetVisits.scheduledDate));
  }

  async getVetVisitsByStatus(status: string): Promise<VetVisit[]> {
    return await db
      .select()
      .from(vetVisits)
      .where(sql`${vetVisits.status} = ${status}`)
      .orderBy(vetVisits.scheduledDate);
  }

  async getUpcomingVetVisits(days: number = 7): Promise<VetVisit[]> {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    return await db
      .select()
      .from(vetVisits)
      .where(and(
        sql`${vetVisits.status} IN ('scheduled', 'confirmed')`,
        gte(vetVisits.scheduledDate, new Date()),
        lte(vetVisits.scheduledDate, endDate)
      ))
      .orderBy(vetVisits.scheduledDate);
  }

  async getVetVisit(id: string): Promise<VetVisit | null> {
    const [visit] = await db.select().from(vetVisits).where(eq(vetVisits.id, id));
    return visit || null;
  }

  async createVetVisit(visit: InsertVetVisit): Promise<VetVisit> {
    const [newVisit] = await db.insert(vetVisits).values(visit).returning();
    return newVisit;
  }

  async updateVetVisit(id: string, updates: Partial<InsertVetVisit>): Promise<VetVisit> {
    const [updatedVisit] = await db
      .update(vetVisits)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(vetVisits.id, id))
      .returning();
    return updatedVisit;
  }

  async deleteVetVisit(id: string): Promise<void> {
    await db.delete(vetVisits).where(eq(vetVisits.id, id));
  }

  // ===== LAB RESULT METHODS =====

  async getLabResults(): Promise<LabResult[]> {
    return await db.select().from(labResults).orderBy(desc(labResults.sampleCollectionDate));
  }

  async getLabResultsByAnimal(animalId: string): Promise<LabResult[]> {
    return await db
      .select()
      .from(labResults)
      .where(eq(labResults.animalId, animalId))
      .orderBy(desc(labResults.sampleCollectionDate));
  }

  async getLabResultsByVisit(visitId: string): Promise<LabResult[]> {
    return await db
      .select()
      .from(labResults)
      .where(eq(labResults.vetVisitId, visitId))
      .orderBy(desc(labResults.sampleCollectionDate));
  }

  async getPendingLabResults(): Promise<LabResult[]> {
    return await db
      .select()
      .from(labResults)
      .where(sql`${labResults.status} IN ('pending', 'in_progress')`)
      .orderBy(labResults.sampleCollectionDate);
  }

  async getLabResult(id: string): Promise<LabResult | null> {
    const [result] = await db.select().from(labResults).where(eq(labResults.id, id));
    return result || null;
  }

  async createLabResult(result: InsertLabResult): Promise<LabResult> {
    const [newResult] = await db.insert(labResults).values(result).returning();
    return newResult;
  }

  async updateLabResult(id: string, updates: Partial<InsertLabResult>): Promise<LabResult> {
    const [updatedResult] = await db
      .update(labResults)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(labResults.id, id))
      .returning();
    return updatedResult;
  }

  async deleteLabResult(id: string): Promise<void> {
    await db.delete(labResults).where(eq(labResults.id, id));
  }

  // ===== PRESCRIPTION METHODS =====

  async getPrescriptions(): Promise<Prescription[]> {
    return await db.select().from(prescriptions).orderBy(desc(prescriptions.prescriptionDate));
  }

  async getPrescriptionsByAnimal(animalId: string): Promise<Prescription[]> {
    return await db
      .select()
      .from(prescriptions)
      .where(eq(prescriptions.animalId, animalId))
      .orderBy(desc(prescriptions.prescriptionDate));
  }

  async getActivePrescriptions(): Promise<Prescription[]> {
    return await db
      .select()
      .from(prescriptions)
      .where(eq(prescriptions.status, 'active'))
      .orderBy(prescriptions.endDate);
  }

  async getPrescriptionsByVisit(visitId: string): Promise<Prescription[]> {
    return await db
      .select()
      .from(prescriptions)
      .where(eq(prescriptions.vetVisitId, visitId))
      .orderBy(desc(prescriptions.prescriptionDate));
  }

  async getPrescription(id: string): Promise<Prescription | null> {
    const [prescription] = await db.select().from(prescriptions).where(eq(prescriptions.id, id));
    return prescription || null;
  }

  async createPrescription(prescription: InsertPrescription): Promise<Prescription> {
    const [newPrescription] = await db.insert(prescriptions).values(prescription).returning();
    return newPrescription;
  }

  async updatePrescription(id: string, updates: Partial<InsertPrescription>): Promise<Prescription> {
    const [updatedPrescription] = await db
      .update(prescriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(prescriptions.id, id))
      .returning();
    return updatedPrescription;
  }

  async deletePrescription(id: string): Promise<void> {
    await db.delete(prescriptions).where(eq(prescriptions.id, id));
  }

  // ===== VET COST METHODS =====

  async getVetCostRecords(): Promise<VetCostRecord[]> {
    return await db.select().from(vetCostRecords).orderBy(desc(vetCostRecords.periodStart));
  }

  async getVetCostRecord(id: string): Promise<VetCostRecord | null> {
    const [record] = await db.select().from(vetCostRecords).where(eq(vetCostRecords.id, id));
    return record || null;
  }

  async createVetCostRecord(record: InsertVetCostRecord): Promise<VetCostRecord> {
    const [newRecord] = await db.insert(vetCostRecords).values(record).returning();
    return newRecord;
  }

  async updateVetCostRecord(id: string, updates: Partial<InsertVetCostRecord>): Promise<VetCostRecord> {
    const [updatedRecord] = await db
      .update(vetCostRecords)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(vetCostRecords.id, id))
      .returning();
    return updatedRecord;
  }

  async getVetCostSummary(startDate: Date, endDate: Date): Promise<{
    totalCosts: number;
    consultationCosts: number;
    medicationCosts: number;
    procedureCosts: number;
    labTestCosts: number;
    travelCosts: number;
    visitCount: number;
  }> {
    const visits = await db
      .select()
      .from(vetVisits)
      .where(and(
        gte(vetVisits.scheduledDate, startDate),
        lte(vetVisits.scheduledDate, endDate),
        eq(vetVisits.status, 'completed')
      ));

    const labTests = await db
      .select()
      .from(labResults)
      .where(and(
        gte(labResults.sampleCollectionDate, startDate),
        lte(labResults.sampleCollectionDate, endDate)
      ));

    const consultationCosts = visits.reduce((sum, v) => sum + parseFloat(v.consultationFee || '0'), 0);
    const medicationCosts = visits.reduce((sum, v) => sum + parseFloat(v.medicationCost || '0'), 0);
    const procedureCosts = visits.reduce((sum, v) => sum + parseFloat(v.procedureCost || '0'), 0);
    const travelCosts = visits.reduce((sum, v) => sum + parseFloat(v.travelCost || '0'), 0);
    const labTestCosts = labTests.reduce((sum, l) => sum + parseFloat(l.testCost || '0'), 0);
    const totalCosts = consultationCosts + medicationCosts + procedureCosts + travelCosts + labTestCosts;

    return {
      totalCosts,
      consultationCosts,
      medicationCosts,
      procedureCosts,
      labTestCosts,
      travelCosts,
      visitCount: visits.length,
    };
  }
}

export const storage = new DatabaseStorage();
