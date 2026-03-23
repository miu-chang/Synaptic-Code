/**
 * Image utilities for multimodal input
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
const SUPPORTED_FORMATS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const CONVERTIBLE_FORMATS = ['.heic', '.heif', '.tiff', '.tif', '.bmp', '.avif'];
/**
 * Check if a string is an image file path
 */
export function isImagePath(input) {
    const ext = path.extname(input).toLowerCase();
    const allFormats = [...SUPPORTED_FORMATS, ...CONVERTIBLE_FORMATS];
    return allFormats.includes(ext) && fs.existsSync(input);
}
/**
 * Convert HEIC/HEIF/etc to JPEG using sips (macOS) or ImageMagick
 */
function convertToJpeg(inputPath) {
    if (process.platform !== 'darwin') {
        // Try ImageMagick on Linux/Windows
        try {
            const tmpPath = `/tmp/synaptic_converted_${Date.now()}.jpg`;
            execSync(`convert "${inputPath}" "${tmpPath}"`, { stdio: 'pipe' });
            if (fs.existsSync(tmpPath)) {
                const buffer = fs.readFileSync(tmpPath);
                fs.unlinkSync(tmpPath);
                return buffer;
            }
        }
        catch {
            // ImageMagick not available
        }
        return null;
    }
    // macOS: Use sips (built-in)
    try {
        const tmpPath = `/tmp/synaptic_converted_${Date.now()}.jpg`;
        execSync(`sips -s format jpeg "${inputPath}" --out "${tmpPath}"`, { stdio: 'pipe' });
        if (fs.existsSync(tmpPath)) {
            const buffer = fs.readFileSync(tmpPath);
            fs.unlinkSync(tmpPath);
            return buffer;
        }
    }
    catch {
        // sips failed
    }
    return null;
}
/**
 * Load image from file path and convert to base64
 * Supports PNG, JPG, GIF, WebP directly
 * Converts HEIC, HEIF, TIFF, BMP, AVIF to JPEG automatically
 */
export function loadImageFromFile(filePath) {
    try {
        const absolutePath = path.resolve(filePath);
        if (!fs.existsSync(absolutePath)) {
            return null;
        }
        const ext = path.extname(absolutePath).toLowerCase();
        // Direct support
        if (SUPPORTED_FORMATS.includes(ext)) {
            const buffer = fs.readFileSync(absolutePath);
            const base64 = buffer.toString('base64');
            const mimeType = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
            }[ext] || 'image/png';
            return {
                base64,
                mimeType,
                source: 'file',
                originalPath: absolutePath,
            };
        }
        // Needs conversion
        if (CONVERTIBLE_FORMATS.includes(ext)) {
            const converted = convertToJpeg(absolutePath);
            if (converted) {
                return {
                    base64: converted.toString('base64'),
                    mimeType: 'image/jpeg',
                    source: 'file',
                    originalPath: absolutePath,
                };
            }
        }
        return null;
    }
    catch {
        return null;
    }
}
/**
 * Get image from macOS clipboard using osascript/pngpaste
 */
export function getClipboardImage() {
    if (process.platform !== 'darwin') {
        // TODO: Support Windows/Linux
        return null;
    }
    try {
        // Try pngpaste first (brew install pngpaste)
        const tmpPath = `/tmp/synaptic_clipboard_${Date.now()}.png`;
        try {
            execSync(`pngpaste ${tmpPath}`, { stdio: 'pipe' });
            if (fs.existsSync(tmpPath)) {
                const buffer = fs.readFileSync(tmpPath);
                fs.unlinkSync(tmpPath); // Clean up
                return {
                    base64: buffer.toString('base64'),
                    mimeType: 'image/png',
                    source: 'clipboard',
                };
            }
        }
        catch {
            // pngpaste not available or no image in clipboard
        }
        // Fallback: Use osascript to check clipboard type
        try {
            const result = execSync(`osascript -e 'the clipboard as «class PNGf»' 2>/dev/null | xxd -r -p`, { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 });
            if (result && result.length > 0) {
                return {
                    base64: result.toString('base64'),
                    mimeType: 'image/png',
                    source: 'clipboard',
                };
            }
        }
        catch {
            // No image data in clipboard
        }
        return null;
    }
    catch {
        return null;
    }
}
/**
 * Check if clipboard has an image
 */
export function hasClipboardImage() {
    if (process.platform !== 'darwin') {
        return false;
    }
    try {
        // Check if clipboard contains image data
        const result = execSync(`osascript -e 'clipboard info'`, { encoding: 'utf-8', timeout: 1000 });
        return result.includes('«class PNGf»') || result.includes('TIFF');
    }
    catch {
        return false;
    }
}
/**
 * Create data URL from image data
 */
export function toDataUrl(image) {
    return `data:${image.mimeType};base64,${image.base64}`;
}
/**
 * Extract image paths from text input
 * Supports: /path/to/image.png, ./relative.jpg, ~/home/image.gif
 */
export function extractImagePaths(text) {
    const paths = [];
    // Match file paths that end with image extensions (including convertible formats)
    const regex = /(?:^|\s)((?:\/|\.\/|~\/|[A-Za-z]:\\)[^\s]+\.(?:png|jpg|jpeg|gif|webp|heic|heif|tiff|tif|bmp|avif))/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
        let filePath = match[1].trim();
        // Expand ~ to home directory
        if (filePath.startsWith('~/')) {
            filePath = path.join(process.env.HOME || '', filePath.slice(2));
        }
        if (fs.existsSync(filePath)) {
            paths.push(filePath);
        }
    }
    return paths;
}
/**
 * Format image info for display
 */
export function formatImageInfo(image) {
    const sizeKB = Math.round(image.base64.length * 0.75 / 1024);
    const source = image.source === 'clipboard' ? 'clipboard' : image.originalPath || 'file';
    return `[Image: ${image.mimeType}, ${sizeKB}KB, from ${source}]`;
}
//# sourceMappingURL=image.js.map