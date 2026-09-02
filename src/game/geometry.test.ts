import { describe, expect, it } from 'vitest';

import { angularDistance, isAngleBlocked, normalizeAngle } from './geometry';

const FULL_CIRCLE = Math.PI * 2;

describe('normalizeAngle', () => {
  it('keeps angles inside the normalized interval unchanged', () => {
    expect(normalizeAngle(Math.PI / 2)).toBeCloseTo(Math.PI / 2);
  });

  it('wraps positive angles at 2π', () => {
    expect(normalizeAngle(FULL_CIRCLE)).toBe(0);
    expect(normalizeAngle(FULL_CIRCLE + Math.PI / 3)).toBeCloseTo(
      Math.PI / 3,
    );
  });

  it('wraps negative angles into the same interval', () => {
    expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo((Math.PI * 3) / 2);
    expect(normalizeAngle(-FULL_CIRCLE)).toBe(0);
  });
});

describe('angularDistance', () => {
  it('returns the shortest distance between ordinary angles', () => {
    expect(angularDistance(Math.PI / 4, (Math.PI * 3) / 4)).toBeCloseTo(
      Math.PI / 2,
    );
  });

  it('takes the short path across the 0/2π boundary', () => {
    const justAboveZero = 0.05;
    const justBelowFullCircle = FULL_CIRCLE - 0.05;

    expect(angularDistance(justAboveZero, justBelowFullCircle)).toBeCloseTo(
      0.1,
    );
  });

  it('works with angles outside the normalized interval', () => {
    expect(angularDistance(-0.1, FULL_CIRCLE + 0.1)).toBeCloseTo(0.2);
  });
});

describe('isAngleBlocked', () => {
  it('blocks a hit closer than the minimum gap', () => {
    expect(isAngleBlocked(1, [0.2, 1.15, 4], 0.2)).toBe(true);
  });

  it('allows a hit when all existing angles are far enough away', () => {
    expect(isAngleBlocked(1, [0.2, 1.3, 4], 0.2)).toBe(false);
  });

  it('detects a blocked hit across the 0/2π boundary', () => {
    expect(isAngleBlocked(0.04, [FULL_CIRCLE - 0.04], 0.1)).toBe(true);
  });

  it('allows a hit exactly at the minimum gap', () => {
    expect(isAngleBlocked(1.25, [1], 0.25)).toBe(false);
  });

  it('allows every hit when there are no existing angles', () => {
    expect(isAngleBlocked(1, [], 0.2)).toBe(false);
  });
});
