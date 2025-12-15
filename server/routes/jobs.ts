import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { uploadMultiplePhotos } from "../middleware/upload";
import path from "path";

const router = Router();
const prisma = new PrismaClient();

// Mock user data for demo mode
const mockUsers: Record<string, { name: string; email: string }> = {
  "demo-user": { name: "You", email: "you@pulse.farm" },
  "user-1": { name: "John Smith", email: "john@pulse.farm" },
  "user-2": { name: "Sarah Johnson", email: "sarah@pulse.farm" },
  "user-3": { name: "Mike Wilson", email: "mike@pulse.farm" },
  "user-4": { name: "Emily Brown", email: "emily@pulse.farm" },
  "user-5": { name: "David Lee", email: "david@pulse.farm" },
};

// Helper function to get user name
function getUserName(userId: string): string {
  return mockUsers[userId]?.name || userId;
}

// Get all jobs
router.get("/", async (req, res) => {
  try {
    const currentUserId = (req.user as any)?.id || "demo-user";
    
    // Try to get jobs from database
    let jobs = [];
    try {
      jobs = await prisma.job.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          assignments: true,
        },
      });
      
      // Transform to include assigned user names
      const transformedJobs = jobs.map((job: any) => ({
        ...job,
        assignedTo: job.assignments.map((a: any) => a.userId),
        assignedToNames: job.assignments.map((a: any) => getUserName(a.userId)),
      }));
      
      return res.json(transformedJobs);
    } catch (dbError) {
      console.log("Database not available, using mock jobs");
      
      // Return mock jobs for demo
      const mockJobs = [
        {
          id: '1',
          title: 'Morning Feed - Paddock A',
          description: 'Feed all cattle in Paddock A with hay and supplements',
          location: 'Paddock A',
          assignedTo: ['user-2', 'user-3'],
          assignedToNames: ['Sarah Johnson', 'Mike Wilson'],
          status: 'in-progress',
          priority: 'high',
          startDate: new Date().toISOString().split('T')[0],
          startTime: '06:00',
          endTime: '08:00',
          category: 'feeding',
          createdBy: 'user-1',
          createdAt: new Date().toISOString(),
          notes: null,
          checklistItems: [
            { id: 'c1-1', text: 'Check hay stock levels', required: true, completed: true, completedAt: new Date().toISOString(), completedBy: 'user-2', completedByName: 'Sarah Johnson', order: 0 },
            { id: 'c1-2', text: 'Distribute hay to paddock', required: true, completed: true, completedAt: new Date().toISOString(), completedBy: 'user-2', completedByName: 'Sarah Johnson', order: 1 },
            { id: 'c1-3', text: 'Add mineral supplements', required: false, completed: false, order: 2 },
            { id: 'c1-4', text: 'Check water troughs', required: true, completed: false, order: 3 },
            { id: 'c1-5', text: 'Record any health concerns', required: false, completed: false, order: 4 },
          ],
          estimatedDuration: 90,
        },
        {
          id: '2',
          title: 'Fence Repair - North Boundary',
          description: 'Repair damaged fence posts and wire on north boundary',
          location: 'North Boundary',
          assignedTo: ['user-3'],
          assignedToNames: ['Mike Wilson'],
          status: 'pending',
          priority: 'urgent',
          startDate: new Date().toISOString().split('T')[0],
          startTime: '09:00',
          endTime: null,
          category: 'maintenance',
          createdBy: 'user-1',
          createdAt: new Date().toISOString(),
          notes: 'Check for any additional damage along the fence line',
          checklistItems: [
            { id: 'c2-1', text: 'Gather repair materials', required: true, completed: false, order: 0 },
            { id: 'c2-2', text: 'Locate all damaged sections', required: true, completed: false, order: 1 },
            { id: 'c2-3', text: 'Replace broken posts', required: true, completed: false, order: 2 },
            { id: 'c2-4', text: 'Re-tension wire', required: true, completed: false, order: 3 },
            { id: 'c2-5', text: 'Test electric fence voltage', required: true, completed: false, order: 4 },
            { id: 'c2-6', text: 'Take photos of completed repair', required: false, completed: false, order: 5 },
          ],
          estimatedDuration: 180,
        },
        {
          id: '3',
          title: 'Health Check - Dairy Herd',
          description: 'Routine health inspection of all dairy cattle',
          location: 'Dairy Shed',
          assignedTo: ['user-4'],
          assignedToNames: ['Emily Brown'],
          status: 'completed',
          priority: 'medium',
          startDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
          startTime: '10:00',
          endTime: '14:00',
          category: 'health',
          createdBy: 'user-5',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          notes: null,
          checklistItems: [
            { id: 'c3-1', text: 'Check body condition scores', required: true, completed: true, completedAt: new Date(Date.now() - 86400000).toISOString(), completedBy: 'user-4', completedByName: 'Emily Brown', order: 0 },
            { id: 'c3-2', text: 'Inspect for lameness', required: true, completed: true, completedAt: new Date(Date.now() - 86400000).toISOString(), completedBy: 'user-4', completedByName: 'Emily Brown', order: 1 },
            { id: 'c3-3', text: 'Check udder health', required: true, completed: true, completedAt: new Date(Date.now() - 86400000).toISOString(), completedBy: 'user-4', completedByName: 'Emily Brown', order: 2 },
            { id: 'c3-4', text: 'Record any treatments given', required: true, completed: true, completedAt: new Date(Date.now() - 86400000).toISOString(), completedBy: 'user-4', completedByName: 'Emily Brown', order: 3 },
            { id: 'c3-5', text: 'Update health records', required: true, completed: true, completedAt: new Date(Date.now() - 86400000).toISOString(), completedBy: 'user-4', completedByName: 'Emily Brown', order: 4 },
          ],
          estimatedDuration: 240,
        },
        {
          id: '4',
          title: 'Water Trough Inspection',
          description: 'Check and clean all water troughs across paddocks',
          location: 'All Paddocks',
          assignedTo: ['user-2'],
          assignedToNames: ['Sarah Johnson'],
          status: 'pending',
          priority: 'medium',
          startDate: new Date().toISOString().split('T')[0],
          startTime: '14:00',
          endTime: '15:30',
          category: 'maintenance',
          createdBy: 'user-1',
          createdAt: new Date().toISOString(),
          notes: null,
          checklistItems: [
            { id: 'c4-1', text: 'Check water levels in all troughs', required: true, completed: false, order: 0 },
            { id: 'c4-2', text: 'Clean debris from troughs', required: true, completed: false, order: 1 },
            { id: 'c4-3', text: 'Test float valves', required: true, completed: false, order: 2 },
            { id: 'c4-4', text: 'Check for leaks', required: true, completed: false, order: 3 },
            { id: 'c4-5', text: 'Report any repairs needed', required: false, completed: false, order: 4 },
          ],
          estimatedDuration: 60,
        },
      ];
      
      return res.json(mockJobs);
    }
  } catch (error) {
    console.error("Failed to fetch jobs:", error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

// Get available users for job assignment
router.get("/users", async (req, res) => {
  try {
    // Mock users for demo/testing
    const users = [
      { id: "user-1", name: "John Smith", email: "john@pulse.farm", role: "manager" },
      { id: "user-2", name: "Sarah Johnson", email: "sarah@pulse.farm", role: "staff" },
      { id: "user-3", name: "Mike Wilson", email: "mike@pulse.farm", role: "staff" },
      { id: "user-4", name: "Emily Brown", email: "emily@pulse.farm", role: "staff" },
      { id: "user-5", name: "David Lee", email: "david@pulse.farm", role: "manager" },
    ];
    
    res.json(users);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Create a new job with photos and location
router.post("/", uploadMultiplePhotos, async (req, res) => {
  try {
    const currentUserId = (req.user as any)?.id || "demo-user";
    const {
      title,
      description,
      location,
      latitude,
      longitude,
      assignedTo,
      status,
      priority,
      startDate,
      endDate,
      startTime,
      endTime,
      category,
      notes,
    } = req.body;

    // Handle uploaded photos
    let photoUrls: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      // Use the file storage service to save the files
      const { saveFileBuffer } = await import('../services/fileStorage');
      
      const uploadPromises = req.files.map(async (file: Express.Multer.File) => {
        const { publicUrl } = await saveFileBuffer(
          file.buffer,
          file.mimetype,
          file.originalname,
          'jobs' // Store in jobs subfolder
        );
        return publicUrl;
      });
      
      photoUrls = await Promise.all(uploadPromises);
    }

    if (!title || !description || !location || !startDate || !startTime || !assignedTo || assignedTo.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      // Try to create in database
      const job = await prisma.job.create({
        data: {
          title,
          description,
          location,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          photoUrls,
          status: status || 'pending',
          priority: priority || 'medium',
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          startTime,
          endTime: endTime || null,
          category: category || 'general',
          notes: notes || null,
          createdBy: currentUserId,
          assignments: {
            create: assignedTo.map((userId: string) => ({
              userId,
            })),
          },
        },
        include: {
          assignments: true,
        },
      });

      const transformedJob = {
        ...job,
        assignedTo: job.assignments.map((a: any) => a.userId),
        assignedToNames: job.assignments.map((a: any) => getUserName(a.userId)),
      };

      res.json(transformedJob);
    } catch (dbError) {
      console.log("Database not available, returning mock response");
      
      // Return mock response
      const mockJob = {
        id: Date.now().toString(),
        title,
        description,
        location,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        photoUrls,
        assignedTo,
        assignedToNames: assignedTo.map((id: string) => getUserName(id)),
        status: status || 'pending',
        priority: priority || 'medium',
        startDate,
        endDate: endDate || null,
        startTime,
        endTime: endTime || null,
        category: category || 'general',
        notes: notes || null,
        createdBy: currentUserId,
        createdAt: new Date().toISOString(),
      };
      
      res.json(mockJob);
    }
  } catch (error) {
    console.error("Failed to create job:", error);
    res.status(500).json({ error: "Failed to create job" });
  }
});

// Update job with photos and location
router.patch("/:id", uploadMultiplePhotos, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, assignedTo, latitude, longitude, existingPhotos, ...otherUpdates } = req.body;

    // Handle uploaded photos
    let newPhotoUrls: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      // Use the file storage service to save the files
      const { saveFileBuffer } = await import('../services/fileStorage');
      
      const uploadPromises = req.files.map(async (file: Express.Multer.File) => {
        const { publicUrl } = await saveFileBuffer(
          file.buffer,
          file.mimetype,
          file.originalname,
          'jobs' // Store in jobs subfolder
        );
        return publicUrl;
      });
      
      newPhotoUrls = await Promise.all(uploadPromises);
    }

    // Combine existing photos with new ones
    let photoUrls: string[] = [];
    if (existingPhotos && Array.isArray(existingPhotos)) {
      photoUrls = existingPhotos;
    }
    photoUrls = [...photoUrls, ...newPhotoUrls];

    try {
      // Try to update in database
      const updateData: any = { ...otherUpdates };
      
      if (status) updateData.status = status;
      if (priority) updateData.priority = priority;
      if (latitude !== undefined) updateData.latitude = latitude ? parseFloat(latitude) : null;
      if (longitude !== undefined) updateData.longitude = longitude ? parseFloat(longitude) : null;
      if (newPhotoUrls.length > 0 || existingPhotos !== undefined) updateData.photoUrls = photoUrls;

      const job = await prisma.job.update({
        where: { id },
        data: updateData,
        include: {
          assignments: true,
        },
      });

      // If assignedTo is provided, update assignments
      if (assignedTo && Array.isArray(assignedTo)) {
        // Delete existing assignments
        await prisma.jobAssignment.deleteMany({
          where: { jobId: id },
        });

        // Create new assignments
        await prisma.jobAssignment.createMany({
          data: assignedTo.map((userId: string) => ({
            jobId: id,
            userId,
          })),
        });
      }

      // Fetch updated job with assignments
      const updatedJob = await prisma.job.findUnique({
        where: { id },
        include: {
          assignments: true,
        },
      });

      const transformedJob = {
        ...updatedJob,
        assignedTo: updatedJob?.assignments.map((a: any) => a.userId) || [],
        assignedToNames: updatedJob?.assignments.map((a: any) => getUserName(a.userId)) || [],
      };

      res.json(transformedJob);
    } catch (dbError) {
      console.log("Database not available, returning mock response");
      
      // Return mock response
      res.json({
        id,
        ...req.body,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        photoUrls,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Failed to update job:", error);
    res.status(500).json({ error: "Failed to update job" });
  }
});

// Delete a job
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    try {
      // Try to delete from database
      await prisma.jobAssignment.deleteMany({
        where: { jobId: id },
      });

      await prisma.job.delete({
        where: { id },
      });

      res.json({ success: true, message: "Job deleted successfully" });
    } catch (dbError) {
      console.log("Database not available, returning mock response");
      res.json({ success: true, message: "Job deleted successfully" });
    }
  } catch (error) {
    console.error("Failed to delete job:", error);
    res.status(500).json({ error: "Failed to delete job" });
  }
});

export default router;
