import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  BarChart3,
  CheckSquare,
  FolderKanban,
  HandCoins,
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import { expensesRoutes } from './routes';

export type ExpensesNavItem = { labelAr: string; href: string; icon: LucideIcon; advancedOnly?: boolean };
export type ExpensesNavGroup = { key: string; labelAr: string; icon: LucideIcon; items: ExpensesNavItem[] };

export const expensesOverviewItem: ExpensesNavItem = {
  labelAr: 'لوحة التحكم',
  href: expensesRoutes.overview,
  icon: LayoutDashboard,
};

export const expensesNavGroups: ExpensesNavGroup[] = [
  {
    key: 'operations',
    labelAr: 'العمليات',
    icon: Receipt,
    items: [
      { labelAr: 'المصروفات', href: expensesRoutes.expenses, icon: Receipt },
      { labelAr: 'العهد والسلف', href: expensesRoutes.custody, icon: Wallet },
      { labelAr: 'التسويات والسداد', href: expensesRoutes.settlements, icon: HandCoins },
      { labelAr: 'الاعتمادات', href: expensesRoutes.approvals, icon: CheckSquare },
    ],
  },
  {
    key: 'accounts',
    labelAr: 'الحسابات',
    icon: Users,
    items: [
      { labelAr: 'حسابات الأشخاص', href: expensesRoutes.people, icon: Users },
    ],
  },
  {
    key: 'reports',
    labelAr: 'التقارير',
    icon: BarChart3,
    items: [
      { labelAr: 'تحليل المصروفات', href: expensesRoutes.reports, icon: BarChart3 },
      { labelAr: 'تقرير الأشخاص', href: expensesRoutes.reportPeople, icon: Users },
      { labelAr: 'تقرير العهد', href: expensesRoutes.reportCustody, icon: Wallet },
      { labelAr: 'حركة النقد', href: expensesRoutes.reportCash, icon: Banknote },
    ],
  },
  {
    key: 'setup',
    labelAr: 'التهيئة',
    icon: Settings,
    items: [
      { labelAr: 'الفئات والمجموعات ومراكز التكلفة', href: expensesRoutes.setup, icon: FolderKanban },
      { labelAr: 'الإعدادات والسياسات', href: expensesRoutes.settings, icon: Settings },
    ],
  },
];
