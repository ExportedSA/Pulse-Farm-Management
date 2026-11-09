import { Router } from 'express';
import { getUserId } from '../middleware/auth';
import { z } from 'zod';
import { db } from '../db';
import {
  contractors,
  contractorDocuments,
  contractorWorkRecords,
  users,
} from '@shared/schema';
import { eq, and, desc, like, or, gte, lte, sql } from 'drizzle-orm';

const router = Router();

// ===== CONTRACTORS =====

// GET /api/contractors - Get all contractors
router.get('/', async (req, res) => {
  try {
    const { active, serviceType, status, search } = req.query;
    
    const results = await db
      .select()
      .from(contractors)
      .orderBy(desc(contractors.createdAt));

    // Filter in memory for demo
    let filtered = results;
    
    if (active === 'true') {
      filtered = filtered.filter(r => r.isActive);
    } else if (active === 'false') {
      filtered = filtered.filter(r => !r.isActive);
    }
    
    if (serviceType) {
      filtered = filtered.filter(r => r.serviceType === serviceType);
    }
    
    if (status) {
      filtered = filtered.filter(r => r.preQualificationStatus === status);
    }
    
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = filtered.filter(r => 
        r.companyName.toLowerCase().includes(searchLower) ||
        r.contactName?.toLowerCase().includes(searchLower) ||
        r.email?.toLowerCase().includes(searchLower)
      );
    }

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching contractors:', error);
    res.status(500).json({ error: 'Failed to fetch contractors' });
  }
});

// GET /api/contractors/:id - Get single contractor
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db
      .select()
      .from(contractors)
      .where(eq(contractors.id, id))
      .limit(1);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    // Get documents
    const docs = await db
      .select()
      .from(contractorDocuments)
      .where(eq(contractorDocuments.contractorId, id));

    // Get work records
    const workRecords = await db
      .select()
      .from(contractorWorkRecords)
      .where(eq(contractorWorkRecords.contractorId, id))
      .orderBy(desc(contractorWorkRecords.date))
      .limit(10);

    res.json({
      ...result[0],
      documents: docs,
      recentWork: workRecords,
    });
  } catch (error) {
    console.error('Error fetching contractor:', error);
    res.status(500).json({ error: 'Failed to fetch contractor' });
  }
});

// POST /api/contractors - Create contractor
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    
    const [newContractor] = await db
      .insert(contractors)
      .values(data)
      .returning();

    res.status(201).json(newContractor);
  } catch (error) {
    console.error('Error creating contractor:', error);
    res.status(500).json({ error: 'Failed to create contractor' });
  }
});

// PUT /api/contractors/:id - Update contractor
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const [updated] = await db
      .update(contractors)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contractors.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating contractor:', error);
    res.status(500).json({ error: 'Failed to update contractor' });
  }
});

// DELETE /api/contractors/:id - Deactivate contractor
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await db
      .update(contractors)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(contractors.id, id));

    res.json({ message: 'Contractor deactivated' });
  } catch (error) {
    console.error('Error deactivating contractor:', error);
    res.status(500).json({ error: 'Failed to deactivate contractor' });
  }
});

// ===== PRE-QUALIFICATION =====

// PUT /api/contractors/:id/approve - Approve contractor
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year validity

    const [updated] = await db
      .update(contractors)
      .set({
        preQualificationStatus: 'approved',
        preQualificationDate: new Date().toISOString().split('T')[0],
        preQualificationExpiryDate: expiryDate.toISOString().split('T')[0],
        updatedAt: new Date(),
      })
      .where(eq(contractors.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error approving contractor:', error);
    res.status(500).json({ error: 'Failed to approve contractor' });
  }
});

// PUT /api/contractors/:id/reject - Reject contractor
router.put('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;

    const [updated] = await db
      .update(contractors)
      .set({
        preQualificationStatus: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(contractors.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error rejecting contractor:', error);
    res.status(500).json({ error: 'Failed to reject contractor' });
  }
});

// ===== DOCUMENTS =====

// GET /api/contractors/:id/documents - Get contractor documents
router.get('/:id/documents', async (req, res) => {
  try {
    const { id } = req.params;
    
    const docs = await db
      .select()
      .from(contractorDocuments)
      .where(eq(contractorDocuments.contractorId, id))
      .orderBy(desc(contractorDocuments.createdAt));

    res.json(docs);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.json([]);
  }
});

// POST /api/contractors/:id/documents - Add document
router.post('/:id/documents', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const [newDoc] = await db
      .insert(contractorDocuments)
      .values({ ...data, contractorId: id })
      .returning();

    res.status(201).json(newDoc);
  } catch (error) {
    console.error('Error adding document:', error);
    res.status(500).json({ error: 'Failed to add document' });
  }
});

// PUT /api/contractors/documents/:docId/verify - Verify document
router.put('/documents/:docId/verify', async (req, res) => {
  try {
    const { docId } = req.params;
    const userId = getUserId(req)!; // requireAuth guarantees a user

    const [updated] = await db
      .update(contractorDocuments)
      .set({
        isVerified: true,
        verifiedBy: userId,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contractorDocuments.id, docId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error verifying document:', error);
    res.status(500).json({ error: 'Failed to verify document' });
  }
});

// DELETE /api/contractors/documents/:docId - Delete document
router.delete('/documents/:docId', async (req, res) => {
  try {
    const { docId } = req.params;

    await db
      .delete(contractorDocuments)
      .where(eq(contractorDocuments.id, docId));

    res.json({ message: 'Document deleted' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// ===== WORK RECORDS =====

// GET /api/contractors/:id/work - Get contractor work records
router.get('/:id/work', async (req, res) => {
  try {
    const { id } = req.params;
    
    const records = await db
      .select()
      .from(contractorWorkRecords)
      .where(eq(contractorWorkRecords.contractorId, id))
      .orderBy(desc(contractorWorkRecords.date));

    res.json(records);
  } catch (error) {
    console.error('Error fetching work records:', error);
    res.json([]);
  }
});

// POST /api/contractors/:id/work - Add work record
router.post('/:id/work', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const [newRecord] = await db
      .insert(contractorWorkRecords)
      .values({ ...data, contractorId: id })
      .returning();

    res.status(201).json(newRecord);
  } catch (error) {
    console.error('Error adding work record:', error);
    res.status(500).json({ error: 'Failed to add work record' });
  }
});

// PUT /api/contractors/work/:recordId - Update work record
router.put('/work/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const data = req.body;

    const [updated] = await db
      .update(contractorWorkRecords)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contractorWorkRecords.id, recordId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error updating work record:', error);
    res.status(500).json({ error: 'Failed to update work record' });
  }
});

// GET /api/contractors/expiring - Get contractors with expiring documents/qualifications
router.get('/status/expiring', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const until = futureDate.toISOString().slice(0, 10);
    const rows = await db.execute(sql`
      SELECT c.id, c.company_name AS "companyName", 'insurance' AS type, c.insurance_expiry_date AS "expiryDate"
      FROM contractors c WHERE c.insurance_expiry_date IS NOT NULL AND c.insurance_expiry_date <= ${until}::date
      UNION ALL
      SELECT c.id, c.company_name, 'pre_qualification', c.pre_qualification_expiry_date
      FROM contractors c WHERE c.pre_qualification_expiry_date IS NOT NULL AND c.pre_qualification_expiry_date <= ${until}::date
      UNION ALL
      SELECT c.id, c.company_name, d.document_type, d.expiry_date
      FROM contractor_documents d JOIN contractors c ON c.id = d.contractor_id
      WHERE d.expiry_date IS NOT NULL AND d.expiry_date <= ${until}::date
      ORDER BY 4`);
    const today = new Date(new Date().toISOString().slice(0, 10));
    res.json((((rows as any).rows ?? rows) as any[]).map(r => {
      const expiry = String(r.expiryDate).slice(0, 10);
      return { ...r, expiryDate: expiry, daysUntilExpiry: Math.round((new Date(expiry).getTime() - today.getTime()) / 86400000) };
    }));
  } catch (error) {
    console.error('Error fetching expiring contractors:', error);
    res.status(500).json({ error: 'Failed to fetch expiring contractors' });
  }
});

// GET /api/contractors/service-types - Get list of service types
router.get('/meta/service-types', async (req, res) => {
  res.json([
    { value: 'fencing', label: 'Fencing' },
    { value: 'shearing', label: 'Shearing' },
    { value: 'veterinary', label: 'Veterinary' },
    { value: 'transport', label: 'Transport' },
    { value: 'earthworks', label: 'Earthworks' },
    { value: 'spraying', label: 'Spraying' },
    { value: 'fertilizer', label: 'Fertilizer Application' },
    { value: 'electrical', label: 'Electrical' },
    { value: 'plumbing', label: 'Plumbing' },
    { value: 'building', label: 'Building/Construction' },
    { value: 'other', label: 'Other' },
  ]);
});

export default router;
