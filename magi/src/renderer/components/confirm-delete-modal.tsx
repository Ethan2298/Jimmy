import { useEffect, useCallback } from "react";

interface ConfirmDeleteModalProps {
  item: { name: string; type: string } | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDeleteModal({ item, onConfirm, onCancel }: ConfirmDeleteModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    },
    [onCancel]
  );

  useEffect(() => {
    if (!item) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [item, handleKeyDown]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] flex items-center justify-center px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-[360px] rounded-[14px] border border-white/[0.12] bg-[#121214] p-5">
        <h2 className="text-[16px] font-medium text-center">
          Delete {item.type}?
        </h2>
        <p className="mt-1.5 text-[13px] text-white/50 truncate text-center">{item.name}</p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onConfirm}
            className="magi-no-drag h-9 w-full rounded-[9px] bg-red-600 hover:bg-red-500 text-white text-[13px]"
          >
            Delete
          </button>
          <button
            onClick={onCancel}
            className="magi-no-drag h-9 w-full rounded-[9px] border border-white/[0.12] text-[13px] text-white/75 hover:text-white hover:bg-white/[0.06]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
