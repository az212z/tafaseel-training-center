import { useState } from "react";
import { Trash } from "@phosphor-icons/react";
import { api } from "../api";
import { isStaticPreview } from "../environment";
import { useApp } from "../context";
import { Button, Modal } from "./ui";

export function TrashButton({
  kind,
  id,
  title,
  onRemoved,
}: {
  kind: string;
  id: string;
  title: string;
  onRemoved?: () => void;
}) {
  const { user, refresh, notify } = useApp();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (isStaticPreview || !["admin", "instructor"].includes(user.role))
    return null;
  return (
    <>
      <button
        className="text-link danger-link"
        onClick={() => setConfirm(true)}
        type="button"
      >
        <Trash size={16} /> حذف
      </button>
      {confirm && (
        <Modal
          title="نقل إلى سلة المحذوفات"
          onClose={() => {
            if (!busy) setConfirm(false);
          }}
        >
          <p>{title}</p>
          <p className="muted">يمكن للإدارة استعادته من سلة المحذوفات.</p>
          {error && (
            <p className="alert alert-error" role="alert">
              {error}
            </p>
          )}
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await api("trash.remove", { id, kind });
                await refresh();
                setConfirm(false);
                notify("نُقل إلى سلة المحذوفات.");
                onRemoved?.();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            تأكيد الحذف
          </Button>
        </Modal>
      )}
    </>
  );
}
