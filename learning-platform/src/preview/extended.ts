import type {
  LearningBag,
  NotificationRecord,
  Order,
  PageResult,
} from "../types";
import { dbState, save, uid, now } from "./store";
import { actor, course, canStudent, canCourse } from "./api";
export interface PreviewExtras {
  commerce: {
    course_id: string;
    price_minor: number;
    enrollment_open: number;
  }[];
  registrations?: {
    student_id: string;
    course_id: string;
    created_at: string;
  }[];
  bags: LearningBag[];
  orders: Order[];
  preferences: Record<
    string,
    { sms_enabled: boolean; consent_at: string | null }
  >;
  notifications: NotificationRecord[];
}
export async function extras() {
  const s = dbState();
  if (!s.extensions) {
    const available = s.courses.find((c) => c.status === "draft");
    if (available) available.status = "published";
    s.extensions = {
      commerce: s.courses
        .filter((c) => c.status === "published")
        .map((c, i) => ({
          course_id: c.id,
          price_minor: c.id === available?.id ? 19900 : i === 0 ? 0 : 29900,
          enrollment_open: 1,
        })),
      bags: [],
      orders: [],
      preferences: {},
      notifications: [],
    };
    await save();
  }
  return s.extensions;
}
const page = <T>(items: T[], n: number): PageResult<T> => ({
  items: items.slice((n - 1) * 25, n * 25),
  total: items.length,
  page: n,
  page_size: 25,
});
const value = (v: unknown) => (typeof v === "string" ? v.trim() : "");
function requireAdmin() {
  return actor(["admin"]);
}
export async function extendedApi<T>(
  action: string,
  d: Record<string, unknown>,
): Promise<T | undefined> {
  const e = await extras();
  const s = dbState();
  const n = Math.max(1, Number(d.page) || 1);
  if (action === "catalog") {
    const search = value(d.search);
    return page(
      e.commerce
        .filter((o) => o.enrollment_open)
        .map((o) => {
          const c = s.courses.find((c) => c.id === o.course_id)!;
          return {
            ...c,
            ...o,
            currency: "SAR",
            students_count: s.enrollments.filter((v) => v.course_id === c.id)
              .length,
          };
        })
        .filter(
          (c) =>
            c.status === "published" &&
            (!d.course_id || c.id === d.course_id) &&
            (!search ||
              c.title.includes(search) ||
              c.category.includes(search)),
        ),
      n,
    ) as T;
  }
  if (action === "register") {
    const name = value(d.name),
      email = value(d.email),
      birth = value(d.birth_date);
    if (
      name.length < 2 ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      !birth ||
      !Number.isFinite(Date.parse(birth)) ||
      d.consent !== true
    )
      throw new Error("أكمل بيانات التسجيل والموافقة التجريبية.");
    const age = (Date.now() - Date.parse(birth)) / 31557600000;
    if (age < 0 || age > 100) throw new Error("راجع تاريخ الميلاد.");
    if (age < 18 && (!value(d.guardian_name) || !value(d.guardian_phone)))
      throw new Error("أكمل بيانات ولي الأمر للقاصر.");
    if (!s.users.some((u) => u.email === email)) {
      const selected = value(d.course_id);
      if (
        selected &&
        (!s.courses.some(
          (c) => c.id === selected && c.status === "published",
        ) ||
          !e.commerce.some(
            (c) => c.course_id === selected && c.enrollment_open,
          ))
      )
        throw new Error("التسجيل غير متاح.");
      const id = uid();
      s.users.push({
        id,
        name,
        email,
        role: "student",
        active: 0,
        created_at: now(),
      });
      s.profiles[id] = {
        birth_date: birth,
        city: value(d.city),
        phone: value(d.phone),
        guardian_name: value(d.guardian_name),
        guardian_phone: value(d.guardian_phone),
        identity_number: "",
        guardian_id: null,
      };
      if (selected)
        (e.registrations ??= []).push({
          student_id: id,
          course_id: selected,
          created_at: now(),
        });
    }
    await save();
    return {
      ok: true,
      message:
        "تم إنشاء طلب تسجيل وهمي. يمكن مراجعته من حساب الإدارة؛ لا تُحفظ كلمة المرور ولا يُنشأ دخول حقيقي.",
    } as T;
  }
  const supported = [
    "integrations",
    "commerce.save",
    "checkout",
    "course.apply",
    "course.registration",
    "course.requests",
    "orders",
    "preview.payment.confirm",
    "payment.refresh",
    "bags",
    "bag.save",
    "bag.item.save",
    "bag.item.remove",
    "guardian.preference",
    "guardian.preference.save",
    "notifications",
    "notification.retry",
    "videos",
    "students.list",
    "users.list",
    "lesson",
  ];
  if (!supported.includes(action)) return undefined;
  const u = actor();
  switch (action) {
    case "integrations":
      requireAdmin();
      return {
        services: Object.fromEntries(
          ["moyasar", "sms", "zoom", "video", "s3"].map((k) => [
            k,
            { configured: false, mode: "not_configured" },
          ]),
        ),
        storage: {
          driver: "browser",
          file_limit_bytes: 10485760,
          storage_quota_bytes: 31457280,
        },
        registration_enabled: true,
      } as T;
    case "commerce.save":
      requireAdmin();
      course(u, value(d.course_id), true);
      {
        const price = Number(d.price_minor);
        if (!Number.isInteger(price) || price < 0 || price > 100000000)
          throw new Error("راجع السعر.");
        const old = e.commerce.find((c) => c.course_id === d.course_id);
        const row = {
          course_id: value(d.course_id),
          price_minor: price,
          enrollment_open: d.enrollment_open === true ? 1 : 0,
        };
        if (old) Object.assign(old, row);
        else e.commerce.push(row);
      }
      break;
    case "course.registration":
      actor(["student"]);
      return {
        enrolled: s.enrollments.some(
          (r) => r.course_id === d.id && r.student_id === u.id,
        ),
        requested:
          e.registrations?.some(
            (r) => r.course_id === d.id && r.student_id === u.id,
          ) ?? false,
        payment_available: true,
      } as T;
    case "course.requests":
      actor(["student", "admin"]);
      return {
        ...page(
          (e.registrations ?? [])
            .filter((r) => u.role === "admin" || r.student_id === u.id)
            .map((r) => {
              const c = s.courses.find((c) => c.id === r.course_id);
              const learner = s.users.find((v) => v.id === r.student_id);
              const pricing = e.commerce.find(
                (v) => v.course_id === r.course_id,
              );
              const enrolled = s.enrollments.some(
                (v) =>
                  v.student_id === r.student_id && v.course_id === r.course_id,
              );
              return {
                ...r,
                title: c?.title,
                student_name: learner?.name,
                price_minor: pricing?.price_minor,
                status: enrolled
                  ? "enrolled"
                  : !learner?.active
                    ? "pending_account"
                    : pricing?.price_minor
                      ? "payment_required"
                      : "awaiting_seat",
              };
            }),
          n,
        ),
        payment_available: true,
      } as T;
    case "course.apply":
    case "checkout":
      actor(["student"]);
      {
        const c = s.courses.find(
          (c) => c.id === d.course_id && c.status === "published",
        );
        const o = e.commerce.find(
          (o) => o.course_id === c?.id && o.enrollment_open,
        );
        if (!c || !o) throw new Error("التسجيل غير متاح.");
        if (
          s.enrollments.some(
            (v) => v.course_id === c.id && v.student_id === u.id,
          )
        ) {
          if (action === "course.apply") return { enrolled: true } as T;
          throw new Error("أنت مسجل بالفعل.");
        }
        const pending = e.orders.find(
          (o) =>
            o.course_id === c.id &&
            o.student_id === u.id &&
            o.status === "demo_pending",
        );
        if (pending) return { enrolled: false, order: pending } as T;
        if (
          s.enrollments.filter((v) => v.course_id === c.id).length +
            e.orders.filter(
              (o) => o.course_id === c.id && o.status === "demo_pending",
            ).length >=
          c.capacity
        )
          throw new Error("اكتملت المقاعد.");
        if (
          action === "course.apply" &&
          !e.registrations?.some(
            (r) => r.course_id === c.id && r.student_id === u.id,
          )
        ) {
          (e.registrations ??= []).push({
            course_id: c.id,
            student_id: u.id,
            created_at: now(),
          });
        }
        if (o.price_minor === 0) {
          s.enrollments.push({ id: uid(), course_id: c.id, student_id: u.id });
          await save();
          return { enrolled: true } as T;
        }
        const order: Order = {
          id: uid(),
          student_id: u.id,
          student_name: u.name,
          course_id: c.id,
          course_title: c.title,
          amount: o.price_minor,
          currency: "SAR",
          status: "demo_pending",
          checkout_url: null,
          expires_at: new Date(Date.now() + 1800000).toISOString(),
          created_at: now(),
          updated_at: now(),
          paid_at: null,
          failure_code: null,
        };
        e.orders.unshift(order);
        await save();
        return { enrolled: false, order } as T;
      }
    case "orders": {
      actor(["admin", "student"]);
      const search = value(d.search).toLocaleLowerCase();
      const status = value(d.status);
      const dates: Record<string, number> = {};
      for (const field of ["from", "to"]) {
        const input = value(d[field]);
        if (!input) continue;
        const parsed = new Date(`${input}T00:00:00+03:00`);
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(input) ||
          !Number.isFinite(parsed.getTime()) ||
          new Date(parsed.getTime() + 10800000).toISOString().slice(0, 10) !==
            input
        )
          throw new Error("تاريخ تصفية المدفوعات غير صحيح.");
        dates[field] = parsed.getTime();
      }
      if (
        dates.from !== undefined &&
        dates.to !== undefined &&
        dates.from > dates.to
      )
        throw new Error("تاريخ البداية يجب أن يسبق تاريخ النهاية.");
      const orders = e.orders
        .filter(
          (o) =>
            (u.role === "admin" || o.student_id === u.id) &&
            (!status || o.status === status) &&
            (!search ||
              [o.id, o.student_name, o.course_title].some((v) =>
                v?.toLocaleLowerCase().includes(search),
              )) &&
            (dates.from === undefined ||
              Date.parse(o.created_at) >= dates.from) &&
            (dates.to === undefined ||
              Date.parse(o.created_at) < dates.to + 86400000),
        )
        .sort(
          (a, b) =>
            b.created_at.localeCompare(a.created_at) ||
            a.id.localeCompare(b.id),
        );
      return {
        ...page(orders, n),
        summary: {
          paid: orders
            .filter((o) =>
              ["paid", "paid_review", "demo_paid"].includes(o.status),
            )
            .reduce((sum, o) => sum + o.amount, 0),
          pending: orders
            .filter((o) =>
              ["creating", "pending", "uncertain", "demo_pending"].includes(
                o.status,
              ),
            )
            .reduce((sum, o) => sum + o.amount, 0),
          refunded: orders
            .filter((o) => o.status === "refunded")
            .reduce((sum, o) => sum + o.amount, 0),
          review: orders.filter((o) =>
            ["paid_review", "uncertain"].includes(o.status),
          ).length,
        },
      } as T;
    }
    case "preview.payment.confirm":
    case "payment.refresh": {
      const o = e.orders.find(
        (o) =>
          o.id === d.id &&
          (u.role === "admin" ||
            (u.role === "student" && o.student_id === u.id)),
      );
      if (!o) throw new Error("الطلب غير متاح.");
      if (action === "payment.refresh")
        throw new Error("هذه محاكاة محلية ولا يمكن الاستعلام من ميسر.");
      if (o.status === "demo_pending") {
        const c = s.courses.find((c) => c.id === o.course_id)!;
        if (
          s.enrollments.filter((v) => v.course_id === c.id).length >= c.capacity
        )
          throw new Error("اكتمل عدد المقاعد.");
        if (
          !s.enrollments.some(
            (v) => v.course_id === o.course_id && v.student_id === o.student_id,
          )
        )
          s.enrollments.push({
            id: uid(),
            course_id: o.course_id,
            student_id: o.student_id,
          });
        o.status = "demo_paid";
        o.paid_at = now();
      }
      break;
    }
    case "bags":
      course(u, value(d.course_id));
      return {
        items: e.bags
          .filter((b) => b.course_id === d.course_id)
          .map((b) => ({
            ...b,
            items: b.items.map((i) => ({
              ...i,
              ...s.files.find((f) => f.id === i.file_id),
              id: i.id,
            })),
          })),
      } as T;
    case "bag.save":
      course(u, value(d.course_id), true);
      {
        if (value(d.title).length < 2 || !value(d.version))
          throw new Error("أكمل اسم الحقيبة والإصدار.");
        const old = e.bags.find(
          (b) => b.id === d.id && b.course_id === d.course_id,
        );
        const row = {
          title: value(d.title),
          description: value(d.description),
          version: value(d.version),
          updated_at: now(),
        };
        if (d.id && !old) throw new Error("الحقيبة غير موجودة.");
        if (old) Object.assign(old, row);
        else {
          const bag = {
            id: uid(),
            course_id: value(d.course_id),
            ...row,
            items: [],
          };
          e.bags.unshift(bag);
          await save();
          return { id: bag.id } as T;
        }
      }
      break;
    case "bag.item.save":
    case "bag.item.remove": {
      const bag = e.bags.find((b) => b.id === d.bag_id);
      if (!bag) throw new Error("الحقيبة غير موجودة.");
      course(u, bag.course_id, true);
      if (action === "bag.item.remove") {
        bag.items = bag.items.filter((i) => i.file_id !== d.file_id);
        break;
      }
      const file = s.files.find(
        (f) =>
          f.id === d.file_id &&
          f.course_id === bag.course_id &&
          f.purpose === "resource",
      );
      if (!file) throw new Error("الملف غير متاح لهذه المادة.");
      if (bag.items.some((i) => i.file_id === file.id))
        throw new Error("الملف مضاف مسبقًا.");
      bag.items.push({
        id: uid(),
        bag_id: bag.id,
        file_id: file.id,
        label: value(d.label),
        sort_order: Number(d.sort_order) || 0,
        name: file.name,
        mime: file.mime,
        bytes: file.bytes,
      });
      break;
    }
    case "guardian.preference":
    case "guardian.preference.save": {
      actor(["admin", "guardian"]);
      const sid = value(d.student_id);
      if (!canStudent(u, sid, true))
        throw new Error("الطالب غير مرتبط بالحساب.");
      if (action === "guardian.preference")
        return (e.preferences[sid] ?? {
          sms_enabled: false,
          consent_at: null,
        }) as T;
      if (d.sms_enabled === true && d.consent !== true)
        throw new Error("أكّد موافقة التجربة.");
      e.preferences[sid] = {
        sms_enabled: d.sms_enabled === true,
        consent_at: d.sms_enabled === true ? now() : null,
      };
      if (d.sms_enabled !== true)
        e.notifications
          .filter((v) => v.student_id === sid && v.status === "blocked")
          .forEach((v) => (v.status = "cancelled"));
      break;
    }
    case "notifications":
      actor(["admin", "guardian"]);
      return page(
        e.notifications.filter(
          (v) => u.role === "admin" || canStudent(u, v.student_id, true),
        ),
        n,
      ) as T;
    case "notification.retry":
      requireAdmin();
      throw new Error(
        "إرسال الرسائل يتطلب ربط مزود SMS في النسخة الأساسية. لا تُرسل رسائل من العرض.",
      );
    case "videos":
      actor(["admin", "instructor"]);
      course(u, value(d.course_id), true);
      return page([], n) as T;
    case "students.list":
      actor(["admin", "instructor", "guardian"]);
      return page(
        s.users
          .filter(
            (v) =>
              v.role === "student" &&
              canStudent(u, v.id) &&
              (!value(d.search) ||
                (v.name + " " + v.email).includes(value(d.search))),
          )
          .map((v) => ({
            ...v,
            city: s.profiles[v.id]?.city,
            courses_count: s.enrollments.filter((e) => e.student_id === v.id)
              .length,
          })),
        n,
      ) as T;
    case "users.list":
      requireAdmin();
      return {
        ...page(
          s.users.filter(
            (v) =>
              (!d.role || v.role === d.role) &&
              (!d.id || v.id === d.id) &&
              (!value(d.search) ||
                (v.name + " " + v.email).includes(value(d.search))),
          ),
          n,
        ),
        role_counts: Object.fromEntries(
          ["admin", "instructor", "student", "guardian"].map((r) => [
            r,
            s.users.filter((u) => u.role === r).length,
          ]),
        ),
      } as T;
    case "lesson": {
      const l = s.lessons.find(
        (l) => l.id === d.id && canCourse(u, l.course_id),
      );
      if (!l) throw new Error("الدرس غير متاح.");
      return { lesson: l } as T;
    }
  }
  await save();
  return { ok: true } as T;
}
export async function previewAbsences(
  classId: string,
  records: { student_id: string; status: string }[],
) {
  const e = await extras();
  const s = dbState();
  for (const r of records) {
    const old = e.notifications.find(
      (n) => n.student_id === r.student_id && n.class_id === classId,
    );
    if (r.status !== "absent") {
      if (old && old.status === "blocked") old.status = "cancelled";
      continue;
    }
    if (!e.preferences[r.student_id]?.sms_enabled) continue;
    const row = {
      id: old?.id ?? uid(),
      student_id: r.student_id,
      class_id: classId,
      status: "blocked",
      attempts: 0,
      provider_id: null,
      error_code: "preview_no_sms",
      created_at: old?.created_at ?? now(),
      updated_at: now(),
      recipient:
        "••••" + (s.profiles[r.student_id]?.guardian_phone ?? "0000").slice(-4),
      student_name: s.users.find((u) => u.id === r.student_id)?.name ?? "",
      class_title: s.classes.find((c) => c.id === classId)?.title ?? "",
    };
    if (old) Object.assign(old, row);
    else e.notifications.unshift(row);
  }
}
