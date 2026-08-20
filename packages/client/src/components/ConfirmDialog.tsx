import { useEffect } from 'react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A generic "are you sure?" overlay for any destructive, hard-to-undo action — currently just
 * restarting a quiz mid-session, but written without anything quiz-specific baked in so the next
 * "this throws something away" action (e.g. disconnecting sync) can reuse it. Dismissible by
 * Escape or by clicking the backdrop, same as declining — neither one is the destructive path. */
export function ConfirmDialog({ title, message, confirmLabel, cancelLabel = 'Cancel', onConfirm, onCancel }: ConfirmDialogProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div className="confirm-dialog" onClick={onCancel}>
      <div className="confirm-dialog__card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-dialog-title">{title}</h2>
        <p>{message}</p>
        <div className="confirm-dialog__actions">
          <button type="button" className="confirm-dialog__button confirm-dialog__button--secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="confirm-dialog__button confirm-dialog__button--danger" onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
