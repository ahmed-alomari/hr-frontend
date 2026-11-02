/**
 * Arabic messages for the store–inventory link refusals (phase 4). Used by
 * the API client's own toast as well as handleApiError: the client toasts
 * first and handleApiError then skips its toast, so a translation applied
 * only there never reached the screen.
 */
export function translateStoreStockMessage(rawMessage: string): string | null {
  const lower = rawMessage.trim().toLowerCase();
  if (!lower) return null;
  if (lower.includes('inventory is not available right now')) {
    return 'تعذّر الوصول إلى المخازن الآن، ولم يُنفَّذ الإجراء. أعد المحاولة بعد قليل.';
  }
  if (lower.includes('store–inventory link is not enabled')) {
    return 'ربط المتجر بالمخازن غير مفعّل لهذه الشركة.';
  }
  if (lower.includes('start draining the store–inventory link')) {
    return 'ابدأ تصريف ربط المتجر بالمخازن أولاً (من إعدادات المتجر ← المخازن والمتجر)، ثم عالج الطلبات المفتوحة قبل التعطيل.';
  }
  if (lower.includes('open inventory order(s)')) {
    return 'لا يمكن تعطيل ربط المتجر بالمخازن: توجد حجوزات أو طلبات مخازن مفتوحة أو طلبات قديمة بلا مصدر. اشحنها أو ألغها أو حدّد مصدرها أولاً.';
  }
  const openLocal = /^(\d+) open order\(s\) took the store's own quantity/.exec(lower);
  if (openLocal) {
    return lower.includes('before resuming')
      ? `لا يمكن استئناف البيع من المخازن: ${openLocal[1]} طلب مفتوح خُصم من كمية المنتج. اشحنه أو ألغه أولاً.`
      : `لا يمكن تفعيل ربط المتجر بالمخازن: ${openLocal[1]} طلب مفتوح خُصم من كمية المنتج ولن يُصرف من المستودع. اشحنه أو ألغه أولاً (راجع معاينة التفعيل في إعدادات المتجر).`;
  }
  if (lower.includes("choose the store's warehouse") && lower.includes('before enabling')) {
    return 'اختر مستودع المتجر من إعدادات المتجر ← المخازن والمتجر قبل تفعيل الربط.';
  }
  if (lower.includes('held in the current warehouse')) {
    return 'لا يمكن تغيير مستودع المتجر وفيه حجوزات مفتوحة: اشحن تلك الطلبات أو ألغها أولاً.';
  }
  if (lower.includes("the store's warehouse is not set")) {
    return 'مستودع المتجر غير محدد: اختره من إعدادات المتجر ← المخازن والمتجر.';
  }
  if (lower.startsWith('reserved stock:')) {
    return 'الكمية محجوزة لطلبات المتجر: لا يمكن صرف ما يمس المحجوز. اصرف كمية أقل أو عالج الطلبات أولاً.';
  }
  if (lower.includes('no longer covers this order')) {
    return 'رصيد مستودع المتجر لم يعد يغطي حجز هذا الطلب (تلف أو جرد): استلم مخزوناً أو ألغِ الطلب.';
  }
  if (lower.includes('left at this location after other prepared orders')) {
    return 'الكمية في هذا الموقع لا تكفي بعد ما جُهِّز منه لطلبات أخرى. اختر موقعاً آخر في مستودع المتجر.';
  }
  if (lower.includes("prepare this order from the store's warehouse")) {
    return 'جهّز هذا الطلب من مستودع المتجر المحدد في الإعدادات.';
  }
  if (lower.includes('prepare from an active internal')) {
    return 'جهّز من موقع داخلي فعّال (صالح للبيع) في مستودع المتجر.';
  }
  if (lower.includes('choose where this order takes its stock from')) {
    return 'حدّد مصدر مخزون هذا الطلب القديم أولاً (من قسم «مخزون الطلب»).';
  }
  if (lower.includes('not enough stock in the store') && lower.includes('to ship')) {
    return 'رصيد مستودع المتجر لا يكفي لشحن هذا الطلب.';
  }
  if (lower.includes('return of this order was already received') || lower.includes('already returned its quantity')) {
    return 'تم تأكيد استلام مرتجع هذا الطلب سابقاً.';
  }
  if (
    lower.includes('nothing issued for this order') ||
    lower.includes("nothing left this order's stock")
  ) {
    return 'لا توجد كمية صُرفت لهذا الطلب يمكن إرجاعها (لم يُشحن، أو أُرجعت سابقاً).';
  }
  if (lower.includes('approved opening')) {
    return 'كميات المنتجات تحتاج اعتماد الكميات الافتتاحية قبل البيع المحلي.';
  }
  return null;
}
