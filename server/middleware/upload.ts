import multer from 'multer';
import path from 'path';

// Configure multer for file uploads using memory storage
// Files will be stored in memory and passed to the fileStorage service
const storage = multer.memoryStorage();

// File filter to only accept images
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
  }
};

// Configure upload middleware
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 5 // Maximum 5 files per upload
  }
});

// Single photo upload middleware
export const uploadSinglePhoto = upload.single('photo');

// Multiple photos upload middleware
export const uploadMultiplePhotos = upload.array('photos', 5);

// Evidence attached to farm records, jobs, animals...: phone photos (incl. iPhone HEIC),
// voice notes as browsers record them (webm/mp4) and PDF dockets
export const ATTACHMENT_TYPES: Record<string, 'photo' | 'voice' | 'document'> = {
  'image/jpeg': 'photo', 'image/jpg': 'photo', 'image/png': 'photo', 'image/webp': 'photo',
  'image/heic': 'photo', 'image/heif': 'photo', 'image/gif': 'photo',
  'audio/webm': 'voice', 'audio/mp4': 'voice', 'audio/mpeg': 'voice', 'audio/mp3': 'voice',
  'audio/ogg': 'voice', 'audio/wav': 'voice', 'audio/x-m4a': 'voice', 'audio/m4a': 'voice',
  'application/pdf': 'document',
};

export const uploadAttachments = multer({
  storage,
  fileFilter: (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Browsers append codecs, e.g. "audio/webm;codecs=opus"
    const type = file.mimetype.split(';')[0].trim().toLowerCase();
    if (ATTACHMENT_TYPES[type]) {
      cb(null, true);
    } else {
      cb(new Error('Attach photos (JPEG, PNG, WebP, HEIC), voice notes or PDF documents.'));
    }
  },
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB per file (phone photos are often 3-8MB)
    files: 8,
  },
}).array('files', 8);

// Audio file upload middleware (for voice notes)
export const uploadAudio = multer({
  storage,
  fileFilter: (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP3, WAV, M4A, and OGG audio files are allowed.'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for audio files
    files: 1
  }
});

// Single audio file upload middleware
export const uploadSingleAudio = uploadAudio.single('audio');
