import type { PartnerAuthSessionPayload } from '@/features/ecommerce/storefront/domain/partner-auth';
import {
  forgetTrustedDevice,
  readTrustedDevice,
  rememberTrustedDevice,
} from '@/features/ecommerce/storefront/lib/store-trusted-device';

const COMPANY = 'c1';
const KEY = 'k'.repeat(43);

const session = (user: { email: string; phone: string }, deviceToken: string | null = KEY) =>
  ({
    access_token: 't',
    userId: 'u1',
    partnerId: 'p1',
    companyId: COMPANY,
    user: { id: 'u1', fullNameAr: 'عميل', userType: 'external_customer', ...user },
    partner: {},
    deviceToken,
  }) as unknown as PartnerAuthSessionPayload;

beforeEach(() => window.localStorage.clear());

describe('store trusted device', () => {
  it('keeps an email account (lower case) with its key', () => {
    rememberTrustedDevice(session({ email: 'Name@Example.com', phone: '' }));
    expect(readTrustedDevice(COMPANY)).toEqual({
      email: 'name@example.com',
      mobile: null,
      token: KEY,
    });
  });

  it('keeps both the email and the mobile of an account that has both', () => {
    rememberTrustedDevice(session({ email: 'a@b.com', phone: '+967771234567' }));
    expect(readTrustedDevice(COMPANY)).toEqual({
      email: 'a@b.com',
      mobile: '+967771234567',
      token: KEY,
    });
  });

  it('reads a key saved before email support (mobile only)', () => {
    window.localStorage.setItem(
      `store-trusted-device:${COMPANY}`,
      JSON.stringify({ mobile: '+967771234567', token: KEY }),
    );
    expect(readTrustedDevice(COMPANY)).toEqual({
      email: null,
      mobile: '+967771234567',
      token: KEY,
    });
  });

  it('keeps nothing without a key (setting off), and forgets on demand', () => {
    rememberTrustedDevice(session({ email: 'a@b.com', phone: '' }, null));
    expect(readTrustedDevice(COMPANY)).toBeNull();

    rememberTrustedDevice(session({ email: 'a@b.com', phone: '' }));
    forgetTrustedDevice(COMPANY);
    expect(readTrustedDevice(COMPANY)).toBeNull();
  });
});
