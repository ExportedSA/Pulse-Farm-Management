import { storage } from "./storage";

async function seedUsers() {
  try {
    console.log("Creating test users...");

    const testUsers = [
      {
        name: "Admin User",
        role: "owner" as const,
        email: "admin@pulse.farm",
        password: "admin123",
      },
      {
        name: "Farm Manager",
        role: "manager" as const,
        email: "manager@pulse.farm",
        password: "manager123",
      },
      {
        name: "Staff Member",
        role: "worker" as const,
        email: "staff@pulse.farm",
        password: "staff123",
      },
    ];

    for (const userData of testUsers) {
      const existingUser = await storage.getUserByEmail(userData.email);
      if (!existingUser) {
        await storage.createUser(userData);
        console.log(`✓ Created user: ${userData.email} (password: ${userData.password})`);
      } else {
        console.log(`- User already exists: ${userData.email}`);
      }
    }

    console.log("\n=== Seed users created ===");
    console.log("Login credentials:");
    console.log("  Admin:   admin@pulse.farm / admin123");
    console.log("  Manager: manager@pulse.farm / manager123");
    console.log("  Staff:   staff@pulse.farm / staff123");
    
    process.exit(0);
  } catch (error) {
    console.error("Failed to seed users:", error);
    process.exit(1);
  }
}

seedUsers();
