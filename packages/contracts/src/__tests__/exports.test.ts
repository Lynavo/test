import { describe, it, expect } from 'vitest';
import * as contracts from '../index';

describe('@syncflow/contracts exports', () => {
  it('exports PROTOCOL_VERSION', () => {
    expect(contracts.PROTOCOL_VERSION).toBe('LMUP/2');
  });
  it('exports PROTOCOL_PORT', () => {
    expect(contracts.PROTOCOL_PORT).toBe(39393);
  });
  it('exports SIDECAR_HTTP_PORT', () => {
    expect(contracts.SIDECAR_HTTP_PORT).toBe(39394);
  });
  it('exports all MessageType values', () => {
    expect(contracts.MessageType.HELLO_REQ).toBe(0x0001);
    expect(contracts.MessageType.ERROR).toBe(0x0011);
    expect(Object.keys(contracts.MessageType)).toHaveLength(17);
  });
  it('exports all ErrorCode values', () => {
    expect(contracts.ErrorCode.PAIR_CODE_INVALID).toBe('PAIR_CODE_INVALID');
    expect(Object.keys(contracts.ErrorCode)).toHaveLength(12);
  });
  it('exports BACKOFF_RETRY_MS', () => {
    expect(contracts.BACKOFF_RETRY_MS).toEqual([5000, 15000, 30000]);
  });
});
