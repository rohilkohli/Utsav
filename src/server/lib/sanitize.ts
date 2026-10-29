/**
 * HTML/script injection sanitization utilities for Gemini API response content.
 * Applied to all structured AI output before Zod validation to ensure
 * no injected HTML, script tags, or markup reaches the client.
 */

/**
 * Strips all HTML tags and script blocks from a string.
 * @param str - Raw string from AI output
 * @returns Sanitized string with no HTML markup
 */
export function sanitizeText(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Recursively sanitizes all string values in a nested object or array.
 * Non-string primitives are returned unchanged; objects and arrays are traversed.
 *
 * @param obj - Any value from a parsed JSON AI response
 * @returns Deep copy with all strings sanitized via sanitizeText
 */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return sanitizeText(obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject) as unknown as T;
  }
  if (obj && typeof obj === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      clean[k] = sanitizeObject(v);
    }
    return clean as T;
  }
  return obj;
}
