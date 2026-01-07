/**
 * Type-safe localStorage utilities
 * Handles JSON serialization and error handling
 */

/**
 * Get item from localStorage with type safety
 *
 * @param key - Storage key
 * @param defaultValue - Default value if key doesn't exist
 * @returns Stored value or default
 */
export function getStorageItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') {
    return defaultValue;
  }

  try {
    const item = window.localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : defaultValue;
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Set item in localStorage with JSON serialization
 *
 * @param key - Storage key
 * @param value - Value to store
 */
export function setStorageItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error setting localStorage key "${key}":`, error);
  }
}

/**
 * Remove item from localStorage
 *
 * @param key - Storage key to remove
 */
export function removeStorageItem(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing localStorage key "${key}":`, error);
  }
}

/**
 * Clear all localStorage
 */
export function clearStorage(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.clear();
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
}

// Common storage keys (prevents typos)
export const STORAGE_KEYS = {
  ROOM_ACCESS: 'room_access',
  USER_PREFERENCES: 'user_preferences',
} as const;
