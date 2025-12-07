import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Types
interface Shift {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: 'morning' | 'afternoon' | 'night' | 'split' | 'custom';
  location?: string;
  tasks?: string[];
  notes?: string;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  breakMinutes?: number;
  isRecurring?: boolean;
  recurringPattern?: string;
  createdBy?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface ShiftTemplate {
  id: string;
  name: string;
  shiftType: 'morning' | 'afternoon' | 'night' | 'split' | 'custom';
  startTime: string;
  endTime: string;
  breakMinutes: number;
  tasks: string[];
  color: string;
  isActive: boolean;
}

interface LeaveRequest {
  id: string;
  staffId: string;
  staffName: string;
  startDate: string;
  endDate: string;
  type: 'annual' | 'sick' | 'personal' | 'unpaid' | 'other';
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

// In-memory storage (would be database in production)
let shifts: Shift[] = [];
let shiftTemplates: ShiftTemplate[] = [
  { id: 'morning', name: 'Morning Shift', shiftType: 'morning', startTime: '05:00', endTime: '13:00', breakMinutes: 30, tasks: ['Morning milking', 'Calf feeding'], color: 'bg-yellow-100 border-yellow-400', isActive: true },
  { id: 'afternoon', name: 'Afternoon Shift', shiftType: 'afternoon', startTime: '13:00', endTime: '21:00', breakMinutes: 30, tasks: ['Afternoon milking', 'Paddock checks'], color: 'bg-orange-100 border-orange-400', isActive: true },
  { id: 'night', name: 'Night Shift', shiftType: 'night', startTime: '21:00', endTime: '05:00', breakMinutes: 30, tasks: ['Night watch', 'Calving assistance'], color: 'bg-blue-100 border-blue-400', isActive: true },
  { id: 'split', name: 'Split Shift', shiftType: 'split', startTime: '05:00', endTime: '09:00', breakMinutes: 0, tasks: ['Morning milking'], color: 'bg-purple-100 border-purple-400', isActive: true },
];
let leaveRequests: LeaveRequest[] = [];
let shiftIdCounter = 1;
let leaveIdCounter = 1;

// Validation schemas
const createShiftSchema = z.object({
  staffId: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  shiftType: z.enum(['morning', 'afternoon', 'night', 'split', 'custom']),
  location: z.string().optional(),
  tasks: z.array(z.string()).optional(),
  notes: z.string().optional(),
  breakMinutes: z.number().optional(),
  isRecurring: z.boolean().optional(),
  recurringPattern: z.string().optional(),
});

const createLeaveRequestSchema = z.object({
  staffId: z.string(),
  staffName: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  type: z.enum(['annual', 'sick', 'personal', 'unpaid', 'other']),
  reason: z.string().optional(),
});

// ============================================
// SHIFT ENDPOINTS
// ============================================

// GET /api/roster/shifts - Get all shifts (with optional date range filter)
router.get('/shifts', (req, res) => {
  try {
    const { startDate, endDate, staffId, status } = req.query;
    
    let filtered = [...shifts];
    
    if (startDate) {
      filtered = filtered.filter(s => s.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(s => s.date <= endDate);
    }
    if (staffId) {
      filtered = filtered.filter(s => s.staffId === staffId);
    }
    if (status) {
      filtered = filtered.filter(s => s.status === status);
    }
    
    res.json(filtered);
  } catch (error) {
    console.error('Error fetching shifts:', error);
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

// GET /api/roster/shifts/:id - Get single shift
router.get('/shifts/:id', (req, res) => {
  try {
    const shift = shifts.find(s => s.id === req.params.id);
    if (!shift) {
      return res.status(404).json({ error: 'Shift not found' });
    }
    res.json(shift);
  } catch (error) {
    console.error('Error fetching shift:', error);
    res.status(500).json({ error: 'Failed to fetch shift' });
  }
});

// POST /api/roster/shifts - Create new shift
router.post('/shifts', (req, res) => {
  try {
    const data = createShiftSchema.parse(req.body);
    const userId = (req.user as any)?.id || 'demo-user';
    
    // Get staff name (mock for now)
    const staffNames: Record<string, string> = {
      'staff-1': 'John Smith',
      'staff-2': 'Sarah Johnson',
      'staff-3': 'Mike Wilson',
      'staff-4': 'Emily Brown',
    };
    
    const newShift: Shift = {
      id: `shift-${shiftIdCounter++}`,
      ...data,
      staffName: staffNames[data.staffId] || 'Unknown',
      status: 'scheduled',
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    shifts.push(newShift);
    
    // If recurring, create additional shifts
    if (data.isRecurring && data.recurringPattern) {
      const baseDate = new Date(data.date);
      const weeksToCreate = 4; // Create 4 weeks of recurring shifts
      
      for (let i = 1; i <= weeksToCreate; i++) {
        let nextDate: Date;
        switch (data.recurringPattern) {
          case 'daily':
            nextDate = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
            break;
          case 'weekly':
            nextDate = new Date(baseDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
            break;
          case 'fortnightly':
            nextDate = new Date(baseDate.getTime() + i * 14 * 24 * 60 * 60 * 1000);
            break;
          default:
            continue;
        }
        
        const recurringShift: Shift = {
          ...newShift,
          id: `shift-${shiftIdCounter++}`,
          date: nextDate.toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        shifts.push(recurringShift);
      }
    }
    
    res.status(201).json(newShift);
  } catch (error) {
    console.error('Error creating shift:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid shift data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create shift' });
  }
});

// PUT /api/roster/shifts/:id - Update shift
router.put('/shifts/:id', (req, res) => {
  try {
    const shiftIndex = shifts.findIndex(s => s.id === req.params.id);
    if (shiftIndex === -1) {
      return res.status(404).json({ error: 'Shift not found' });
    }
    
    shifts[shiftIndex] = {
      ...shifts[shiftIndex],
      ...req.body,
      updatedAt: new Date().toISOString(),
    };
    
    res.json(shifts[shiftIndex]);
  } catch (error) {
    console.error('Error updating shift:', error);
    res.status(500).json({ error: 'Failed to update shift' });
  }
});

// DELETE /api/roster/shifts/:id - Delete shift
router.delete('/shifts/:id', (req, res) => {
  try {
    const shiftIndex = shifts.findIndex(s => s.id === req.params.id);
    if (shiftIndex === -1) {
      return res.status(404).json({ error: 'Shift not found' });
    }
    
    shifts.splice(shiftIndex, 1);
    res.json({ message: 'Shift deleted' });
  } catch (error) {
    console.error('Error deleting shift:', error);
    res.status(500).json({ error: 'Failed to delete shift' });
  }
});

// PUT /api/roster/shifts/:id/confirm - Confirm shift
router.put('/shifts/:id/confirm', (req, res) => {
  try {
    const shift = shifts.find(s => s.id === req.params.id);
    if (!shift) {
      return res.status(404).json({ error: 'Shift not found' });
    }
    
    shift.status = 'confirmed';
    shift.confirmedAt = new Date().toISOString();
    shift.updatedAt = new Date().toISOString();
    
    res.json(shift);
  } catch (error) {
    console.error('Error confirming shift:', error);
    res.status(500).json({ error: 'Failed to confirm shift' });
  }
});

// PUT /api/roster/shifts/:id/cancel - Cancel shift
router.put('/shifts/:id/cancel', (req, res) => {
  try {
    const shift = shifts.find(s => s.id === req.params.id);
    if (!shift) {
      return res.status(404).json({ error: 'Shift not found' });
    }
    
    shift.status = 'cancelled';
    shift.updatedAt = new Date().toISOString();
    
    res.json(shift);
  } catch (error) {
    console.error('Error cancelling shift:', error);
    res.status(500).json({ error: 'Failed to cancel shift' });
  }
});

// POST /api/roster/shifts/copy-week - Copy shifts from one week to another
router.post('/shifts/copy-week', (req, res) => {
  try {
    const { sourceWeekStart, targetWeekStart } = req.body;
    
    // Find shifts in source week
    const sourceEnd = new Date(sourceWeekStart);
    sourceEnd.setDate(sourceEnd.getDate() + 6);
    
    const sourceShifts = shifts.filter(s => {
      const shiftDate = new Date(s.date);
      return shiftDate >= new Date(sourceWeekStart) && shiftDate <= sourceEnd;
    });
    
    // Calculate day offset
    const dayOffset = Math.round((new Date(targetWeekStart).getTime() - new Date(sourceWeekStart).getTime()) / (24 * 60 * 60 * 1000));
    
    // Create new shifts
    const newShifts: Shift[] = sourceShifts.map(s => {
      const newDate = new Date(s.date);
      newDate.setDate(newDate.getDate() + dayOffset);
      
      return {
        ...s,
        id: `shift-${shiftIdCounter++}`,
        date: newDate.toISOString().split('T')[0],
        status: 'scheduled' as const,
        confirmedAt: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
    
    shifts.push(...newShifts);
    
    res.json({ message: `Copied ${newShifts.length} shifts`, shifts: newShifts });
  } catch (error) {
    console.error('Error copying week:', error);
    res.status(500).json({ error: 'Failed to copy week' });
  }
});

// POST /api/roster/publish - Publish roster and notify staff
router.post('/publish', (req, res) => {
  try {
    const { weekStart } = req.body;
    
    // Find all scheduled shifts for the week
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const weekShifts = shifts.filter(s => {
      const shiftDate = new Date(s.date);
      return shiftDate >= new Date(weekStart) && shiftDate <= weekEnd && s.status === 'scheduled';
    });
    
    // Update status to confirmed (in real app, would send notifications)
    weekShifts.forEach(s => {
      s.status = 'confirmed';
      s.updatedAt = new Date().toISOString();
    });
    
    res.json({ 
      message: `Published roster for week of ${weekStart}. ${weekShifts.length} shifts confirmed.`,
      notifiedStaff: Array.from(new Set(weekShifts.map(s => s.staffName))),
    });
  } catch (error) {
    console.error('Error publishing roster:', error);
    res.status(500).json({ error: 'Failed to publish roster' });
  }
});

// ============================================
// SHIFT TEMPLATE ENDPOINTS
// ============================================

// GET /api/roster/templates - Get all shift templates
router.get('/templates', (req, res) => {
  res.json(shiftTemplates.filter(t => t.isActive));
});

// POST /api/roster/templates - Create shift template
router.post('/templates', (req, res) => {
  try {
    const template: ShiftTemplate = {
      id: `template-${Date.now()}`,
      ...req.body,
      isActive: true,
    };
    shiftTemplates.push(template);
    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PUT /api/roster/templates/:id - Update shift template
router.put('/templates/:id', (req, res) => {
  try {
    const templateIndex = shiftTemplates.findIndex(t => t.id === req.params.id);
    if (templateIndex === -1) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    shiftTemplates[templateIndex] = {
      ...shiftTemplates[templateIndex],
      ...req.body,
    };
    
    res.json(shiftTemplates[templateIndex]);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// DELETE /api/roster/templates/:id - Delete shift template
router.delete('/templates/:id', (req, res) => {
  try {
    const templateIndex = shiftTemplates.findIndex(t => t.id === req.params.id);
    if (templateIndex === -1) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    shiftTemplates[templateIndex].isActive = false;
    res.json({ message: 'Template deleted' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// ============================================
// LEAVE REQUEST ENDPOINTS
// ============================================

// GET /api/roster/leave - Get all leave requests
router.get('/leave', (req, res) => {
  try {
    const { staffId, status, startDate, endDate } = req.query;
    
    let filtered = [...leaveRequests];
    
    if (staffId) {
      filtered = filtered.filter(l => l.staffId === staffId);
    }
    if (status) {
      filtered = filtered.filter(l => l.status === status);
    }
    if (startDate) {
      filtered = filtered.filter(l => l.endDate >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(l => l.startDate <= endDate);
    }
    
    res.json(filtered);
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
});

// POST /api/roster/leave - Create leave request
router.post('/leave', (req, res) => {
  try {
    const data = createLeaveRequestSchema.parse(req.body);
    
    const leaveRequest: LeaveRequest = {
      id: `leave-${leaveIdCounter++}`,
      ...data,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    
    leaveRequests.push(leaveRequest);
    res.status(201).json(leaveRequest);
  } catch (error) {
    console.error('Error creating leave request:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid leave request data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create leave request' });
  }
});

// PUT /api/roster/leave/:id/approve - Approve leave request
router.put('/leave/:id/approve', (req, res) => {
  try {
    const leave = leaveRequests.find(l => l.id === req.params.id);
    if (!leave) {
      return res.status(404).json({ error: 'Leave request not found' });
    }
    
    const userId = (req.user as any)?.id || 'demo-user';
    leave.status = 'approved';
    leave.approvedBy = userId;
    leave.approvedAt = new Date().toISOString();
    
    // Cancel any shifts during leave period
    shifts.forEach(s => {
      if (s.staffId === leave.staffId && s.date >= leave.startDate && s.date <= leave.endDate) {
        s.status = 'cancelled';
        s.notes = `Cancelled due to approved leave: ${leave.type}`;
        s.updatedAt = new Date().toISOString();
      }
    });
    
    res.json(leave);
  } catch (error) {
    console.error('Error approving leave:', error);
    res.status(500).json({ error: 'Failed to approve leave request' });
  }
});

// PUT /api/roster/leave/:id/reject - Reject leave request
router.put('/leave/:id/reject', (req, res) => {
  try {
    const leave = leaveRequests.find(l => l.id === req.params.id);
    if (!leave) {
      return res.status(404).json({ error: 'Leave request not found' });
    }
    
    leave.status = 'rejected';
    res.json(leave);
  } catch (error) {
    console.error('Error rejecting leave:', error);
    res.status(500).json({ error: 'Failed to reject leave request' });
  }
});

// DELETE /api/roster/leave/:id - Delete leave request
router.delete('/leave/:id', (req, res) => {
  try {
    const leaveIndex = leaveRequests.findIndex(l => l.id === req.params.id);
    if (leaveIndex === -1) {
      return res.status(404).json({ error: 'Leave request not found' });
    }
    
    leaveRequests.splice(leaveIndex, 1);
    res.json({ message: 'Leave request deleted' });
  } catch (error) {
    console.error('Error deleting leave request:', error);
    res.status(500).json({ error: 'Failed to delete leave request' });
  }
});

// ============================================
// ROSTER STATISTICS
// ============================================

// GET /api/roster/stats - Get roster statistics
router.get('/stats', (req, res) => {
  try {
    const { weekStart } = req.query;
    
    let weekShifts = shifts;
    if (weekStart) {
      const weekEnd = new Date(weekStart as string);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      weekShifts = shifts.filter(s => {
        const shiftDate = new Date(s.date);
        return shiftDate >= new Date(weekStart as string) && shiftDate <= weekEnd;
      });
    }
    
    const totalShifts = weekShifts.length;
    const confirmedShifts = weekShifts.filter(s => s.status === 'confirmed' || s.status === 'completed').length;
    const scheduledShifts = weekShifts.filter(s => s.status === 'scheduled').length;
    const cancelledShifts = weekShifts.filter(s => s.status === 'cancelled').length;
    
    // Calculate total hours
    const totalHours = weekShifts.reduce((sum, s) => {
      const start = new Date(`2000-01-01T${s.startTime}`);
      const end = new Date(`2000-01-01T${s.endTime}`);
      let hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (hours < 0) hours += 24; // Handle overnight shifts
      return sum + hours;
    }, 0);
    
    // Hours by staff
    const hoursByStaff: Record<string, number> = {};
    weekShifts.forEach(s => {
      const start = new Date(`2000-01-01T${s.startTime}`);
      const end = new Date(`2000-01-01T${s.endTime}`);
      let hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (hours < 0) hours += 24;
      hoursByStaff[s.staffName] = (hoursByStaff[s.staffName] || 0) + hours;
    });
    
    // Pending leave
    const pendingLeave = leaveRequests.filter(l => l.status === 'pending').length;
    const approvedLeave = leaveRequests.filter(l => l.status === 'approved').length;
    
    res.json({
      totalShifts,
      confirmedShifts,
      scheduledShifts,
      cancelledShifts,
      totalHours: Math.round(totalHours * 10) / 10,
      hoursByStaff,
      pendingLeave,
      approvedLeave,
      staffCount: Object.keys(hoursByStaff).length,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
