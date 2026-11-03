/** Partner portal account kinds (Public - Partner Auth). */
export type PartnerAccountKind = 'customer' | 'vendor' | 'visitor';

export type PartnerAuthUser = {
  id: string;
  email: string;
  phone: string;
  fullNameAr: string;
  /** e.g. external_customer | supplier | visitor */
  userType: string;
};

export type PartnerAuthPartner = {
  id: string;
  companyId: string;
  name: string;
  displayName: string;
  isCustomer: boolean;
  isVendor: boolean;
  email: string;
  mobile: string;
  accountKind?: PartnerAccountKind;
};

/** Shared success payload from register / login (`data`). */
export type PartnerAuthSessionPayload = {
  access_token: string;
  userId: string;
  partnerId: string;
  companyId: string;
  user: PartnerAuthUser;
  partner: PartnerAuthPartner;
  message?: string | null;
  /** Trusted-device key (store setting on): keep it on this device. */
  deviceToken?: string | null;
};

export type PartnerRegisterInput = {
  companyId: string;
  name: string;
  /** This or `mobile` (at least one); only the email can recover a password. */
  email?: string | null;
  mobile?: string | null;
  password: string;
  accountKind?: PartnerAccountKind;
  branchId?: string | null;
};

export type PartnerLoginInput = {
  /** Email or mobile */
  identifier: string;
  password: string;
  companyId?: string;
};

export type PartnerUpdateProfileInput = {
  name: string;
  email: string;
  mobile: string;
};

export type PartnerMePayload = {
  user: PartnerAuthUser;
  partner: PartnerAuthPartner;
  companyId: string;
  userId: string;
  partnerId: string;
  partnerStatus?: string;
};

export class PartnerAuthApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = 'PartnerAuthApiError';
    this.status = status;
    this.code = code;
  }
}
