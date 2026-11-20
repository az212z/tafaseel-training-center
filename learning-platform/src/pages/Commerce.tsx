import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  ArrowSquareOut,
  ShoppingCart,
  ArrowsClockwise,
  DownloadSimple,
} from "@phosphor-icons/react";
import { api } from "../api";
import { asset, isStaticPreview } from "../environment";
import { useApp, date, ar, downloadCsv } from "../context";
import type { CatalogCourse, Order, OrderLedger, PageResult } from "../types";
import {
  PageHead,
  Panel,
  Button,
  Modal,
  Form,
  Field,
  Empty,
  Badge,
  Search,
  Table,
} from "../components/ui";
import {
  useRemote,
  RemoteState,
  Pagination,
  money,
} from "../components/remote";
import { CourseSelect } from "../components/forms";
interface RegistrationRequest {
  course_id: string;
  title: string;
  created_at: string;
  price_minor: number | null;
  status:
    | "enrolled"
    | "pending_account"
    | "unavailable"
    | "payment_required"
    | "awaiting_seat";
  student_id?: string;
  student_name?: string;
}
const requestStatus = {
  enrolled: "تم التسجيل",
  pending_account: "بانتظار تفعيل الحساب",
  unavailable: "التسجيل مغلق",
  payment_required: "بانتظار السداد",
  awaiting_seat: "بانتظار توفر مقعد",
};
export function Registrations() {
  const { user } = useApp();
  const [page, setPage] = useState(1);
  const remote = useRemote<
    PageResult<RegistrationRequest> & { payment_available: boolean }
  >("course.requests", { page: String(page) });
  const admin = user.role === "admin";
  return (
    <>
      <PageHead title="طلبات التسجيل">
        {admin ? (
          <Link to="/catalog" className="btn btn-secondary">
            إعداد التسجيل والرسوم
          </Link>
        ) : (
          <Link to="/programs" className="btn btn-secondary">
            استعراض الدورات
          </Link>
        )}
      </PageHead>
      <RemoteState {...remote} />
      {!!remote.result?.items.length && (
        <Panel>
          <div className="course-request-list">
            {remote.result.items.map((item) => (
              <article key={item.course_id + (item.student_id || "")}>
                <div>
                  <strong>{item.title}</strong>
                  {admin && item.student_name && (
                    <Link
                      to={"/students/" + item.student_id}
                      className="text-link"
                    >
                      {item.student_name}
                    </Link>
                  )}
                  <small>
                    {date(item.created_at)}
                    {item.price_minor
                      ? " · " + money(Number(item.price_minor))
                      : ""}
                  </small>
                </div>
                <Badge tone={item.status === "enrolled" ? "green" : "amber"}>
                  {requestStatus[item.status]}
                </Badge>
                {admin ? (
                  <Link
                    className="text-link"
                    to={
                      item.status === "pending_account"
                        ? "/users?account=" + item.student_id
                        : "/courses/" + item.course_id
                    }
                  >
                    {item.status === "pending_account"
                      ? "مراجعة الحساب"
                      : "عرض الدورة"}
                  </Link>
                ) : item.status === "enrolled" ? (
                  <Link
                    to={"/courses/" + item.course_id}
                    className="btn btn-primary"
                  >
                    فتح الدورة
                  </Link>
                ) : item.status === "payment_required" ? (
                  <Link
                    className="text-link"
                    to={
                      remote.result?.payment_available
                        ? "/catalog?course=" + item.course_id
                        : "/contact"
                    }
                  >
                    {remote.result?.payment_available
                      ? "إكمال التسجيل"
                      : "التواصل بشأن السداد"}
                  </Link>
                ) : item.status === "awaiting_seat" ? (
                  <Link
                    className="text-link"
                    to={"/catalog?course=" + item.course_id}
                  >
                    التحقق من المقاعد
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </Panel>
      )}
      {!remote.loading && !remote.error && !remote.result?.items.length && (
        <Empty title="لا توجد طلبات تسجيل" />
      )}
      <Pagination
        page={page}
        total={remote.result?.total ?? 0}
        onPage={setPage}
      />
    </>
  );
}
export function Catalog() {
  const { user, data, notify, refresh } = useApp();
  const navigate = useNavigate();
  const [catalogParams, setCatalogParams] = useSearchParams();
  const requestedCourse = catalogParams.get("course") || "";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState("");
  const [selected, setSelected] = useState<CatalogCourse | null>(null);
  const remote = useRemote<PageResult<CatalogCourse>>("catalog", {
    search,
    course_id: requestedCourse,
    page: String(page),
  });
  useEffect(() => {
    const course = remote.result?.items.find((c) => c.id === requestedCourse);
    if (course) setSelected(course);
  }, [remote.result, requestedCourse]);
  return (
    <>
      <PageHead
        title="التسجيل في الدورات"
        subtitle="اختر الدورة المناسبة، وراجع تفاصيلها قبل تأكيد التسجيل."
      >
        {user.role === "admin" && (
          <Button onClick={() => setEdit(true)}>
            <Plus size={18} />
            إعداد رسوم وتسجيل دورة
          </Button>
        )}
      </PageHead>
      {isStaticPreview && (
        <div className="alert">
          تجربة محلية للدفع والتسجيل ببيانات وهمية. لا تُخصم مبالغ ولا تُجمع
          بيانات بطاقات.
        </div>
      )}
      <div className="filter-bar">
        {requestedCourse && (
          <Button
            variant="secondary"
            onClick={() => {
              setCatalogParams({});
              setSelected(null);
            }}
          >
            عرض جميع الدورات المفتوحة
          </Button>
        )}
        <Search
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="ابحث عن دورة متاحة للتسجيل…"
        />
      </div>
      <RemoteState {...remote} />
      <div className="course-grid all-courses">
        {remote.result?.items.map((c) => (
          <Panel key={c.id} className="catalog-card">
            <img src={asset(c.image)} alt="" loading="lazy" />
            <Badge tone="green">{c.category}</Badge>
            <h2>{c.title}</h2>
            <p className="catalog-description">{c.description}</p>
            <p className="muted">
              {c.instructor_name || "يحدد المدرب لاحقًا"} • {c.duration} ساعة •{" "}
              {Math.max(0, c.capacity - c.students_count)} مقعد قبل الحجوزات
              المؤقتة
            </p>
            <div className="row-between">
              <strong className="catalog-price">
                {c.price_minor ? money(c.price_minor) : "مجانية"}
              </strong>
              <Button variant="secondary" onClick={() => setSelected(c)}>
                تفاصيل التسجيل
              </Button>
            </div>
          </Panel>
        ))}
      </div>
      {!remote.loading && !remote.error && !remote.result?.items.length && (
        <Empty
          title="لا توجد دورات مفتوحة للتسجيل"
          text={
            user.role === "admin"
              ? "انشر الدورة ثم حدد سعرها وافتح تسجيلها من الزر أعلاه."
              : "ستظهر الدورات هنا عند فتح التسجيل من المركز."
          }
        />
      )}
      <Pagination
        page={page}
        total={remote.result?.total ?? 0}
        onPage={setPage}
      />
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <p>{selected.description}</p>
          <dl className="details-list">
            <div>
              <dt>رسوم التسجيل</dt>
              <dd>
                {selected.price_minor ? money(selected.price_minor) : "مجانية"}
              </dd>
            </div>
            <div>
              <dt>المدة</dt>
              <dd>{selected.duration} ساعة</dd>
            </div>
          </dl>

          {user.role === "student" ? (
            <Button
              disabled={
                !!busy ||
                data.enrollments.some(
                  (e) =>
                    e.course_id === selected.id && e.student_id === user.id,
                )
              }
              onClick={async () => {
                setBusy(selected.id);
                try {
                  const r = await api<{ enrolled: boolean; order?: Order }>(
                    "course.apply",
                    { course_id: selected.id },
                  );
                  if (r.enrolled) {
                    await refresh();
                    notify("تم التسجيل في الدورة.");
                    navigate("/courses/" + selected.id);
                  } else if (r.order?.checkout_url) {
                    location.assign(r.order.checkout_url);
                  } else if (r.order) {
                    navigate("/payments?order=" + r.order.id);
                  } else {
                    navigate("/registrations");
                  }
                } catch (e) {
                  notify((e as Error).message, "error");
                } finally {
                  setBusy("");
                }
              }}
            >
              <ShoppingCart size={18} />
              {data.enrollments.some(
                (e) => e.course_id === selected.id && e.student_id === user.id,
              )
                ? "مسجل بالفعل"
                : busy
                  ? "جارٍ تجهيز الطلب…"
                  : selected.price_minor
                    ? isStaticPreview
                      ? "إنشاء طلب دفع تجريبي"
                      : "المتابعة إلى الدفع"
                    : "تأكيد التسجيل المجاني"}
            </Button>
          ) : (
            <div className="alert">
              يتم التسجيل والدفع من حساب الطالب بعد تفعيله من الإدارة.
            </div>
          )}
        </Modal>
      )}
      {edit && (
        <Modal title="رسوم الدورة والتسجيل" onClose={() => setEdit(false)}>
          <Form
            onCancel={() => setEdit(false)}
            onSubmit={async (d) => {
              await api("commerce.save", {
                course_id: d.course_id,
                price_minor: Math.round(Number(d.price) * 100),
                enrollment_open: d.enrollment_open === "on",
              });
              await refresh();
              remote.reload();
              notify("تم تحديث إعدادات التسجيل.");
              setEdit(false);
            }}
          >
            <Field label="الدورة">
              <CourseSelect />
            </Field>
            <Field
              label="الرسوم النهائية بالريال"
              hint="صفر للدورة المجانية. أدخل السعر النهائي الواجب تحصيله."
            >
              <input
                name="price"
                type="number"
                min={0}
                step="0.01"
                max={1000000}
                required
                defaultValue={0}
              />
            </Field>
            <label className="check-label">
              <input name="enrollment_open" type="checkbox" />
              فتح التسجيل في كتالوج الدورات المنشورة
            </label>
            <p className="muted">
              للتعديل: اختر الدورة وأدخل السعر والحالة المطلوبين. لا يتغير مبلغ
              طلب دفع قائم.
            </p>
          </Form>
        </Modal>
      )}
    </>
  );
}
const statusNames: Record<string, string> = {
  creating: "جارٍ الإنشاء",
  pending: "بانتظار الدفع",
  paid: "مدفوع ومسجل",
  paid_review: "مدفوع — يحتاج مراجعة التسجيل",
  uncertain: "غير مؤكد — يحتاج مراجعة",
  failed: "فشل الطلب",
  expired: "انتهت المهلة",
  canceled: "ملغي",
  refunded: "مسترد — راجع صلاحية التسجيل",
  voided: "ملغي",
  demo_pending: "محاكاة تنتظر التأكيد",
  demo_paid: "محاكاة دفع مكتملة",
};
export function Payments() {
  const { user, notify, refresh } = useApp();
  const admin = user.role === "admin";
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState("");
  const [recover, setRecover] = useState<Order | null>(null);
  const [params] = useSearchParams();
  const orderId = params.get("order");
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    from: "",
    to: "",
  });
  const remote = useRemote<OrderLedger>("orders", {
    ...filters,
    page: String(page),
  });
  const ledger = !remote.loading && !remote.error ? remote.result : null;
  const awaitingPayment = remote.result?.items.some((order) =>
    ["creating", "pending", "uncertain"].includes(order.status),
  );
  const reload = remote.reload;
  useEffect(() => {
    if (!awaitingPayment || isStaticPreview) return;
    const reloadVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    const timer = window.setInterval(reloadVisible, 20000);
    document.addEventListener("visibilitychange", reloadVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", reloadVisible);
    };
  }, [awaitingPayment, reload]);
  function filter(key: keyof typeof filters, value: string) {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  }
  useEffect(() => {
    if (orderId && !isStaticPreview)
      api("payment.refresh", { id: orderId })
        .then(() => {
          remote.reload();
          return refresh();
        })
        .catch((e) => notify(e.message, "error"));
  }, [orderId]);
  const recheck = async (o: Order, simulate = false) => {
    setBusy(o.id);
    try {
      await api(simulate ? "preview.payment.confirm" : "payment.refresh", {
        id: o.id,
      });
      remote.reload();
      await refresh();
      notify(
        simulate
          ? "تم تأكيد محاكاة الدفع والتسجيل محليًا."
          : user.role === "admin"
            ? "تم التحقق من حالة الطلب لدى المزود."
            : "تم تحديث حالة طلبك.",
      );
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      <PageHead
        title={admin ? "المدفوعات" : "مدفوعاتي"}
        subtitle={
          admin
            ? "سجل طلبات الدفع لجميع الطلاب."
            : "طلبات دفع دوراتك وحالة كل طلب."
        }
      >
        {user.role === "admin" && (
          <Button
            variant="secondary"
            disabled={!ledger?.items.length}
            onClick={() =>
              downloadCsv(
                "tafaseel-payments-page.csv",
                [
                  "معرف الطلب",
                  "الطالب",
                  "الدورة",
                  "المبلغ بالريال",
                  "الحالة",
                  "تاريخ الطلب",
                  "تاريخ الدفع",
                ],
                (ledger?.items ?? []).map((o) => [
                  o.id,
                  o.student_name,
                  o.course_title,
                  (o.amount / 100).toFixed(2),
                  statusNames[o.status] || o.status,
                  o.created_at,
                  o.paid_at,
                ]),
              )
            }
          >
            <DownloadSimple size={18} />
            تصدير الصفحة الحالية
          </Button>
        )}
        <Button variant="secondary" onClick={remote.reload}>
          <ArrowsClockwise size={18} />
          تحديث السجل
        </Button>
      </PageHead>
      {isStaticPreview && (
        <div className="alert">
          محاكاة فقط: لا توجد عمليات دفع حقيقية أو خصم مبالغ في نسخة GitHub.
        </div>
      )}
      {admin && (
        <Panel
          title="تصفية سجل المدفوعات"
          description="الفترة حسب تاريخ إنشاء الطلب بتوقيت الرياض. الملخص يشمل جميع النتائج المطابقة عبر الصفحات."
        >
          <div className="form-grid">
            <Field label="الطالب أو الدورة أو رقم الطلب">
              <input
                type="search"
                value={filters.search}
                maxLength={100}
                onChange={(e) => filter("search", e.target.value)}
              />
            </Field>
            <Field label="حالة الدفع">
              <select
                value={filters.status}
                onChange={(e) => filter("status", e.target.value)}
              >
                <option value="">جميع الحالات</option>
                {Object.entries(statusNames)
                  .filter(
                    ([key]) => isStaticPreview || !key.startsWith("demo_"),
                  )
                  .map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="من تاريخ">
              <input
                type="date"
                value={filters.from}
                onChange={(e) => filter("from", e.target.value)}
              />
            </Field>
            <Field label="إلى تاريخ">
              <input
                type="date"
                value={filters.to}
                onChange={(e) => filter("to", e.target.value)}
              />
            </Field>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setFilters({ search: "", status: "", from: "", to: "" });
              setPage(1);
            }}
          >
            مسح التصفية
          </Button>
        </Panel>
      )}
      <RemoteState {...remote} />
      {admin && ledger && (
        <>
          <div className="stats-grid">
            {[
              ["المدفوع المؤكد حاليًا", money(ledger.summary.paid)],
              ["بانتظار الدفع أو التحقق", money(ledger.summary.pending)],
              ["طلبات بحالة مسترد", money(ledger.summary.refunded)],
              ["طلبات تحتاج مراجعة", ar(ledger.summary.review)],
            ].map(([label, value]) => (
              <div className="stat-card" key={label}>
                <div className="stat-title">{label}</div>
                <strong className="finance-value">{value}</strong>
              </div>
            ))}
          </div>
          <p className="muted">
            المبالغ حسب الحالة الحالية للطلبات. المدفوع يشمل الطلبات المدفوعة
            التي تنتظر مراجعة التسجيل، ويستبعد الطلبات المستردة. هذا سجل متابعة
            للمنصة؛ لا يمثل تسوية حساب بوابة الدفع.
          </p>
        </>
      )}
      <Panel>
        {ledger?.items.length ? (
          <Table
            headers={[
              "الطلب",
              admin ? "الطالب والدورة" : "الدورة",
              "المبلغ",
              "الحالة",
              "تاريخ الطلب",
              "",
            ]}
          >
            {ledger.items.map((o) => (
              <tr key={o.id}>
                <td className="mono-cell">{o.id.slice(0, 10)}</td>
                <td>
                  <strong>{o.course_title}</strong>
                  {admin && (
                    <small className="block muted">{o.student_name}</small>
                  )}
                </td>
                <td>{money(o.amount)}</td>
                <td>
                  <Badge
                    tone={
                      ["paid", "demo_paid"].includes(o.status)
                        ? "green"
                        : o.status === "failed"
                          ? "red"
                          : "amber"
                    }
                  >
                    {statusNames[o.status] || o.status}
                  </Badge>
                  {o.failure_code && (
                    <small className="block muted">
                      تحتاج الحالة متابعة من إدارة المركز.
                    </small>
                  )}
                </td>
                <td>{date(o.created_at)}</td>
                <td>
                  <div className="row-actions">
                    {o.checkout_url && o.status === "pending" && (
                      <a
                        className="text-link"
                        href={o.checkout_url}
                        rel="noreferrer"
                      >
                        استكمال الدفع
                        <ArrowSquareOut size={16} />
                      </a>
                    )}
                    {isStaticPreview && o.status === "demo_pending" ? (
                      <Button
                        disabled={!!busy}
                        onClick={() => recheck(o, true)}
                      >
                        تأكيد محاكاة الدفع
                      </Button>
                    ) : (
                      !isStaticPreview && (
                        <Button
                          variant="secondary"
                          disabled={
                            !!busy ||
                            (!o.checkout_url &&
                              ["uncertain", "creating"].includes(o.status))
                          }
                          onClick={() => recheck(o)}
                        >
                          تحقق من الدفع
                        </Button>
                      )
                    )}
                    {user.role === "admin" &&
                      !isStaticPreview &&
                      ["creating", "uncertain"].includes(o.status) && (
                        <Button
                          variant="secondary"
                          onClick={() => setRecover(o)}
                        >
                          مراجعة رقم الفاتورة
                        </Button>
                      )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          !remote.loading &&
          !remote.error && (
            <Empty
              title="لا توجد طلبات دفع"
              text={
                admin
                  ? "لا توجد طلبات مطابقة للتصفية الحالية."
                  : "عندما تسجّل في دورة مدفوعة، يظهر طلبك هنا."
              }
            />
          )
        )}
      </Panel>
      <Pagination page={page} total={ledger?.total ?? 0} onPage={setPage} />
      <p className="muted">
        {user.role === "admin"
          ? "تأكيد التسجيل المدفوع يعتمد على استعلام الخادم من ميسر. إشعار النجاح في المتصفح وحده لا يثبت الدفع. الاسترداد وتنظيم صلاحية الوصول بعده يراجعان من الإدارة."
          : "يمكنك متابعة الدفع والتسجيل من حالة الطلب هنا. إذا تأخر التأكيد أو احتجت استردادًا، تواصل مع الإدارة من المساعدة والدعم."}
      </p>
      {recover && (
        <Modal title="ربط فاتورة طلب غير مؤكد" onClose={() => setRecover(null)}>
          <Form
            onSubmit={async (d) => {
              await api("payment.recover", {
                id: recover.id,
                provider_id: d.provider_id,
              });
              remote.reload();
              await refresh();
              setRecover(null);
              notify("تم التحقق من الفاتورة وربط حالتها.");
            }}
          >
            <p>
              راجع لوحة ميسر وحدد الفاتورة التي ينتهي وصفها بمعرّف الطلب{" "}
              {recover.id}. يتحقق الخادم من معرّف الطلب والمبلغ قبل الربط.
            </p>
            <Field label="معرّف فاتورة ميسر">
              <input name="provider_id" required dir="ltr" />
            </Field>
          </Form>
        </Modal>
      )}
    </>
  );
}
