'use client';

import { Modal } from '@/components/ui/Modal';

export type StaffArena = 'PS5' | 'POOL_TABLE';

interface StaffArenaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (arena: StaffArena) => void;
  accessibleTitle: string;
  busy?: boolean;
}

export function StaffArenaPickerModal({ isOpen, onClose, onSelect, accessibleTitle, busy = false }: StaffArenaPickerModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      ariaLabel={accessibleTitle}
      size="md"
      closeOnOverlay={!busy}
      showCloseButton={false}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSelect('PS5')}
          className="flex min-h-20 items-center gap-3 rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-5 text-left font-heading text-lg font-bold text-white transition-colors hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-50"
        >
          <span aria-hidden="true">🎮</span> PlayStation 5
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSelect('POOL_TABLE')}
          className="flex min-h-20 items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-left font-heading text-lg font-bold text-white transition-colors hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50"
        >
          <span aria-hidden="true">🎱</span> Snooker Lounge
        </button>
      </div>
    </Modal>
  );
}
