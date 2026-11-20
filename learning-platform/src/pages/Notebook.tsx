import { useState } from "react";
import { Link } from "react-router-dom";
import { useRemote, RemoteState, Pagination } from "../components/remote";
import { PageHead, Panel, Button, Empty } from "../components/ui";
import type { Lesson, PageResult } from "../types";
import { LessonViewer } from "./Learning";

type Entry = Lesson & { course_title: string; note_body: string };
export function Notebook() {
  const [page, setPage] = useState(1);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const remote = useRemote<PageResult<Entry>>("lesson.bookmarks", {
    page: String(page),
  });
  return (
    <>
      <PageHead
        title="دفتر المراجعة"
        subtitle="دروس حفظتها وملاحظات تخص حسابك وحده، للعودة إليها متى احتجت."
      />
      <RemoteState {...remote} />
      <div className="learning-path-grid">
        {remote.result?.items.map((entry) => (
          <Panel key={entry.id}>
            <Link to={"/courses/" + entry.course_id}>{entry.course_title}</Link>
            <h2>{entry.title}</h2>
            <p className="path-goals">
              {entry.note_body || "لم تُضف ملاحظة بعد."}
            </p>
            <Button variant="secondary" onClick={() => setLesson(entry)}>
              فتح الدرس وملاحظاتي
            </Button>
          </Panel>
        ))}
      </div>
      {remote.result && !remote.result.total && (
        <Empty
          title="ابدأ دفتر مراجعتك"
          text="افتح أي درس، ثم فعّل حفظ الدرس للمراجعة واحفظ ملاحظاتك. ستجده هنا."
        />
      )}
      {remote.result && (
        <Pagination page={page} total={remote.result.total} onPage={setPage} />
      )}{" "}
      {lesson && (
        <LessonViewer
          lesson={lesson}
          onClose={() => {
            setLesson(null);
            remote.reload();
          }}
        />
      )}
    </>
  );
}
