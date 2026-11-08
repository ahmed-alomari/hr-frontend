/** Routes of the expenses & custody app (`/expenses`). */
export const expensesRoutes = {
  overview: '/expenses',
  expenses: '/expenses/transactions',
  expenseDetail: (id: string) => `/expenses/transactions/${encodeURIComponent(id)}`,
  custody: '/expenses/custody',
  custodyDetail: (id: string) => `/expenses/custody/${encodeURIComponent(id)}`,
  people: '/expenses/people',
  personDetail: (id: string) => `/expenses/people/${encodeURIComponent(id)}`,
  settlements: '/expenses/settlements',
  approvals: '/expenses/approvals',
  setup: '/expenses/setup',
  reports: '/expenses/reports',
  reportCustody: '/expenses/reports/custody',
  reportCash: '/expenses/reports/cash',
  reportPeople: '/expenses/reports/people',
  settings: '/expenses/settings',
} as const;

export function isExpensesNavPath(pathname: string): boolean {
  return pathname === expensesRoutes.overview || pathname.startsWith(`${expensesRoutes.overview}/`);
}
