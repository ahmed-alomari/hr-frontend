/**
 * Permission codes of the app (`exp.*`, registered with the backend
 * permission tree). In the prototype they gate screens and buttons; the
 * future backend must enforce them on every operation.
 */
export const EXP = {
  module: 'exp.module',
  expensesRead: 'exp.expenses.read',
  expensesCreate: 'exp.expenses.create',
  expensesApprove: 'exp.expenses.approve',
  expensesVoid: 'exp.expenses.void',
  custodyRead: 'exp.custody.read',
  custodyManage: 'exp.custody.manage',
  settlementsRead: 'exp.settlements.read',
  settlementsCreate: 'exp.settlements.create',
  reportsRead: 'exp.reports.read',
  setupManage: 'exp.setup.manage',
  periodsManage: 'exp.periods.manage',
  settingsUpdate: 'exp.settings.update',
} as const;
