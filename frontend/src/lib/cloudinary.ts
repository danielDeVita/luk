/**
 * Cloudinary Image Optimization Utilities
 * 
 * Transforms Cloudinary URLs to use automatic format conversion (WebP),
 * quality optimization, and responsive sizing.
 */

export interface CloudinaryTransformOptions {
  /** Maximum width in pixels */
  width?: number;
  /** Maximum height in pixels */
  height?: number;
  /** Quality (1-100 or 'auto') */
  quality?: number | 'auto';
  /** Format (auto for WebP when supported) */
  format?: 'auto' | 'webp' | 'jpg' | 'png' | 'avif';
  /** Crop mode */
  crop?: 'fill' | 'fit' | 'scale' | 'thumb' | 'limit';
  /** Gravity for cropping */
  gravity?: 'auto' | 'face' | 'center';
  /** Device pixel ratio for responsive images */
  dpr?: 'auto' | number;
}

// Default transformations for different use cases
export const CLOUDINARY_PRESETS = {
  /** Card thumbnails (list views) */
  card: { width: 400, height: 300, quality: 'auto', format: 'auto', crop: 'fill' },
  /** Detail page main image */
  detail: { width: 800, quality: 'auto', format: 'auto' },
  /** Gallery thumbnails */
  gallery: { width: 120, height: 120, quality: 'auto', format: 'auto', crop: 'fill' },
  /** Full-size gallery image */
  galleryFull: { width: 1200, quality: 'auto', format: 'auto' },
  /** User avatar */
  avatar: { width: 80, height: 80, quality: 'auto', format: 'auto', crop: 'fill', gravity: 'face' },
  /** Dashboard list items */
  dashboardThumb: { width: 100, height: 100, quality: 'auto', format: 'auto', crop: 'fill' },
} as const;

/**
 * Transform a Cloudinary URL to include optimization parameters.
 * Returns the original URL unchanged if it's not a Cloudinary URL.
 * 
 * @param url - The original image URL
 * @param options - Transformation options
 * @returns Optimized Cloudinary URL or original URL
 * 
 * @example
 * // Basic usage
 * const optimized = getOptimizedImageUrl(imageUrl, { width: 400, quality: 'auto', format: 'auto' });
 * 
 * // Using presets
 * const cardImage = getOptimizedImageUrl(imageUrl, CLOUDINARY_PRESETS.card);
 */
export function getOptimizedImageUrl(
  url: string | undefined | null,
  options: CloudinaryTransformOptions = {}
): string {
  // Return empty string for null/undefined
  if (!url) return '';
  
  // Only transform Cloudinary URLs
  if (!url.includes('cloudinary.com') && !url.includes('res.cloudinary')) {
    return url;
  }

  // Build transformation string
  const transforms: string[] = [];
  
  if (options.width) transforms.push(`w_${options.width}`);
  if (options.height) transforms.push(`h_${options.height}`);
  if (options.quality) transforms.push(`q_${options.quality}`);
  if (options.format) transforms.push(`f_${options.format}`);
  if (options.crop) transforms.push(`c_${options.crop}`);
  if (options.gravity) transforms.push(`g_${options.gravity}`);
  if (options.dpr) transforms.push(`dpr_${options.dpr}`);

  // If no transforms specified, use sensible defaults
  if (transforms.length === 0) {
    transforms.push('q_auto', 'f_auto');
  }

  const transformString = transforms.join(',');

  // Insert transformations after /upload/
  // Cloudinary URL format: https://res.cloudinary.com/{cloud}/image/upload/{existing_transforms?}/{public_id}
  if (url.includes('/upload/')) {
    return url.replace('/upload/', `/upload/${transformString}/`);
  }

  // Fallback: append as query params (less common format)
  return url;
}

/**
 * Generate srcSet for responsive images.
 * 
 * @param url - The original Cloudinary URL
 * @param widths - Array of widths to generate
 * @param options - Base transformation options
 * @returns srcSet string for use in img/Image components
 * 
 * @example
 * const srcSet = generateSrcSet(imageUrl, [400, 800, 1200]);
 * <img src={imageUrl} srcSet={srcSet} />
 */
export function generateSrcSet(
  url: string | undefined | null,
  widths: number[] = [400, 800, 1200],
  options: Omit<CloudinaryTransformOptions, 'width'> = { quality: 'auto', format: 'auto' }
): string {
  if (!url || !url.includes('cloudinary')) {
    return '';
  }

  return widths
    .map(w => `${getOptimizedImageUrl(url, { ...options, width: w })} ${w}w`)
    .join(', ');
}

/**
 * Get blur placeholder URL for loading states.
 * Returns a tiny, heavily compressed version of the image.
 * 
 * @param url - The original Cloudinary URL
 * @returns Blurred placeholder URL
 */
export function getBlurPlaceholder(url: string | undefined | null): string {
  return getOptimizedImageUrl(url, {
    width: 20,
    quality: 10,
    format: 'auto',
  });
}
