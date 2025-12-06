import express, { type Request, Response } from "express";
import { storage } from "./storage";
import { 
  type InsertVisitor, 
  type InsertVisitorSignIn, 
  type InsertQRCode,
  type Visitor,
  type VisitorSignIn,
  type QRCode
} from "@shared/schema";
import { z } from "zod";
import { nanoid } from "nanoid";

const router = express.Router();

// Validation schemas
const visitorSignInSchema = z.object({
  name: z.string().min(1, "Name is required"),
  company: z.string().min(1, "Company is required"),
  email: z.string().email().optional(),
  phone: z.string().min(1, "Phone is required"),
  purpose: z.string().min(1, "Purpose is required"),
  emergencyContact: z.string().min(1, "Emergency contact is required"),
  emergencyPhone: z.string().min(1, "Emergency phone is required"),
  hostPerson: z.string().min(1, "Host person is required"),
  vehicleRegistration: z.string().optional(),
  safetyAcknowledged: z.boolean().default(false),
  biosecurityAcknowledged: z.boolean().default(false),
  emergencyAcknowledged: z.boolean().default(false),
  signatureData: z.string().optional(),
  photoConsent: z.boolean().default(false),
  notes: z.string().optional(),
});

const qrCodeCreateSchema = z.object({
  locationName: z.string().min(1, "Location name is required"),
  farmName: z.string().min(1, "Farm name is required"),
  description: z.string().optional(),
  maxUsage: z.number().positive().optional(),
  expiresAt: z.string().datetime().optional(),
});

// ===== PUBLIC VISITOR ROUTES (NO AUTHENTICATION REQUIRED) =====

// Get QR code details by code (public endpoint)
router.get("/qr/:code", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    
    if (!code) {
      return res.status(400).json({ error: "QR code is required" });
    }

    const qrCode = await storage.getQRCodeByCode(code);
    
    if (!qrCode) {
      return res.status(404).json({ error: "QR code not found or inactive" });
    }

    // Check if QR code has expired
    if (qrCode.expiresAt && new Date(qrCode.expiresAt) < new Date()) {
      return res.status(410).json({ error: "QR code has expired" });
    }

    // Check if QR code has exceeded max usage
    if (qrCode.maxUsage && qrCode.usageCount >= qrCode.maxUsage) {
      return res.status(410).json({ error: "QR code has exceeded maximum usage" });
    }

    // Increment usage count
    await storage.incrementQRCodeUsage(code);

    res.json({
      success: true,
      qrCode: {
        id: qrCode.id,
        code: qrCode.code,
        locationName: qrCode.locationName,
        farmName: qrCode.farmName,
        description: qrCode.description,
      }
    });
  } catch (error) {
    console.error("Error fetching QR code:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Visitor sign-in (public endpoint)
router.post("/signin/:locationCode", async (req: Request, res: Response) => {
  try {
    const { locationCode } = req.params;
    
    if (!locationCode) {
      return res.status(400).json({ error: "Location code is required" });
    }

    // Validate request body
    const validationResult = visitorSignInSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid visitor data", 
        details: validationResult.error.errors 
      });
    }

    const visitorData = validationResult.data;

    // Get QR code details
    const qrCode = await storage.getQRCodeByCode(locationCode);
    if (!qrCode) {
      return res.status(404).json({ error: "Invalid location code" });
    }

    // Check if QR code has expired
    if (qrCode.expiresAt && new Date(qrCode.expiresAt) < new Date()) {
      return res.status(410).json({ error: "Location code has expired" });
    }

    // Check if QR code has exceeded max usage
    if (qrCode.maxUsage && qrCode.usageCount >= qrCode.maxUsage) {
      return res.status(410).json({ error: "Location code has exceeded maximum usage" });
    }

    // Check if visitor already exists by phone or email
    let existingVisitor: Visitor | null = null;
    if (visitorData.phone) {
      existingVisitor = await storage.getVisitorByPhone(visitorData.phone);
    }
    if (!existingVisitor && visitorData.email) {
      existingVisitor = await storage.getVisitorByEmail(visitorData.email);
    }

    let visitor: Visitor;
    if (existingVisitor) {
      // Update existing visitor
      visitor = await storage.updateVisitor(existingVisitor.id, {
        name: visitorData.name,
        company: visitorData.company,
        email: visitorData.email || existingVisitor.email,
        phone: visitorData.phone,
        emergencyContact: visitorData.emergencyContact,
        emergencyPhone: visitorData.emergencyPhone,
      }) || existingVisitor;
    } else {
      // Create new visitor
      const newVisitor: InsertVisitor = {
        name: visitorData.name,
        company: visitorData.company,
        email: visitorData.email || null,
        phone: visitorData.phone,
        emergencyContact: visitorData.emergencyContact,
        emergencyPhone: visitorData.emergencyPhone,
      };
      visitor = await storage.createVisitor(newVisitor);
    }

    // Create visitor sign-in record
    const signInData: InsertVisitorSignIn = {
      visitorId: visitor.id,
      farmName: qrCode.farmName,
      locationCode: locationCode,
      purpose: visitorData.purpose,
      hostPerson: visitorData.hostPerson,
      vehicleRegistration: visitorData.vehicleRegistration || null,
      safetyAcknowledged: visitorData.safetyAcknowledged,
      biosecurityAcknowledged: visitorData.biosecurityAcknowledged,
      emergencyAcknowledged: visitorData.emergencyAcknowledged,
      signatureData: visitorData.signatureData || null,
      photoConsent: visitorData.photoConsent,
      notes: visitorData.notes || null,
    };

    const signIn = await storage.createVisitorSignIn(signInData);

    // Increment QR code usage
    await storage.incrementQRCodeUsage(locationCode);

    res.json({
      success: true,
      message: "Visitor signed in successfully",
      visitor: {
        id: visitor.id,
        name: visitor.name,
        company: visitor.company,
        signInTime: signIn.signInTime,
        farmName: signIn.farmName,
        locationCode: signIn.locationCode,
      },
      signIn: {
        id: signIn.id,
        signInTime: signIn.signInTime,
        purpose: signIn.purpose,
        hostPerson: signIn.hostPerson,
      }
    });
  } catch (error) {
    console.error("Error during visitor sign-in:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Visitor sign-out (public endpoint)
router.post("/signout/:signInId", async (req: Request, res: Response) => {
  try {
    const { signInId } = req.params;
    
    if (!signInId) {
      return res.status(400).json({ error: "Sign-in ID is required" });
    }

    const signIn = await storage.signOutVisitor(signInId);
    
    if (!signIn) {
      return res.status(404).json({ error: "Sign-in record not found" });
    }

    res.json({
      success: true,
      message: "Visitor signed out successfully",
      signOutTime: signIn.signOutTime,
    });
  } catch (error) {
    console.error("Error during visitor sign-out:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===== ADMIN VISITOR ROUTES (AUTHENTICATION REQUIRED) =====

// These will be protected by authentication middleware in the main app

// Get all visitors
router.get("/admin/visitors", async (req: Request, res: Response) => {
  try {
    const visitors = await storage.getAllVisitors();
    res.json({ success: true, visitors });
  } catch (error) {
    console.error("Error fetching visitors:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get visitor by ID
router.get("/admin/visitors/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const visitor = await storage.getVisitorById(id);
    
    if (!visitor) {
      return res.status(404).json({ error: "Visitor not found" });
    }

    res.json({ success: true, visitor });
  } catch (error) {
    console.error("Error fetching visitor:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get visitor sign-ins by visitor ID
router.get("/admin/visitors/:id/signins", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const signIns = await storage.getVisitorSignInsByVisitor(id);
    res.json({ success: true, signIns });
  } catch (error) {
    console.error("Error fetching visitor sign-ins:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all active visitor sign-ins
router.get("/admin/signins/active", async (req: Request, res: Response) => {
  try {
    const activeSignIns = await storage.getActiveVisitorSignIns();
    res.json({ success: true, signIns: activeSignIns });
  } catch (error) {
    console.error("Error fetching active sign-ins:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get visitor sign-ins by date range
router.get("/admin/signins/date-range", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Start date and end date are required" });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const signIns = await storage.getVisitorSignInsByDateRange(start, end);
    res.json({ success: true, signIns });
  } catch (error) {
    console.error("Error fetching sign-ins by date range:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get visitor statistics
router.get("/admin/stats", async (req: Request, res: Response) => {
  try {
    const stats = await storage.getVisitorStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error("Error fetching visitor stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===== QR CODE MANAGEMENT ROUTES =====

// Create new QR code
router.post("/admin/qrcodes", async (req: Request, res: Response) => {
  try {
    const validationResult = qrCodeCreateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid QR code data", 
        details: validationResult.error.errors 
      });
    }

    const qrCodeData = validationResult.data;
    const code = nanoid(8).toUpperCase(); // Generate 8-character code
    
    const newQRCode: InsertQRCode = {
      code,
      locationName: qrCodeData.locationName,
      farmName: qrCodeData.farmName,
      description: qrCodeData.description || null,
      maxUsage: qrCodeData.maxUsage || null,
      expiresAt: qrCodeData.expiresAt ? new Date(qrCodeData.expiresAt) : null,
      createdBy: (req as any).user?.id || "unknown", // This will be set by auth middleware
    };

    const qrCode = await storage.createQRCode(newQRCode);
    
    res.status(201).json({
      success: true,
      message: "QR code created successfully",
      qrCode: {
        id: qrCode.id,
        code: qrCode.code,
        locationName: qrCode.locationName,
        farmName: qrCode.farmName,
        description: qrCode.description,
        maxUsage: qrCode.maxUsage,
        expiresAt: qrCode.expiresAt,
        usageCount: qrCode.usageCount,
        isActive: qrCode.isActive,
        createdAt: qrCode.createdAt,
      }
    });
  } catch (error) {
    console.error("Error creating QR code:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all QR codes
router.get("/admin/qrcodes", async (req: Request, res: Response) => {
  try {
    const qrCodes = await storage.getAllQRCodes();
    res.json({ success: true, qrCodes });
  } catch (error) {
    console.error("Error fetching QR codes:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update QR code
router.put("/admin/qrcodes/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validationResult = qrCodeCreateSchema.partial().safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid QR code data", 
        details: validationResult.error.errors 
      });
    }

    const updates = validationResult.data;
    const updatedQRCode = await storage.updateQRCode(id, updates);
    
    if (!updatedQRCode) {
      return res.status(404).json({ error: "QR code not found" });
    }

    res.json({
      success: true,
      message: "QR code updated successfully",
      qrCode: updatedQRCode,
    });
  } catch (error) {
    console.error("Error updating QR code:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Deactivate QR code
router.delete("/admin/qrcodes/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deactivatedQRCode = await storage.deactivateQRCode(id);
    
    if (!deactivatedQRCode) {
      return res.status(404).json({ error: "QR code not found" });
    }

    res.json({
      success: true,
      message: "QR code deactivated successfully",
    });
  } catch (error) {
    console.error("Error deactivating QR code:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
