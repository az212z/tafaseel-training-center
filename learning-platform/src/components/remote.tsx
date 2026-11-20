import { useCallback, useEffect, useState } from "react";
import { get } from "../api";
import { Button } from "./ui";
export function useRemote<T>(
  action: string,
  params: Record<string, string> = {},
  enabled = true,
) {
  const key = JSON.stringify(params);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((x) => x + 1), []);
  useEffect(() => {
    let live = true;
    if (!enabled) {
      setResult(null);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    get<T>(action, JSON.parse(key))
      .then((r) => {
        if (live) setResult(r);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [action, key, revision, enabled]);
  return { result, error, loading, reload };
}
export function RemoteState({
  error,
  loading,
  reload,
}: {
  error: string;
  loading: boolean;
  reload: () => void;
}) {
  return error ? (
    <div className="alert alert-error" role="alert">
      {error}
      <Button type="button" variant="secondary" onClick={reload}>
        إعادة المحاولة
      </Button>
    </div>
  ) : loading ? (
    <p className="compact-empty" role="status">
      جارٍ تحميل البيانات…
    </p>
  ) : null;
}
export function Pagination({
  page,
  total,
  size = 25,
  onPage,
}: {
  page: number;
  total: number;
  size?: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="pagination">
      <Button
        type="button"
        variant="secondary"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        السابق
      </Button>
      <span>
        صفحة {page} من {pages} • {total} سجل
      </span>
      <Button
        type="button"
        variant="secondary"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        التالي
      </Button>
    </div>
  );
}
export const money = (amount: number) =>
  new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(
    amount / 100,
  );
