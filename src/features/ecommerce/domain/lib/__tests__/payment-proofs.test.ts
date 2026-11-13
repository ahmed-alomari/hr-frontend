import { resolvePaymentProofUrls } from '@/features/ecommerce/domain/lib/payment-proofs';

describe('resolvePaymentProofUrls (store plan A3)', () => {
  it('sends an uploaded receipt through the API proxy, keeping its signature', () => {
    const [url] = resolvePaymentProofUrls({
      paymentProofUrls: ['/uploads/store-order-files/r.jpg?exp=1&sig=abc'],
    });
    expect(url).not.toBe('/uploads/store-order-files/r.jpg?exp=1&sig=abc');
    expect(url.endsWith('/uploads/store-order-files/r.jpg?exp=1&sig=abc')).toBe(true);
  });

  it('keeps an old embedded image as it is', () => {
    const legacy = 'data:image/jpeg;base64,/9j/4AAQ';
    expect(resolvePaymentProofUrls({ paymentProofUrl: legacy })).toEqual([legacy]);
  });

  it('drops blanks and duplicates', () => {
    const urls = resolvePaymentProofUrls({
      paymentProofUrls: ['/uploads/store-order-files/a.jpg', ' ', '/uploads/store-order-files/a.jpg'],
    });
    expect(urls).toHaveLength(1);
  });
});
