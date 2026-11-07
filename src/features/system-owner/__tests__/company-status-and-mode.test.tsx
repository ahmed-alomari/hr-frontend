/**
 * @jest-environment jsdom
 *
 * The companies page splits companies into «الفعّالة / المتوقفة / المنتهية»;
 * the mode card asks for the company code before leaving production.
 */
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SystemOwnerCompany } from '@/features/system-owner/lib/api/system-owner';

const replace = jest.fn();
let search = '';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
  usePathname: () => '/system-owner',
  useSearchParams: () => new URLSearchParams(search),
}));

jest.mock('@/components/layouts/page-header-actions-context', () => ({
  usePageHeaderActions: () => undefined,
}));
jest.mock('@/components/layouts/set-page-title', () => ({ SetPageTitle: () => null }));

const company = (id: string, nameAr: string, status: SystemOwnerCompany['status']): SystemOwnerCompany => ({
  id,
  nameAr,
  code: id,
  status,
  operatingMode: 'trial',
});

const rows = [
  company('a1', 'شركة تعمل', 'active'),
  company('a2', 'شركة ثانية تعمل', 'active'),
  company('s1', 'شركة موقوفة', 'suspended'),
  company('x1', 'شركة منتهية', 'archived'),
];

const setMode = jest.fn();
jest.mock('@/features/system-owner/hooks/use-system-owner', () => ({
  useSystemOwnerCompanies: () => ({ data: { items: rows }, isLoading: false, isError: false }),
  useSystemOwnerMutations: () => ({
    createCompany: { isPending: false, mutateAsync: jest.fn() },
    setCompanyOperatingMode: { isPending: false, mutate: setMode },
  }),
}));

import { SystemOwnerCompaniesPage } from '@/features/system-owner/components/system-owner-companies-page';
import { CompanyModeCard } from '@/features/system-owner/components/company-mode-card';

beforeEach(() => {
  search = '';
  replace.mockClear();
  setMode.mockClear();
});

describe('companies page tabs', () => {
  it('shows active companies first, with a count on each tab', () => {
    render(<SystemOwnerCompaniesPage />);
    expect(screen.getByText('شركة تعمل')).toBeInTheDocument();
    expect(screen.getByText('شركة ثانية تعمل')).toBeInTheDocument();
    expect(screen.queryByText('شركة موقوفة')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /الفعّالة/ })).toHaveTextContent('2');
    expect(screen.getByRole('tab', { name: /المتوقفة/ })).toHaveTextContent('1');
    expect(screen.getByRole('tab', { name: /المنتهية/ })).toHaveTextContent('1');
  });

  it('opens the tab named in the link, and an unknown one falls back to active', () => {
    search = 'tab=archived';
    const { unmount } = render(<SystemOwnerCompaniesPage />);
    expect(screen.getByText('شركة منتهية')).toBeInTheDocument();
    expect(screen.queryByText('شركة تعمل')).not.toBeInTheDocument();
    unmount();

    search = 'tab=bogus';
    render(<SystemOwnerCompaniesPage />);
    expect(screen.getByText('شركة تعمل')).toBeInTheDocument();
  });

  it('switching tab writes it to the link', async () => {
    render(<SystemOwnerCompaniesPage />);
    await userEvent.click(screen.getByRole('tab', { name: /المتوقفة/ }));
    expect(replace).toHaveBeenCalledWith('/system-owner?tab=suspended', { scroll: false });
  });
});

describe('company mode card', () => {
  const production: SystemOwnerCompany = { ...company('acme', 'أكمي', 'active'), operatingMode: 'production' };

  it('leaving production stays disabled until the company code is typed', async () => {
    render(<CompanyModeCard company={production} />);
    await userEvent.click(screen.getByRole('radio', { name: /فحص/ }));
    const confirm = screen.getByRole('button', { name: 'تغيير الوضع' });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/رمز الشركة/), 'wrong');
    expect(confirm).toBeDisabled();
    await userEvent.clear(screen.getByLabelText(/رمز الشركة/));
    await userEvent.type(screen.getByLabelText(/رمز الشركة/), 'ACME');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(setMode).toHaveBeenCalledWith(
      { companyId: 'acme', mode: 'testing', confirmCode: 'ACME' },
      expect.anything(),
    );
  });

  it('entering production needs no code', async () => {
    render(<CompanyModeCard company={company('beta', 'بيتا', 'active')} />);
    await userEvent.click(screen.getByRole('radio', { name: /إنتاج/ }));
    expect(screen.queryByLabelText(/رمز الشركة/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'تغيير الوضع' }));
    expect(setMode).toHaveBeenCalledWith(
      { companyId: 'beta', mode: 'production', confirmCode: undefined },
      expect.anything(),
    );
  });
});
