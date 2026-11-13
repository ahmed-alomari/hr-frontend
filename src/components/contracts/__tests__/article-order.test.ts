import { moveArticleId, orderedArticles } from '../article-order-list';
import { mergeEssentialArticleIds } from '@/features/hr/contracts/employment/utils/employment-contract-form';
import { applyContractTemplateToForm } from '@/features/hr/contracts/employment/utils/apply-contract-template';
import type { ContractTemplateDto } from '@/features/hr/contracts/contract-templates/types/contract-template';

describe('moveArticleId', () => {
  it('moves an article up and down by one place', () => {
    expect(moveArticleId(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveArticleId(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  });

  it('does nothing past either end', () => {
    const ids = ['a', 'b'];
    expect(moveArticleId(ids, 0, -1)).toBe(ids);
    expect(moveArticleId(ids, 1, 1)).toBe(ids);
  });
});

describe('orderedArticles', () => {
  it('follows the id order, not the catalog order', () => {
    const catalog = [
      { id: 'a', code: 'A', title: 'أ' },
      { id: 'b', code: 'B', title: 'ب' },
      { id: 'c', code: 'C', title: 'ج' },
    ];
    expect(orderedArticles(['c', 'a', 'b'], catalog).map((a) => a.code)).toEqual(['C', 'A', 'B']);
  });

  it('keeps an id that left the catalog', () => {
    expect(orderedArticles(['gone'], [])).toEqual([{ id: 'gone', code: '', title: '—' }]);
  });
});

describe('contract keeps the chosen order', () => {
  it('a basic article moved down stays down', () => {
    // Basic K was moved below optional A.
    expect(mergeEssentialArticleIds(['a', 'k'], ['k'])).toEqual(['a', 'k']);
  });

  it('basics not chosen yet are added at the end, in library order', () => {
    expect(mergeEssentialArticleIds(['a'], ['k1', 'k2'])).toEqual(['a', 'k1', 'k2']);
  });

  it('applying a template keeps the template order', () => {
    const template = {
      id: 't',
      defaultContractNature: 'indefinite',
      defaultWorkArrangement: 'full_time',
      currency: 'SAR',
      allowanceLines: [],
      articles: [{ articleId: 'c' }, { articleId: 'k' }, { articleId: 'a' }],
    } as unknown as ContractTemplateDto;
    const out = applyContractTemplateToForm(template, { essentialArticleIds: ['k', 'k2'] });
    expect(out.articleIds).toEqual(['c', 'k', 'a', 'k2']);
  });
});
