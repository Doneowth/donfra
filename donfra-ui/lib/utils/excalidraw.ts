/**
 * Excalidraw utility functions and constants
 * Shared across all lesson editing/viewing components
 */

export interface ExcalidrawData {
  elements?: any[];
  appState?: any;
  files?: any;
  [key: string]: any;
}

/**
 * Empty Excalidraw data structure
 * Used as default/fallback when no diagram exists
 */
export const EMPTY_EXCALIDRAW: ExcalidrawData = {
  elements: [],
  appState: {
    collaborators: new Map(),
  },
  files: null,
};

/**
 * Sanitizes raw Excalidraw data to ensure it has the correct structure
 * Prevents errors from malformed or missing data
 *
 * @param raw - Raw data from API or local state
 * @returns Sanitized ExcalidrawData object
 */
export function sanitizeExcalidraw(raw: any): ExcalidrawData {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_EXCALIDRAW };
  }

  const appState = raw.appState && typeof raw.appState === 'object' ? raw.appState : {};

  // Ensure collaborators is a Map (Excalidraw requires this)
  // JSON.parse converts Map to plain object, so we need to restore it
  const safeAppState = { ...appState }; // shallow clone
  if (!(safeAppState.collaborators instanceof Map)) {
    safeAppState.collaborators = new Map();
  }

  return {
    elements: Array.isArray(raw.elements) ? raw.elements : [],
    appState: safeAppState,
    files: raw.files || null,
  };
}

/**
 * Checks if Excalidraw data is empty (no elements)
 *
 * @param data - Excalidraw data to check
 * @returns true if data has no elements
 */
export function isExcalidrawEmpty(data: ExcalidrawData): boolean {
  return !data.elements || data.elements.length === 0;
}

/**
 * Safely parses Excalidraw JSON string
 *
 * @param jsonString - JSON string to parse
 * @returns Parsed and sanitized ExcalidrawData
 */
export function parseExcalidrawJSON(jsonString: string): ExcalidrawData {
  try {
    const parsed = JSON.parse(jsonString);
    return sanitizeExcalidraw(parsed);
  } catch (error) {
    console.error('Failed to parse Excalidraw JSON:', error);
    return { ...EMPTY_EXCALIDRAW };
  }
}
