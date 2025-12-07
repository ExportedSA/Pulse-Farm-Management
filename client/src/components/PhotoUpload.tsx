import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Camera, Upload, X, Image, Trash2, Loader2, ZoomIn } from "lucide-react";
import type { PhotoAttachment } from "@shared/schema";

interface PhotoUploadProps {
  animalId?: string;
  treatmentId?: string;
  vetVisitId?: string;
  onUploadComplete?: (photo: PhotoAttachment) => void;
  maxPhotos?: number;
  showExisting?: boolean;
}

export function PhotoUpload({
  animalId,
  treatmentId,
  vetVisitId,
  onUploadComplete,
  maxPhotos = 10,
  showExisting = true,
}: PhotoUploadProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoAttachment | null>(null);

  // Fetch existing photos
  const queryKey = animalId 
    ? ["/api/photos/attachments/animal", animalId]
    : treatmentId 
    ? ["/api/photos/attachments/treatment", treatmentId]
    : null;

  const { data: existingPhotos = [], isLoading: loadingPhotos } = useQuery<PhotoAttachment[]>({
    queryKey: queryKey || ["no-photos"],
    queryFn: async () => {
      if (!queryKey) return [];
      const endpoint = animalId 
        ? `/api/photos/attachments/animal/${animalId}`
        : `/api/photos/attachments/treatment/${treatmentId}`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Failed to fetch photos");
      return res.json();
    },
    enabled: showExisting && !!(animalId || treatmentId),
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // First upload the file
      const formData = new FormData();
      formData.append("photo", file);

      const uploadRes = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload photo");
      }

      const uploadData = await uploadRes.json();

      // Then create the attachment record
      const attachmentRes = await fetch("/api/photos/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animalId: animalId || null,
          treatmentId: treatmentId || null,
          vetVisitId: vetVisitId || null,
          photoUrl: uploadData.url,
          fileName: uploadData.originalName,
          fileSize: uploadData.size,
          mimeType: uploadData.mimetype,
          caption: caption || null,
        }),
      });

      if (!attachmentRes.ok) {
        throw new Error("Failed to save photo attachment");
      }

      return attachmentRes.json();
    },
    onSuccess: (data) => {
      toast.success("Photo uploaded successfully");
      setPreviewUrl(null);
      setCaption("");
      if (queryKey) {
        queryClient.invalidateQueries({ queryKey });
      }
      onUploadComplete?.(data);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to upload photo");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const res = await fetch(`/api/photos/attachments/${photoId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete photo");
    },
    onSuccess: () => {
      toast.success("Photo deleted");
      if (queryKey) {
        queryClient.invalidateQueries({ queryKey });
      }
      setSelectedPhoto(null);
      setShowPreviewDialog(false);
    },
    onError: () => {
      toast.error("Failed to delete photo");
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    // Check max photos
    if (existingPhotos.length >= maxPhotos) {
      toast.error(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleCameraCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute("capture", "environment");
      fileInputRef.current.click();
    }
  };

  const handleGallerySelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute("capture");
      fileInputRef.current.click();
    }
  };

  const openPhotoPreview = (photo: PhotoAttachment) => {
    setSelectedPhoto(photo);
    setShowPreviewDialog(true);
  };

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <div className="space-y-3">
        <Label>Add Photo</Label>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {!previewUrl ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCameraCapture}
              className="flex-1"
            >
              <Camera className="h-4 w-4 mr-2" />
              Take Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleGallerySelect}
              className="flex-1"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </div>
        ) : (
          <Card className="p-4 space-y-3">
            <div className="relative">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-48 object-cover rounded-md"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={() => {
                  setPreviewUrl(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div>
              <Label>Caption (optional)</Label>
              <Textarea
                placeholder="Add a description..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
              />
            </div>

            <Button
              type="button"
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photo
                </>
              )}
            </Button>
          </Card>
        )}
      </div>

      {/* Existing Photos */}
      {showExisting && existingPhotos.length > 0 && (
        <div className="space-y-2">
          <Label>Photos ({existingPhotos.length})</Label>
          <div className="grid grid-cols-3 gap-2">
            {existingPhotos.map((photo) => (
              <div
                key={photo.id}
                className="relative aspect-square cursor-pointer group"
                onClick={() => openPhotoPreview(photo)}
              >
                <img
                  src={photo.photoUrl}
                  alt={photo.caption || "Photo"}
                  className="w-full h-full object-cover rounded-md"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                  <ZoomIn className="h-6 w-6 text-white" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {showExisting && existingPhotos.length === 0 && !loadingPhotos && (
        <div className="text-center py-6 text-muted-foreground">
          <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No photos yet</p>
        </div>
      )}

      {/* Photo Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Photo</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <div className="space-y-4">
              <img
                src={selectedPhoto.photoUrl}
                alt={selectedPhoto.caption || "Photo"}
                className="w-full max-h-[60vh] object-contain rounded-md"
              />
              {selectedPhoto.caption && (
                <p className="text-sm text-muted-foreground">{selectedPhoto.caption}</p>
              )}
              <div className="text-xs text-muted-foreground">
                {selectedPhoto.fileName && <span>{selectedPhoto.fileName}</span>}
                {selectedPhoto.fileSize && (
                  <span className="ml-2">
                    ({(selectedPhoto.fileSize / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => selectedPhoto && deleteMutation.mutate(selectedPhoto.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PhotoUpload;
