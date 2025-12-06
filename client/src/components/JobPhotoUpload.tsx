import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, X, Camera, Image as ImageIcon } from 'lucide-react';

interface JobPhotoUploadProps {
  photos: File[];
  onPhotosChange: (photos: File[]) => void;
  maxPhotos?: number;
  className?: string;
}

export function JobPhotoUpload({ 
  photos = [], 
  onPhotosChange, 
  maxPhotos = 5,
  className = ""
}: JobPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    // Check if adding these files would exceed the limit
    if (photos.length + files.length > maxPhotos) {
      alert(`Maximum ${maxPhotos} photos allowed. You can add ${maxPhotos - photos.length} more.`);
      return;
    }

    setUploading(true);

    try {
      const newPhotos: File[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
          alert(`${file.name} is not an image file.`);
          continue;
        }

        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
          alert(`${file.name} is larger than 5MB.`);
          continue;
        }

        // Add the actual file
        newPhotos.push(file);
      }

      // Add the actual files to the state
      onPhotosChange([...photos, ...newPhotos]);
      
    } catch (error) {
      console.error('Error uploading photos:', error);
      alert('Error uploading photos. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(newPhotos);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-pulse-forest" />
          <h3 className="text-lg font-medium text-gray-900">Photos</h3>
          <span className="text-sm text-gray-500">({photos.length}/{maxPhotos})</span>
        </div>
        
        {photos.length < maxPhotos && (
          <Button
            onClick={triggerFileSelect}
            disabled={uploading}
            size="sm"
            variant="outline"
            className="border-pulse-300 text-pulse-forest hover:bg-pulse-50"
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Uploading...' : 'Add Photos'}
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {photos.length === 0 ? (
        <Card className="p-8 border-dashed border-pulse-300 bg-pulse-50">
          <div className="text-center">
            <ImageIcon className="h-12 w-12 mx-auto mb-3 text-pulse-300" />
            <p className="text-gray-600 mb-2">No photos added yet</p>
            <p className="text-sm text-gray-500">
              Add up to {maxPhotos} photos to document this task
            </p>
            <Button
              onClick={triggerFileSelect}
              disabled={uploading}
              size="sm"
              className="mt-4 bg-pulse-forest hover:bg-pulse-forest-dark"
            >
              <Upload className="h-4 w-4 mr-2" />
              Add First Photo
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {photos.map((photo, index) => {
            const previewUrl = URL.createObjectURL(photo);
            return (
              <div key={index} className="relative group">
                <Card className="overflow-hidden border-pulse-200">
                  <div className="aspect-square relative">
                    <img
                      src={previewUrl}
                      alt={`Job photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                      <Button
                        onClick={() => removePhoto(index)}
                        size="icon"
                        variant="destructive"
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
                <p className="text-xs text-gray-500 mt-1 text-center">
                  {photo.name} ({(photo.size / 1024 / 1024).toFixed(1)}MB)
                </p>
              </div>
            );
          })}
          
          {photos.length < maxPhotos && (
            <div className="relative">
              <Card 
                className="aspect-square border-dashed border-pulse-300 bg-pulse-50 cursor-pointer hover:bg-pulse-100 transition-colors flex items-center justify-center"
                onClick={triggerFileSelect}
              >
                <div className="text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-pulse-300" />
                  <p className="text-sm text-pulse-600">Add Photo</p>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {photos.length > 0 && (
        <div className="text-xs text-gray-500">
          <p>• Maximum file size: 5MB per photo</p>
          <p>• Supported formats: JPEG, PNG, GIF, WebP</p>
          <p>• Click on a photo to remove it</p>
        </div>
      )}
    </div>
  );
}
