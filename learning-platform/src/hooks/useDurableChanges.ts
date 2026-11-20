import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError } from "../api";

type Entry<T> = { value: T; version: number };
export function useDurableChanges<T>(
  storageKey: string,
  send: (items: [string, T][]) => Promise<void>,
  enabled = true,
) {
  const pending = useRef<Record<string, Entry<T>> | null>(null);
  if (pending.current === null) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "{}");
      pending.current =
        saved && typeof saved === "object" && !Array.isArray(saved)
          ? (Object.fromEntries(
              Object.entries(saved)
                .slice(0, 500)
                .filter(
                  ([, v]) =>
                    v &&
                    typeof v === "object" &&
                    Number.isSafeInteger((v as Entry<T>).version),
                ),
            ) as Record<string, Entry<T>>)
          : {};
    } catch {
      pending.current = {};
    }
  }
  const counter = useRef(
    Math.max(
      0,
      ...Object.values(pending.current).map((v) => Number(v.version) || 0),
    ),
  );
  const [values, setValues] = useState<Record<string, T>>(() =>
    Object.fromEntries(
      Object.entries(pending.current!).map(([k, v]) => [k, v.value]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState<number | undefined>();
  const terminal = useRef(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const sendRef = useRef(send);
  const enabledRef = useRef(enabled);
  sendRef.current = send;
  enabledRef.current = enabled;
  const mounted = useRef(true);
  const active = useRef<Promise<boolean> | null>(null);
  const sync = useCallback(() => {
    try {
      if (Object.keys(pending.current!).length)
        sessionStorage.setItem(storageKey, JSON.stringify(pending.current));
      else sessionStorage.removeItem(storageKey);
    } catch {
      if (mounted.current)
        setError(
          "تعذر الاحتفاظ بالتغييرات على هذا الجهاز. أبقِ الصفحة مفتوحة حتى يؤكد الحفظ.",
        );
    }
    if (mounted.current)
      setValues(
        Object.fromEntries(
          Object.entries(pending.current!).map(([k, v]) => [k, v.value]),
        ),
      );
  }, [storageKey]);
  const flush = useCallback(
    async (manual = true): Promise<boolean> => {
      if (active.current) return active.current;
      if (terminal.current && !manual) return false;
      if (!Object.keys(pending.current!).length) return true;
      if (!enabledRef.current) return false;
      const work = async () => {
        if (mounted.current) {
          setSaving(true);
          setError("");
          setErrorStatus(undefined);
        }
        try {
          while (Object.keys(pending.current!).length && enabledRef.current) {
            const batch = Object.entries(pending.current!);
            await sendRef.current(batch.map(([k, v]) => [k, v.value]));
            for (const [key, entry] of batch) {
              if (pending.current![key]?.version === entry.version)
                delete pending.current![key];
            }
            sync();
            if (mounted.current) setSavedAt(new Date().toISOString());
          }
          return !Object.keys(pending.current!).length;
        } catch (e) {
          const status = e instanceof ApiRequestError ? e.status : undefined;
          terminal.current = !!status && status < 500 && status !== 429;
          if (mounted.current) {
            setError(
              e instanceof TypeError
                ? "تعذر الاتصال. التغييرات لم يؤكد الخادم حفظها؛ أبقِ الصفحة مفتوحة وأعد المحاولة."
                : (e as Error).message,
            );
            setErrorStatus(status);
          }
          return false;
        } finally {
          active.current = null;
          if (mounted.current) setSaving(false);
        }
      };
      active.current = work();
      return active.current;
    },
    [sync],
  );
  const enqueue = useCallback(
    (changes: Record<string, T>) => {
      terminal.current = false;
      for (const [key, value] of Object.entries(changes))
        pending.current![key] = { value, version: ++counter.current };
      sync();
    },
    [sync],
  );
  const clear = useCallback(() => {
    pending.current = {};
    sync();
  }, [sync]);
  useEffect(() => {
    if (!enabled || !Object.keys(values).length) return;
    const timer = window.setTimeout(() => void flush(false), 100);
    return () => window.clearTimeout(timer);
  }, [values, enabled, flush]);
  useEffect(() => {
    mounted.current = true;
    const retry = () => {
      if (document.visibilityState === "visible") void flush(false);
    };
    const guard = (event: BeforeUnloadEvent) => {
      if (Object.keys(pending.current!).length) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const leave = (event: MouseEvent) => {
      if (event.defaultPrevented || !Object.keys(pending.current!).length)
        return;
      const link = (event.target as Element | null)?.closest("a[href]");
      if (
        link &&
        !window.confirm(
          "توجد تغييرات لم يؤكد الخادم حفظها بعد. هل تريد مغادرة الصفحة؟",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const timer = window.setInterval(retry, 5000);
    window.addEventListener("online", retry);
    window.addEventListener("beforeunload", guard);
    document.addEventListener("visibilitychange", retry);
    document.addEventListener("click", leave, true);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      window.removeEventListener("online", retry);
      window.removeEventListener("beforeunload", guard);
      document.removeEventListener("visibilitychange", retry);
      document.removeEventListener("click", leave, true);
    };
  }, [flush]);
  return {
    values,
    saving,
    error,
    errorStatus,
    savedAt,
    enqueue,
    flush,
    clear,
    dirty: Object.keys(values).length > 0,
  };
}
