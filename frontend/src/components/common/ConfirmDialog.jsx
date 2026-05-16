import Modal from './Modal';

export default function ConfirmDialog({ open, onClose, onConfirm, title = 'Confirm', message, loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-gray-600 mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-danger" onClick={onConfirm} disabled={loading}>
          {loading ? 'Processing...' : 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}
