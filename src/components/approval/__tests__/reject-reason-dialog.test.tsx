import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RejectReasonDialog } from '@/components/approval/reject-reason-dialog';
import {
  REJECT_REASON_SUGGESTIONS,
  isRejectReasonValid,
  toggleRejectReasonSuggestion,
} from '@/components/approval/reject-reasons';

describe('reject reason suggestions', () => {
  it('a suggestion fills an empty box', () => {
    expect(toggleRejectReasonSuggestion('', 'رصيد الإجازة غير كافٍ')).toBe('رصيد الإجازة غير كافٍ');
  });

  it('a second suggestion is added after the first, and a click again takes it out', () => {
    const two = toggleRejectReasonSuggestion('رصيد الإجازة غير كافٍ', 'ضغط العمل في هذه الفترة لا يسمح');
    expect(two).toBe('رصيد الإجازة غير كافٍ، ضغط العمل في هذه الفترة لا يسمح');
    expect(toggleRejectReasonSuggestion(two, 'رصيد الإجازة غير كافٍ')).toBe('ضغط العمل في هذه الفترة لا يسمح');
  });

  it('keeps what the approver typed by hand', () => {
    expect(toggleRejectReasonSuggestion('تم الاتفاق شفهياً', 'رصيد الإجازة غير كافٍ')).toBe(
      'تم الاتفاق شفهياً، رصيد الإجازة غير كافٍ',
    );
  });

  it('a suggestion with a comma inside is taken out whole', () => {
    const withComma = 'التواريخ غير صحيحة، يُرجى تعديلها وإعادة التقديم';
    const two = toggleRejectReasonSuggestion('رصيد الإجازة غير كافٍ', withComma);
    expect(toggleRejectReasonSuggestion(two, withComma)).toBe('رصيد الإجازة غير كافٍ');
    expect(toggleRejectReasonSuggestion(withComma, withComma)).toBe('');
  });

  it('taking out the middle suggestion keeps the other two joined', () => {
    const three = 'أ ب ت، رصيد الإجازة غير كافٍ، ث ج ح';
    expect(toggleRejectReasonSuggestion(three, 'رصيد الإجازة غير كافٍ')).toBe('أ ب ت، ث ج ح');
  });

  it('needs 3 letters at least, like the server', () => {
    expect(isRejectReasonValid('')).toBe(false);
    expect(isRejectReasonValid('  لا ')).toBe(false);
    expect(isRejectReasonValid('غير مناسب')).toBe(true);
  });

  it('every request kind has suggestions', () => {
    for (const list of Object.values(REJECT_REASON_SUGGESTIONS)) {
      expect(list.length).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('RejectReasonDialog', () => {
  function setup(onConfirm = jest.fn().mockResolvedValue(undefined)) {
    const onOpenChange = jest.fn();
    render(
      <RejectReasonDialog
        open
        onOpenChange={onOpenChange}
        kind="leave"
        title="رفض طلب الإجازة"
        description="سارة أحمد"
        onConfirm={onConfirm}
      />,
    );
    return { onConfirm, onOpenChange };
  }

  it('cannot confirm with no reason', () => {
    const { onConfirm } = setup();
    expect(screen.getByRole('button', { name: /تأكيد الرفض/ })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('a suggestion fills the reason and the reason is sent', async () => {
    const user = userEvent.setup();
    const { onConfirm, onOpenChange } = setup();
    await user.click(screen.getByRole('button', { name: 'رصيد الإجازة غير كافٍ' }));
    expect(screen.getByLabelText(/سبب الرفض/)).toHaveValue('رصيد الإجازة غير كافٍ');
    await user.click(screen.getByRole('button', { name: /تأكيد الرفض/ }));
    expect(onConfirm).toHaveBeenCalledWith('رصيد الإجازة غير كافٍ');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('stays open with the reason when the server refuses', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = setup(jest.fn().mockRejectedValue(new Error('500')));
    await user.type(screen.getByLabelText(/سبب الرفض/), 'غير مناسب');
    await user.click(screen.getByRole('button', { name: /تأكيد الرفض/ }));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByLabelText(/سبب الرفض/)).toHaveValue('غير مناسب');
  });
});
