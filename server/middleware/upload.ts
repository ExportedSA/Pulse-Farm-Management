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
