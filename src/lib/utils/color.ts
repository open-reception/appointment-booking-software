/**
 * Calculate the relative luminance of a color
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {number} Relative luminance (0-1)
 */
function getLuminance(r: number, g: number, b: number) {
  // Convert RGB to sRGB
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  // Calculate relative luminance
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Determine if black or white text should be used
 * @param {string} hexColor - Hex color code (e.g., "#ff5733" or "ff5733")
 * @returns {string} "black" or "white"
 */
export function getContrastColor(hexColor: string) {
  // Remove # if present
  const hex = hexColor.replace("#", "");

  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Get luminance
  const luminance = getLuminance(r, g, b);

  // Return black for light backgrounds, white for dark
  // Threshold is typically 0.179 for WCAG AA compliance
  return luminance > 0.179 ? "black" : "white";
}
