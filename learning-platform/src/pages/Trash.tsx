import { useState } from "react";
import { api } from "../api";
import { ar, date, useApp } from "../context";
import type { PageResult } from "../types";
import { Button, Empty, PageHead, Panel, Table } from "../components/ui";
import { Pagination, RemoteState, useRemote } from "../components/remote";

interface RemovedRecord {
  kind: string;
  resource_id: string;
  title: string;
  removed_at: string;
}
const names: Record<string, string> = {
  account: "حساب",
  course: "دورة",
  lesson: "درس",
  file: "ملف",
  quiz: "اختبار",
  assignment: "واجب",
  class: "حصة",
  announcement: "إعلان",
  bag: "حقيبة",
  path: "مسار",
  video: "فيديو",
  certificate: "شهادة",
  support: "طلب دعم",
};
export default function TrashPage() {
  const { refresh, notify } = useApp();
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState("");
  const remote = useRemote<PageResult<RemovedRecord>>("trash.list", {
    page: String(page),
  });
  return (
    <>
      <PageHead title="سلة المحذوفات" />
      <RemoteState {...remote} />
      {remote.result?.items.length ? (
        <Panel>
          <Table headers={["العنصر", "النوع", "تاريخ الحذف", ""]}>
            {remote.result.items.map((item) => (
              <tr key={item.kind + item.resource_id}>
                <td>{item.title}</td>
                <td>{names[item.kind]}</td>
                <td>{date(item.removed_at)}</td>
                <td>
                  <Button
                    variant="secondary"
                    disabled={!!busy}
                    onClick={async () => {
                      setBusy(item.resource_id);
                      try {
                        await api("trash.restore", {
                          kind: item.kind,
                          id: item.resource_id,
                        });
                        await refresh();
                        remote.reload();
                        notify("تمت الاستعادة.");
                      } catch (e) {
                        notify((e as Error).message, "error");
                      } finally {
                        setBusy("");
                      }
                    }}
                  >
                    {busy === item.resource_id ? "جارٍ الاستعادة…" : "استعادة"}
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        </Panel>
      ) : !remote.loading && !remote.error ? (
        <Empty title="سلة المحذوفات فارغة" />
      ) : null}
      {remote.result && (
        <span className="muted">{ar(remote.result.total)} عنصر</span>
      )}
      <Pagination
        page={page}
        total={remote.result?.total ?? 0}
        onPage={setPage}
      />
    </>
  );
}
