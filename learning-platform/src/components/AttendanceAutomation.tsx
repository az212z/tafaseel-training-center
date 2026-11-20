import { useState } from "react";
import { Pause, Play } from "@phosphor-icons/react";
import type { ClassSession } from "../types";
import { date, useApp } from "../context";
import { api } from "../api";
import { Button, Panel, Field, Badge } from "./ui";
import { isStaticPreview } from "../environment";

export function AttendanceAutomation({ session }: { session: ClassSession }) {
  const { data, notify, refresh } = useApp();
  const rule = session.attendance_automation;
  const [mode, setMode] = useState(rule?.mode ?? "manual");
  const [busy, setBusy] = useState(false);
  const active = !!rule?.enabled && !!rule.started_at;
  const available =
    Date.now() >= new Date(session.starts_at).getTime() - 900000 &&
    Date.now() < new Date(session.ends_at).getTime();
  async function control(command: "start" | "pause") {
    setBusy(true);
    try {
      await api("class.attendance.control", {
        class_id: session.id,
        command,
        mode,
      });
      await refresh();
      notify(
        command === "pause"
          ? "أُوقف التغييب التلقائي لهذه الحصة."
          : mode === "zoom"
            ? "سيبدأ احتساب المهلة عند بدء لقاء زوم."
            : "بدأت مهلة الحضور. سجّل الطلاب الحاضرين قبل انتهائها.",
      );
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title="متابعة الحضور بعد ٢٠ دقيقة">
      <p>
        سجّل الحاضرين والمتأخرين والمعتذرين. بعد انتهاء المهلة يُسجَّل الطالب الذي
        لم يُرصد حضوره غائبًا، وتُجهَّز رسالة إلى ولي أمره عند تفعيل رسائله.
      </p>
      {active && rule.deadline && (
        <Badge tone="green">
          تنتهي مهلة الحضور{" "}
          {date(rule.deadline, { hour: "numeric", minute: "2-digit" })}
        </Badge>
      )}
      {rule?.needs_review && (
        <div className="alert">
          هناك مشارك في زوم لم يُربط بحساب طالب. التغييب الآلي متوقف للمراجعة؛
          راجع الحضور، ثم أوقف المتابعة وابدأ رصد المعلم عند الحاجة.
        </div>
      )}
      {!active && (
        <Field label="مصدر الحضور">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "manual" | "zoom")}
          >
            <option value="manual">رصد المعلم داخل تفاصيل</option>
            <option value="zoom" disabled={!data.capabilities?.zoom}>
              الحضور الفعلي من زوم
            </option>
          </select>
        </Field>
      )}
      <div className="form-actions">
        {!active && (
          <Button
            disabled={busy || !available || isStaticPreview}
            onClick={() => void control("start")}
          >
            <Play size={18} />
            {mode === "zoom" ? "تفعيل متابعة زوم" : "بدء مهلة الحضور"}
          </Button>
        )}
        {rule?.enabled && (
          <Button
            variant="secondary"
            disabled={busy || isStaticPreview}
            onClick={() => void control("pause")}
          >
            <Pause size={18} />
            إيقاف التغييب التلقائي
          </Button>
        )}
      </div>
      {!available && (
        <small className="muted">
          يُتاح بدء المتابعة قبل الحصة بربع ساعة وحتى نهايتها.
        </small>
      )}
    </Panel>
  );
}
