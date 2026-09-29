import { describe, it, expect } from 'vitest';
import bcrypt from 'bcrypt';
import { hashPassword, verifyPassword } from '../../services/authService';

describe('password hashing', () => {
  it('hashes a password', async () => {
    const hash = await hashPassword('Password1');
    expect(hash).not.toBe('Password1');
    expect(hash.startsWith('$2b$')).toBe(true);
  });

  it('verifies a correct password', async () => {
    const hash = await hashPassword('Password1');
    const valid = await verifyPassword('Password1', hash);
    expect(valid).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('Password1');
    const valid = await verifyPassword('WrongPassword', hash);
    expect(valid).toBe(false);
  });

  it('produces different hashes for the same password (salt randomness)', async () => {
    const hash1 = await hashPassword('Password1');
    const hash2 = await hashPassword('Password1');
    expect(hash1).not.toBe(hash2);
  });

  it('uses 12 bcrypt rounds', async () => {
    const hash = await hashPassword('Password1');
    const rounds = bcrypt.getRounds(hash);
    expect(rounds).toBe(12);
  });
});
