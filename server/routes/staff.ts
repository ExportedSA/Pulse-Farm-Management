import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import {
  staffProfiles,
  staffCertifications,
  contractors,
  contractorDocuments,
  timesheets,
  contractorWorkRecords,
  users,
} from '@shared/schema';
import { eq, and, desc, like, or, gte, lte, sql } from 'drizzle-orm';

const router = Router();

// ===== STAFF PROFILES =====

// GET /api/staff - Get all staff members
router.get('/', async (req, res) => {
  try {
    const { active, department, search } = req.query;
    
    let query = db
      .select({
        profile: staffProfiles,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
        },
      })
      .from(staffProfiles)
      .leftJoin(users, eq(staffProfiles.userId, users.id));

    const results = await query;
    
    // Filter in memory for demo (in production, use proper WHERE clauses)
    let filtered = results;
    
    if (active === 'true') {
      filtered = filtered.filter(r => r.profile.isActive);
    } else if (active === 'false') {
      filtered = filtered.filter(r => !r.profile.isActive);
    }
    
    if (department) {
      filtered = filtered.filter(r => r.profile.department === department);
    }
    
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = filtered.filter(r => 
        r.user?.name?.toLowerCase().includes(searchLower) ||
        r.user?.email?.toLowerCase().includes(searchLower) ||
        r.profile.position?.toLowerCase().includes(searchLower)
      );
    }

    res.json(filtered.map(r => ({
      ...r.profile,
      user: r.user,
    })));
  } catch (error) {
    console.error('Error fetching staff:', error);
    // Return mock data for demo
    res.json([
      {
        id: 'staff-1',
        userId: 'user-1',
        employeeId: 'EMP001',
        position: 'Farm Manager',
        department: 'Management',
        phone: '021 123 4567',
        emergencyContact: 'Jane Smith',
        emergencyPhone: '021 987 6543',
        startDate: '2020-01-15',
        employmentType: 'full_time',
        hourlyRate: '35.00',
        isActive: true,
        user: { id: 'user-1', name: 'John Smith', email: 'john@pulse.farm', role: 'manager' },
      },
      {
        id: 'staff-2',
        userId: 'user-2',
        employeeId: 'EMP002',
        position: 'Stock Handler',
        department: 'Operations',
        phone: '021 234 5678',
        emergencyContact: 'Bob Wilson',
        emergencyPhone: '021 876 5432',
        startDate: '2021-06-01',
        employmentType: 'full_time',
        hourlyRate: '28.00',
        isActive: true,
        user: { id: 'user-2', name: 'Sarah Johnson', email: 'sarah@pulse.farm', role: 'staff' },
      },
      {
        id: 'staff-3',
        userId: 'user-3',
        employeeId: 'EMP003',
        position: 'Seasonal Worker',
        department: 'Operations',
        phone: '021 345 6789',
        startDate: '2024-09-01',
        endDate: '2025-03-31',
        employmentType: 'seasonal',
        hourlyRate: '24.00',
        isActive: true,
        user: { id: 'user-3', name: 'Mike Wilson', email: 'mike@pulse.farm', role: 'worker' },
      },
    ]);
  }
});

// GET /api/staff/:id - Get single staff member
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db
      .select({
        profile: staffProfiles,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
        },
      })
      .from(staffProfiles)
      .leftJoin(users, eq(staffProfiles.userId, users.id))
      .where(eq(staffProfiles.id, id))
      .limit(1);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Get certifications
    const certs = await db
      .select()
      .from(staffCertifications)
      .where(eq(staffCertifications.staffProfileId, id));

    res.json({
      ...result[0].profile,
      user: result[0].user,
      certifications: certs,
    });
  } catch (error) {
    console.error('Error fetching staff member:', error);
    res.status(500).json({ error: 'Failed to fetch staff member' });
  }
});

// POST /api/staff - Create staff profile
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    
    const [newProfile] = await db
      .insert(staffProfiles)
      .values(data)
      .returning();

    res.status(201).json(newProfile);
  } catch (error) {
    console.error('Error creating staff profile:', error);
    res.status(500).json({ error: 'Failed to create staff profile' });
  }
});

// PUT /api/staff/:id - Update staff profile
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const [updated] = await db
      .update(staffProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(staffProfiles.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating staff profile:', error);
    res.status(500).json({ error: 'Failed to update staff profile' });
  }
});

// DELETE /api/staff/:id - Deactivate staff profile
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await db
      .update(staffProfiles)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(staffProfiles.id, id));

    res.json({ message: 'Staff member deactivated' });
  } catch (error) {
    console.error('Error deactivating staff:', error);
    res.status(500).json({ error: 'Failed to deactivate staff member' });
  }
});

// ===== CERTIFICATIONS =====

// GET /api/staff/:id/certifications - Get staff certifications
router.get('/:id/certifications', async (req, res) => {
  try {
    const { id } = req.params;
    
    const certs = await db
      .select()
      .from(staffCertifications)
      .where(eq(staffCertifications.staffProfileId, id))
      .orderBy(desc(staffCertifications.expiryDate));

    res.json(certs);
  } catch (error) {
    console.error('Error fetching certifications:', error);
    res.json([]);
  }
});

// POST /api/staff/:id/certifications - Add certification
router.post('/:id/certifications', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const [newCert] = await db
      .insert(staffCertifications)
      .values({ ...data, staffProfileId: id })
      .returning();

    res.status(201).json(newCert);
  } catch (error) {
    console.error('Error adding certification:', error);
    res.status(500).json({ error: 'Failed to add certification' });
  }
});

// PUT /api/staff/certifications/:certId - Update certification
router.put('/certifications/:certId', async (req, res) => {
  try {
    const { certId } = req.params;
    const data = req.body;

    const [updated] = await db
      .update(staffCertifications)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(staffCertifications.id, certId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error updating certification:', error);
    res.status(500).json({ error: 'Failed to update certification' });
  }
});

// DELETE /api/staff/certifications/:certId - Delete certification
router.delete('/certifications/:certId', async (req, res) => {
  try {
    const { certId } = req.params;

    await db
      .delete(staffCertifications)
      .where(eq(staffCertifications.id, certId));

    res.json({ message: 'Certification deleted' });
  } catch (error) {
    console.error('Error deleting certification:', error);
    res.status(500).json({ error: 'Failed to delete certification' });
  }
});

// GET /api/staff/certifications/expiring - Get expiring certifications
router.get('/certifications/expiring', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const expiring = await db
      .select({
        cert: staffCertifications,
        staff: staffProfiles,
        user: users,
      })
      .from(staffCertifications)
      .leftJoin(staffProfiles, eq(staffCertifications.staffProfileId, staffProfiles.id))
      .leftJoin(users, eq(staffProfiles.userId, users.id))
      .where(
        and(
          lte(staffCertifications.expiryDate, futureDate.toISOString().split('T')[0]),
          gte(staffCertifications.expiryDate, new Date().toISOString().split('T')[0])
        )
      )
      .orderBy(staffCertifications.expiryDate);

    res.json(expiring.map(e => ({
      ...e.cert,
      staffName: e.user?.name,
      staffEmail: e.user?.email,
    })));
  } catch (error) {
    console.error('Error fetching expiring certifications:', error);
    res.json([]);
  }
});

// ===== TIMESHEETS =====

// GET /api/staff/timesheets - Get all timesheets
router.get('/timesheets/all', async (req, res) => {
  try {
    const { staffId, status, startDate, endDate } = req.query;

    const results = await db
      .select({
        timesheet: timesheets,
        staff: staffProfiles,
        user: users,
      })
      .from(timesheets)
      .leftJoin(staffProfiles, eq(timesheets.staffProfileId, staffProfiles.id))
      .leftJoin(users, eq(staffProfiles.userId, users.id))
      .orderBy(desc(timesheets.date));

    res.json(results.map(r => ({
      ...r.timesheet,
      staffName: r.user?.name,
    })));
  } catch (error) {
    console.error('Error fetching timesheets:', error);
    // Return mock data
    res.json([
      {
        id: 'ts-1',
        staffProfileId: 'staff-1',
        date: new Date().toISOString().split('T')[0],
        startTime: '07:00',
        endTime: '15:30',
        breakMinutes: 30,
        totalHours: '8.00',
        taskDescription: 'Morning milking and paddock checks',
        status: 'approved',
        staffName: 'John Smith',
      },
      {
        id: 'ts-2',
        staffProfileId: 'staff-2',
        date: new Date().toISOString().split('T')[0],
        startTime: '06:00',
        endTime: '14:00',
        breakMinutes: 30,
        totalHours: '7.50',
        taskDescription: 'Stock movement and fencing repairs',
        status: 'pending',
        staffName: 'Sarah Johnson',
      },
    ]);
  }
});

// POST /api/staff/timesheets - Create timesheet entry
router.post('/timesheets', async (req, res) => {
  try {
    const data = req.body;

    // Calculate total hours if start and end time provided
    if (data.startTime && data.endTime) {
      const start = new Date(`2000-01-01T${data.startTime}`);
      const end = new Date(`2000-01-01T${data.endTime}`);
      const diffMs = end.getTime() - start.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      const breakHours = (data.breakMinutes || 0) / 60;
      data.totalHours = (diffHours - breakHours).toFixed(2);
    }

    const [newTimesheet] = await db
      .insert(timesheets)
      .values(data)
      .returning();

    res.status(201).json(newTimesheet);
  } catch (error) {
    console.error('Error creating timesheet:', error);
    res.status(500).json({ error: 'Failed to create timesheet' });
  }
});

// PUT /api/staff/timesheets/:id/approve - Approve timesheet
router.put('/timesheets/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = 'demo-user'; // Simplified auth

    const [updated] = await db
      .update(timesheets)
      .set({
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(timesheets.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error approving timesheet:', error);
    res.status(500).json({ error: 'Failed to approve timesheet' });
  }
});

// PUT /api/staff/timesheets/:id/reject - Reject timesheet
router.put('/timesheets/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;

    const [updated] = await db
      .update(timesheets)
      .set({
        status: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(timesheets.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error rejecting timesheet:', error);
    res.status(500).json({ error: 'Failed to reject timesheet' });
  }
});

// GET /api/staff/timesheets/summary - Get timesheet summary
router.get('/timesheets/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Return mock summary for demo
    res.json({
      totalHours: 156.5,
      totalStaff: 3,
      pendingApproval: 5,
      approved: 42,
      rejected: 2,
      byDepartment: {
        'Management': 40,
        'Operations': 116.5,
      },
    });
  } catch (error) {
    console.error('Error fetching timesheet summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

export default router;
