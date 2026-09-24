import { compareVersions } from '../src/utils/versionCompare';
import { checkAppUpdate, UPDATE_TYPES } from '../src/services/appUpdateService';

describe('Semantic Version Comparison Utility', () => {
  test('correctly compares semantic version strings', () => {
    expect(compareVersions('1.2.0', '1.3.0')).toBe(-1);
    expect(compareVersions('1.3.0', '1.3.0')).toBe(0);
    expect(compareVersions('1.5.0', '1.3.0')).toBe(1);
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
  });

  test('handles version prefixes and varying segment lengths', () => {
    expect(compareVersions('v1.5', '1.5.0')).toBe(0);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.0.0-beta', '1.0.0')).toBe(0);
  });
});

describe('App Update Service', () => {
  test('returns soft update state when test mode is "soft"', async () => {
    const result = await checkAppUpdate();
    expect(result.type).toBe(UPDATE_TYPES.SOFT_UPDATE);
    expect(result.latestVersion).toBe('1.5.0');
    expect(result.minimumVersion).toBe('1.3.0');
  });
});
