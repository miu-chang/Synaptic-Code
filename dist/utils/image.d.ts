/**
 * Image utilities for multimodal input
 */
export interface ImageData {
    base64: string;
    mimeType: string;
    width?: number;
    height?: number;
    source: 'file' | 'clipboard' | 'url';
    originalPath?: string;
}
/**
 * Check if a string is an image file path
 */
export declare function isImagePath(input: string): boolean;
/**
 * Load image from file path and convert to base64
 * Supports PNG, JPG, GIF, WebP directly
 * Converts HEIC, HEIF, TIFF, BMP, AVIF to JPEG automatically
 */
export declare function loadImageFromFile(filePath: string): ImageData | null;
/**
 * Get image from macOS clipboard using osascript/pngpaste
 */
export declare function getClipboardImage(): ImageData | null;
/**
 * Check if clipboard has an image
 */
export declare function hasClipboardImage(): boolean;
/**
 * Create data URL from image data
 */
export declare function toDataUrl(image: ImageData): string;
/**
 * Extract image paths from text input
 * Supports: /path/to/image.png, ./relative.jpg, ~/home/image.gif
 */
export declare function extractImagePaths(text: string): string[];
/**
 * Format image info for display
 */
export declare function formatImageInfo(image: ImageData): string;
//# sourceMappingURL=image.d.ts.map