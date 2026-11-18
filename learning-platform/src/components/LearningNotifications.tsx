import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCircle, ArrowLeft } from "@phosphor-icons/react";
import { api, get } from "../api";
import { ar, date, useApp } from "../context";
import { Modal, Empty, Button } from "./ui";
import { Pagination } from "./remote";

interface LearningUpdate {
  id: string;
  course_id: string;
  title: string;
  body: string;
  link_path: string;
  read_at: string | null;
  created_at: string;
}
interface Updates {
  items: LearningUpdate[];
  unread: number;
  total: number;
  page: number;
  page_size: number;
}

export function LearningNotificationBell({
  onWorkspace,
}: {
  onWorkspace: (id: string) => void;
}) {
  const { data, notify } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Updates | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  const newest = useRef<string | null>(null);
  const reload = useCallback(async () => {
    const sequence = ++request.current;
    try {
      const next = await get<Updates>("learning.updates", {
        page: String(page),
      });
      if (sequence !== request.current) return;
      const first = next.items[0];
      if (
        page === 1 &&
        first &&
        newest.current &&
        first.id !== newest.current &&
        !first.read_at
      ) {
        notify(first.title);
      }
      if (page === 1) newest.current = first?.id ?? "";
      setResult(next);
      setError("");
    } catch (e) {
      if (sequence === request.current) setError((e as Error).message);
    }
  }, [page, notify]);
  useEffect(() => {
    void reload();
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    const timer = window.setInterval(refreshVisible, 15000);
    document.addEventListener("visibilitychange", refreshVisible);
    window.addEventListener("focus", refreshVisible);
    return () => {
      request.current++;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisible);
      window.removeEventListener("focus", refreshVisible);
    };
  }, [reload]);
  async function read(item?: LearningUpdate) {
    setBusy(true);
    try {
      await api(
        "learning.updates.read",
        item ? { id: item.id } : { all: true },
      );
      await reload();
      if (item) {
        setOpen(false);
        onWorkspace(item.course_id);
        navigate(item.link_path);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="icon-btn notification-button"
        aria-label={`الإشعارات${result?.unread ? `، ${ar(result.unread)} غير مقروءة` : ""}`}
        onClick={() => {
          setOpen(true);
          void reload();
        }}
      >
        <Bell size={22} />
        {!!result?.unread && (
          <span className="notification-count" aria-hidden="true">
            {result.unread > 99 ? "+٩٩" : ar(result.unread)}
          </span>
        )}
      </button>
      {open && (
        <Modal title="إشعارات التعلم" onClose={() => setOpen(false)}>
          <div className="row-between">
            <p className="muted" role="status">
              {result
                ? `${ar(result.unread)} إشعار غير مقروء`
                : "جارٍ تحميل الإشعارات…"}
            </p>
            {!!result?.unread && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void read()}
              >
                <CheckCircle size={18} />
                قراءة الكل
              </Button>
            )}
          </div>
          {error && (
            <div className="alert" role="alert">
              {error}
              <button className="text-link" onClick={() => void reload()}>
                إعادة المحاولة
              </button>
            </div>
          )}
          {result?.items.map((item) => (
            <button
              key={item.id}
              className={`learning-notification ${item.read_at ? "" : "unread"}`}
              disabled={busy}
              onClick={() => void read(item)}
            >
              <span className="update-icon">
                <Bell size={20} />
              </span>
              <span>
                <strong>{item.title}</strong>
                <span>{item.body}</span>
                <small>
                  {date(item.created_at, {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {!item.read_at && " • جديد"}
                </small>
              </span>
              <ArrowLeft size={18} />
            </button>
          ))}
          {result && !result.items.length && !error && (
            <Empty
              title="لا توجد تحديثات جديدة"
              text="ستصلك هنا إشعارات الدروس والواجبات والاختبارات والحصص والملفات الجديدة في دوراتك."
            />
          )}
          {result && result.total > result.page_size && (
            <Pagination
              page={page}
              total={result.total}
              size={result.page_size}
              onPage={setPage}
            />
          )}
          {data.announcements.some((a) => !a.course_id) && (
            <section aria-label="إعلانات المركز">
              <h3>إعلانات المركز</h3>
              {data.announcements
                .filter((a) => !a.course_id)
                .slice(0, 3)
                .map((a) => (
                  <button
                    key={a.id}
                    className="learning-notification"
                    onClick={() => {
                      setOpen(false);
                      navigate("/announcements");
                    }}
                  >
                    <span className="update-icon">
                      <Bell size={20} />
                    </span>
                    <span>
                      <strong>{a.title}</strong>
                      <small>{date(a.created_at)}</small>
                    </span>
                    <ArrowLeft size={18} />
                  </button>
                ))}
            </section>
          )}
        </Modal>
      )}
    </>
  );
}
