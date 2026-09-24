/**
 * Compares two semantic version strings (e.g. "1.2.0", "1.10.0", "v1.5.0").
 * 
 * @param {string} v1 - First version string
 * @param {string} v2 - Second version string
 * @returns {number} 
 *   -1 if v1 < v2
 *    0 if v1 === v2
 *    1 if v1 > v2
 */
export const compareVersions = (v1, v2) => {
  if (!v1 || !v2) return 0;

  // Clean version strings (remove leading 'v', alpha/beta suffixes for numeric comparison)
  const clean1 = String(v1).trim().replace(/^v/i, '').split('-')[0];
  const clean2 = String(v2).trim().replace(/^v/i, '').split('-')[0];

  const parts1 = clean1.split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map(p => parseInt(p, 10) || 0);

  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0;
};
