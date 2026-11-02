import { translateAppDependencyError } from '@/shared/api/app-dependency-messages';

const envelope = (error: Record<string, unknown>) => ({ status: 400, message: 'x', data: null, error });

describe('translateAppDependencyError', () => {
  it('names the apps to enable first, in order', () => {
    const text = translateAppDependencyError(
      envelope({
        code: 'APP_DEPENDENCIES_MISSING',
        missing: ['contacts'],
        app: { code: 'inventory', nameAr: 'المخازن' },
        enableFirst: [
          { code: 'catalog', nameAr: 'الكتالوج' },
          { code: 'contacts', nameAr: 'جهات الاتصال' },
        ],
      }),
    );
    expect(text).toContain('لا يمكن تفعيل «المخازن»');
    expect(text).toContain('«الكتالوج» ثم «جهات الاتصال»');
  });

  it('falls back to the codes from an older backend', () => {
    const text = translateAppDependencyError(envelope({ code: 'APP_DEPENDENCIES_MISSING', missing: ['contacts'] }));
    expect(text).toContain('«contacts»');
  });

  it('names the enabled apps to disable first', () => {
    const text = translateAppDependencyError(
      envelope({
        code: 'APP_HAS_ENABLED_DEPENDENTS',
        app: { code: 'contacts', nameAr: 'جهات الاتصال' },
        disableFirst: [{ code: 'inventory', nameAr: 'المخازن' }],
      }),
    );
    expect(text).toContain('لا يمكن تعطيل «جهات الاتصال»');
    expect(text).toContain('«المخازن»');
  });

  it('a link to inventory goes off only with one of its apps (§21)', () => {
    const text = translateAppDependencyError(
      envelope({
        code: 'APP_BRIDGE_FOLLOWS_APPS',
        app: { code: 'store-stock-sync', nameAr: 'ربط المتجر بالمخازن' },
        follows: [
          { code: 'inventory', nameAr: 'المخازن' },
          { code: 'store-admin', nameAr: 'إدارة المتجر' },
        ],
      }),
    );
    expect(text).toContain('«ربط المتجر بالمخازن» ربط تلقائي لا يُعطَّل وحده');
    expect(text).toContain('«المخازن» أو «إدارة المتجر»');
  });

  it('ignores other errors', () => {
    expect(translateAppDependencyError(envelope({ code: 'OTHER' }))).toBeNull();
    expect(translateAppDependencyError(null)).toBeNull();
  });
});
