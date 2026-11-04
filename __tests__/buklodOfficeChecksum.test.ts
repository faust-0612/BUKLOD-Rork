import * as Crypto from 'expo-crypto';
import { encode } from 'base64-arraybuffer';
import { checksumOfficeBytes } from '@/lib/buklodOffice';

jest.mock('expo-document-picker', () => ({}));
jest.mock('expo-file-system', () => ({
  Directory: class Directory {},
  File: class File {},
  Paths: {},
}));
jest.mock('expo-image-manipulator', () => ({}));
jest.mock('react-native', () => ({
  Linking: {},
  Share: {},
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async () => 'stable-sha256'),
}));

describe('checksumOfficeBytes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hashes a canonical base64 string instead of passing ArrayBuffer to the native digest bridge', async () => {
    const bytes = new Uint8Array([10, 20, 30, 40]);
    await expect(checksumOfficeBytes(bytes)).resolves.toBe('stable-sha256');

    expect(Crypto.digestStringAsync).toHaveBeenCalledTimes(1);
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
      Crypto.CryptoDigestAlgorithm.SHA256,
      encode(bytes.buffer as ArrayBuffer),
    );
  });

  it('fingerprints only the visible range of an offset Uint8Array view', async () => {
    const backing = new Uint8Array([99, 1, 2, 3, 88]);
    const view = backing.subarray(1, 4);
    await checksumOfficeBytes(view);

    const visibleBytes = new Uint8Array([1, 2, 3]);
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
      Crypto.CryptoDigestAlgorithm.SHA256,
      encode(visibleBytes.buffer as ArrayBuffer),
    );
  });
});
