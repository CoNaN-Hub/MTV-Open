import { expect, it } from 'vitest';
import { authenticityStatusOf } from '../../src/utils/officialAuthenticityCheck';

/**
 * 官方 `bs` 审核状态（`course-api-base-url-CGXqZmAy.js`@257900–259600）的归一：
 * 只有 `APPROVED` 才在标题行画「对号」，`UNKNOWN` 官方直接 `return null`。
 * 数值口径见官方 `B_`@245481：`1 = APPROVED`、`2 = REJECTED`。
 */
it('数字口径按官方 B_：1=通过、2=驳回、其余=未知', () => {
  expect(authenticityStatusOf(1)).toBe('approved');
  expect(authenticityStatusOf(2)).toBe('rejected');
  expect(authenticityStatusOf(0)).toBe('unknown');
  expect(authenticityStatusOf(7)).toBe('unknown');
});

it('字符串口径覆盖官方 bs 的六个取值，未知值一律回落到 unknown', () => {
  expect(authenticityStatusOf('approved')).toBe('approved');
  expect(authenticityStatusOf('APPROVED')).toBe('approved');
  expect(authenticityStatusOf('COMPLIANCE_STATUS_APPROVED')).toBe('approved');
  expect(authenticityStatusOf('pending')).toBe('pending');
  expect(authenticityStatusOf('processing')).toBe('processing');
  expect(authenticityStatusOf('rejected')).toBe('rejected');
  expect(authenticityStatusOf('rejected_invalid')).toBe('rejected_invalid');
  expect(authenticityStatusOf('invalid')).toBe('rejected_invalid');
  expect(authenticityStatusOf('')).toBe('unknown');
  expect(authenticityStatusOf(undefined)).toBe('unknown');
  expect(authenticityStatusOf(null)).toBe('unknown');
  expect(authenticityStatusOf({ status: 'approved' })).toBe('unknown');
});
