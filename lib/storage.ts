import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Upload an image file to Firebase Storage
 * @param file - The image file to upload
 * @param path - The storage path (e.g., 'devices/device-id/image.jpg')
 * @returns The download URL of the uploaded image
 */
export async function uploadImage(file: File, path: string): Promise<string> {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('Image size must be less than 5MB');
    }

    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
}

/**
 * Delete an image from Firebase Storage
 * @param path - The storage path of the image to delete
 */
export async function deleteImage(path: string): Promise<void> {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting image:', error);
    // Don't throw - image might not exist
  }
}

/**
 * Get the storage path for a device image
 * @param deviceId - The device ID
 * @param filename - Optional custom filename (defaults to timestamp)
 * @returns The storage path
 */
export function getDeviceImagePath(deviceId: string, filename?: string): string {
  const name = filename || `image-${Date.now()}`;
  return `devices/${deviceId}/${name}`;
}

/**
 * Extract the storage path from a download URL
 * This is useful for deleting images when updating devices
 */
export function extractStoragePathFromUrl(url: string): string | null {
  try {
    // Firebase Storage URLs have a specific format
    // Extract the path from the URL
    const match = url.match(/\/o\/(.+)\?/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
    return null;
  } catch (error) {
    console.error('Error extracting storage path from URL:', error);
    return null;
  }
}
