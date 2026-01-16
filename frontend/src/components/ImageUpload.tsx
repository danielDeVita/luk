'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { ImagePlus, X, Loader2 } from 'lucide-react';

interface ImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

interface CloudinarySignature {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
  mock?: boolean;
}

export function ImageUpload({ images, onImagesChange, maxImages = 5 }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadToCloudinary = async (file: File): Promise<string | null> => {
    try {
      // 1. Get signature from backend (uses httpOnly cookie for auth)
      const signatureResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/uploads/signature`,
        {
          credentials: 'include', // Send cookies for auth
        }
      );

      if (!signatureResponse.ok) {
        throw new Error('Failed to get upload signature');
      }

      const signatureData: CloudinarySignature = await signatureResponse.json();

      // Handle mock mode (Cloudinary not configured)
      if (signatureData.mock) {
        // In mock mode, create a fake URL or use a placeholder
        const reader = new FileReader();
        return new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      // 2. Upload directly to Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', signatureData.apiKey);
      formData.append('timestamp', signatureData.timestamp.toString());
      formData.append('signature', signatureData.signature);
      formData.append('folder', signatureData.folder);

      const cloudinaryResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!cloudinaryResponse.ok) {
        const errorData = await cloudinaryResponse.json();
        throw new Error(errorData.error?.message || 'Upload failed');
      }

      const result = await cloudinaryResponse.json();
      return result.secure_url;
    } catch (err) {
      console.error('Upload error:', err);
      throw err;
    }
  };

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setError(null);
      setUploading(true);

      const remainingSlots = maxImages - images.length;
      const filesToUpload = Array.from(files).slice(0, remainingSlots);

      if (filesToUpload.length === 0) {
        setError(`Ya tenés ${maxImages} imágenes`);
        setUploading(false);
        return;
      }

      // Validate file types
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      const invalidFile = filesToUpload.find((f) => !validTypes.includes(f.type));
      if (invalidFile) {
        setError('Solo se permiten imágenes (JPG, PNG, WEBP, GIF)');
        setUploading(false);
        return;
      }

      // Validate file sizes (max 5MB each)
      const oversizedFile = filesToUpload.find((f) => f.size > 5 * 1024 * 1024);
      if (oversizedFile) {
        setError('Las imágenes deben ser menores a 5MB');
        setUploading(false);
        return;
      }

      try {
        const uploadedUrls: string[] = [];
        for (const file of filesToUpload) {
          const url = await uploadToCloudinary(file);
          if (url) {
            uploadedUrls.push(url);
          }
        }
        onImagesChange([...images, ...uploadedUrls]);
      } catch (err) {
        setError('Error al subir las imágenes. Intenta de nuevo.');
      } finally {
        setUploading(false);
      }
    },
    [images, maxImages, onImagesChange]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset input so the same file can be uploaded again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {/* Image Grid */}
      <div className="flex flex-wrap gap-3">
        {images.map((img, i) => (
          <div
            key={i}
            className="relative w-24 h-24 rounded-lg overflow-hidden border border-border group"
          >
            <Image
              src={img}
              alt={`Imagen ${i + 1}`}
              fill
              sizes="96px"
              className="object-cover"
              unoptimized={img.startsWith('data:')}
            />
            <button
              type="button"
              onClick={() => removeImage(i)}
              className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
            >
              <X className="h-3 w-3" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs py-0.5 text-center">
              {i + 1}
            </div>
          </div>
        ))}

        {/* Upload Button / Drop Zone */}
        {images.length < maxImages && (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              w-24 h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all
              ${
                dragActive
                  ? 'border-primary bg-primary/10 scale-105'
                  : 'border-muted-foreground/25 hover:border-primary hover:bg-primary/5'
              }
              ${uploading ? 'pointer-events-none opacity-50' : ''}
            `}
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            ) : (
              <>
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground mt-1">Subir</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={handleChange}
        className="hidden"
      />

      {/* Error Message */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Helper Text */}
      <p className="text-xs text-muted-foreground">
        Arrastra imágenes o haz clic para seleccionar. Máximo {maxImages} imágenes, 5MB cada una.
      </p>
    </div>
  );
}
