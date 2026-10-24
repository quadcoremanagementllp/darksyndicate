'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface ReviewDetail {
  label: string;
  value: string;
}

interface BookingReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  details: ReviewDetail[];
  amount: string;
  confirmLabel: string;
  submitting: boolean;
}

export function BookingReviewDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  details,
  amount,
  confirmLabel,
  submitting,
}: BookingReviewDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={submitting ? () => {} : onClose}
      title={title}
      description="Review the details before confirming."
      size="lg"
      closeOnOverlay={!submitting}
      showCloseButton={!submitting}
      className="border border-cyan-500/30 bg-[#090f19]"
      footer={
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="button" variant="accent" onClick={onConfirm} disabled={submitting} className="font-heading font-bold">
            {submitting ? 'Please wait...' : confirmLabel}
          </Button>
        </div>
      }
    >
      <dl className="divide-y divide-ds-border rounded-xl border border-ds-border bg-ds-dark/60 px-4">
        {details.map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <dt className="text-xs font-mono uppercase text-ds-text-muted">{label}</dt>
            <dd className="text-sm font-semibold text-ds-ice sm:text-right break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3">
        <span className="text-xs font-mono font-bold uppercase text-cyan-300">Pay after session</span>
        <span className="font-heading text-xl font-black text-ds-ice">{amount}</span>
      </div>
    </Modal>
  );
}
