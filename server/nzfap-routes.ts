import { Router } from 'express';
import { z } from 'zod';
import { storage } from './storage';
import { 
  insertComplianceStandardSchema, 
  insertComplianceCheckSchema, 
  insertComplianceAuditSchema, 
  insertComplianceDocumentSchema 
} from '@shared/schema';

const router = Router();

// ===== COMPLIANCE STANDARDS =====

// Get all compliance standards
router.get('/standards', async (req, res) => {
  try {
    const { category, requirementLevel, isActive } = req.query;
    
    const filters: any = {};
    if (category) filters.category = category as string;
    if (requirementLevel) filters.requirementLevel = requirementLevel as string;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    
    const standards = await storage.getComplianceStandards(filters);
    res.json(standards);
  } catch (error) {
    console.error('Error fetching compliance standards:', error);
    res.status(500).json({ error: 'Failed to fetch compliance standards' });
  }
});

// Get compliance standard by ID
router.get('/standards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const standard = await storage.getComplianceStandardById(id);
    
    if (!standard) {
      return res.status(404).json({ error: 'Compliance standard not found' });
    }
    
    res.json(standard);
  } catch (error) {
    console.error('Error fetching compliance standard:', error);
    res.status(500).json({ error: 'Failed to fetch compliance standard' });
  }
});

// Create compliance standard
router.post('/standards', async (req, res) => {
  try {
    const validatedData = insertComplianceStandardSchema.parse(req.body);
    const standard = await storage.createComplianceStandard(validatedData);
    res.status(201).json(standard);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid compliance standard data', details: error.errors });
    } else {
      console.error('Error creating compliance standard:', error);
      res.status(500).json({ error: 'Failed to create compliance standard' });
    }
  }
});

// ===== COMPLIANCE CHECKS =====

// Get compliance checks
router.get('/checks', async (req, res) => {
  try {
    const { standardId, status, startDate, endDate, limit } = req.query;
    
    const filters: any = {};
    if (standardId) filters.standardId = standardId as string;
    if (status) filters.status = status as string;
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;
    if (limit) filters.limit = parseInt(limit as string);
    
    const checks = await storage.getComplianceChecks(filters);
    res.json(checks);
  } catch (error) {
    console.error('Error fetching compliance checks:', error);
    res.status(500).json({ error: 'Failed to fetch compliance checks' });
  }
});

// Get compliance checks by standard
router.get('/standards/:standardId/checks', async (req, res) => {
  try {
    const { standardId } = req.params;
    const checks = await storage.getComplianceChecks({ standardId });
    res.json(checks);
  } catch (error) {
    console.error('Error fetching compliance checks for standard:', error);
    res.status(500).json({ error: 'Failed to fetch compliance checks' });
  }
});

// Create compliance check
router.post('/checks', async (req, res) => {
  try {
    const validatedData = insertComplianceCheckSchema.parse(req.body);
    const check = await storage.createComplianceCheck(validatedData);
    res.status(201).json(check);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid compliance check data', details: error.errors });
    } else {
      console.error('Error creating compliance check:', error);
      res.status(500).json({ error: 'Failed to create compliance check' });
    }
  }
});

// Update compliance check
router.put('/checks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const check = await storage.updateComplianceCheck(id, updates);
    
    if (!check) {
      return res.status(404).json({ error: 'Compliance check not found' });
    }
    
    res.json(check);
  } catch (error) {
    console.error('Error updating compliance check:', error);
    res.status(500).json({ error: 'Failed to update compliance check' });
  }
});

// ===== COMPLIANCE AUDITS =====

// Get compliance audits
router.get('/audits', async (req, res) => {
  try {
    const { auditType, status, limit } = req.query;
    
    const filters: any = {};
    if (auditType) filters.auditType = auditType as string;
    if (status) filters.status = status as string;
    if (limit) filters.limit = parseInt(limit as string);
    
    const audits = await storage.getComplianceAudits(filters);
    res.json(audits);
  } catch (error) {
    console.error('Error fetching compliance audits:', error);
    res.status(500).json({ error: 'Failed to fetch compliance audits' });
  }
});

// Get compliance audit by ID
router.get('/audits/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await storage.getComplianceAuditById(id);
    
    if (!audit) {
      return res.status(404).json({ error: 'Compliance audit not found' });
    }
    
    res.json(audit);
  } catch (error) {
    console.error('Error fetching compliance audit:', error);
    res.status(500).json({ error: 'Failed to fetch compliance audit' });
  }
});

// Create compliance audit
router.post('/audits', async (req, res) => {
  try {
    const validatedData = insertComplianceAuditSchema.parse(req.body);
    const audit = await storage.createComplianceAudit(validatedData);
    res.status(201).json(audit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid compliance audit data', details: error.errors });
    } else {
      console.error('Error creating compliance audit:', error);
      res.status(500).json({ error: 'Failed to create compliance audit' });
    }
  }
});

// Update compliance audit
router.put('/audits/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const audit = await storage.updateComplianceAudit(id, updates);
    
    if (!audit) {
      return res.status(404).json({ error: 'Compliance audit not found' });
    }
    
    res.json(audit);
  } catch (error) {
    console.error('Error updating compliance audit:', error);
    res.status(500).json({ error: 'Failed to update compliance audit' });
  }
});

// ===== COMPLIANCE DOCUMENTS =====

// Get compliance documents
router.get('/documents', async (req, res) => {
  try {
    const { category, documentType, isRequired, isCurrent } = req.query;
    
    const filters: any = {};
    if (category) filters.category = category as string;
    if (documentType) filters.documentType = documentType as string;
    if (isRequired !== undefined) filters.isRequired = isRequired === 'true';
    if (isCurrent !== undefined) filters.isCurrent = isCurrent === 'true';
    
    const documents = await storage.getComplianceDocuments(filters);
    res.json(documents);
  } catch (error) {
    console.error('Error fetching compliance documents:', error);
    res.status(500).json({ error: 'Failed to fetch compliance documents' });
  }
});

// Get compliance document by ID
router.get('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const document = await storage.getComplianceDocumentById(id);
    
    if (!document) {
      return res.status(404).json({ error: 'Compliance document not found' });
    }
    
    res.json(document);
  } catch (error) {
    console.error('Error fetching compliance document:', error);
    res.status(500).json({ error: 'Failed to fetch compliance document' });
  }
});

// Create compliance document
router.post('/documents', async (req, res) => {
  try {
    const validatedData = insertComplianceDocumentSchema.parse(req.body);
    const document = await storage.createComplianceDocument(validatedData);
    res.status(201).json(document);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid compliance document data', details: error.errors });
    } else {
      console.error('Error creating compliance document:', error);
      res.status(500).json({ error: 'Failed to create compliance document' });
    }
  }
});

// Update compliance document
router.put('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const document = await storage.updateComplianceDocument(id, updates);
    
    if (!document) {
      return res.status(404).json({ error: 'Compliance document not found' });
    }
    
    res.json(document);
  } catch (error) {
    console.error('Error updating compliance document:', error);
    res.status(500).json({ error: 'Failed to update compliance document' });
  }
});

// Delete compliance document
router.delete('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteComplianceDocument(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Compliance document not found' });
    }
    
    res.json({ message: 'Compliance document deleted successfully' });
  } catch (error) {
    console.error('Error deleting compliance document:', error);
    res.status(500).json({ error: 'Failed to delete compliance document' });
  }
});

// ===== COMPLIANCE DASHBOARD =====

// Get compliance dashboard summary
router.get('/dashboard', async (req, res) => {
  try {
    const dashboard = await storage.getComplianceDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error('Error fetching compliance dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch compliance dashboard' });
  }
});

// Get compliance score by category
router.get('/scores', async (req, res) => {
  try {
    const { category } = req.query;
    const scores = await storage.getComplianceScores(category as string | undefined);
    res.json(scores);
  } catch (error) {
    console.error('Error fetching compliance scores:', error);
    res.status(500).json({ error: 'Failed to fetch compliance scores' });
  }
});

// Get upcoming compliance tasks
router.get('/tasks/upcoming', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const tasks = await storage.getUpcomingComplianceTasks(parseInt(days as string));
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching upcoming compliance tasks:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming compliance tasks' });
  }
});

// Get overdue compliance items
router.get('/tasks/overdue', async (req, res) => {
  try {
    const items = await storage.getOverdueComplianceItems();
    res.json(items);
  } catch (error) {
    console.error('Error fetching overdue compliance items:', error);
    res.status(500).json({ error: 'Failed to fetch overdue compliance items' });
  }
});

// Generate compliance report
router.post('/reports/generate', async (req, res) => {
  try {
    const { reportType, startDate, endDate, category } = req.body;
    
    const report = await storage.generateComplianceReport({
      reportType,
      startDate,
      endDate,
      category,
    });
    
    res.json(report);
  } catch (error) {
    console.error('Error generating compliance report:', error);
    res.status(500).json({ error: 'Failed to generate compliance report' });
  }
});

// Initialize NZFAP standards
router.post('/initialize', async (req, res) => {
  try {
    await storage.initializeNZFAPStandards();
    res.json({ message: 'NZFAP standards initialized successfully' });
  } catch (error) {
    console.error('Error initializing NZFAP standards:', error);
    res.status(500).json({ error: 'Failed to initialize NZFAP standards' });
  }
});

export default router;
