import { ProductDetailPage } from '@/features/catalog/products/components/product-detail-page';

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <ProductDetailPage productId={id} />;
}
