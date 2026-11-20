import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, Envelope, ShieldCheck } from "@phosphor-icons/react";
import { api } from "../api";
import { asset, isStaticPreview } from "../environment";
import { Form, Field, Button } from "../components/ui";
import "../account-activation.css";

type Invitation = {
  name: string;
  role: string;
  expires_at: string;
  registration?: boolean;
};

export default function AccountActivation() {
  const [token] = useState(() => location.hash.slice(1));
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    document.title = "توثيق الحساب | تفاصيل";
    document
      .querySelector('meta[name="robots"]')
      ?.setAttribute("content", "noindex,nofollow");
    let active = true;
    if (isStaticPreview) {
      setError("تُفعّل الدعوات من الرابط المرسل من موقع تفاصيل الرئيسي.");
      return;
    }
    api<{ user: unknown }>("session")
      .then(async (session) => {
        const result = await api<Invitation>("account.invite.status", {
          token,
        });
        if (active) {
          setInvitation(result);
          setSignedIn(!!session.user);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [token]);
  return (
    <main className="activation-page">
      <Link to="/" className="activation-brand">
        <img src={asset("/brand/logo.webp")} alt="مركز تفاصيل للتدريب" />
      </Link>
      <section className="activation-card">
        <span className="activation-symbol">
          {done ? <CheckCircle size={36} /> : <Envelope size={34} />}
        </span>
        <p className="eyebrow">أهلًا بك في تفاصيل</p>
        <h1>{done ? "اكتمل توثيق حسابك" : "خطوتك الأولى إلى مساحتك"}</h1>
        {done ? (
          <>
            <p>
              وُثّق بريدك الإلكتروني وحُفظت كلمة مرورك. يمكنك الآن تسجيل الدخول إلى
              المنصة ومتابعة رحلتك معنا.
            </p>
            <Link className="btn btn-primary" to="/login">
              تسجيل الدخول إلى المنصة
            </Link>
          </>
        ) : error ? (
          <>
            <div className="alert alert-error" role="alert">
              {error}
            </div>
            <Link className="btn btn-secondary" to="/contact">
              التواصل مع إدارة تفاصيل
            </Link>
          </>
        ) : !invitation ? (
          <p role="status">جارٍ التحقق من دعوتك…</p>
        ) : (
          <>
            <p>
              {invitation.registration
                ? `مرحبًا ${invitation.name}، أكّد بريدك للمتابعة إلى حسابك.`
                : `مرحبًا ${invitation.name}، أكمل توثيق بريدك واختر كلمة مرور حسابك.`}
            </p>
            {signedIn ? (
              <div className="alert">
                <p>
                  أنت مسجّل الدخول بحساب آخر. سجّل الخروج للمتابعة إلى الحساب
                  المدعو.
                </p>
                <Button
                  onClick={async () => {
                    try {
                      await api("logout", {});
                      setSignedIn(false);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  تسجيل الخروج والمتابعة
                </Button>
              </div>
            ) : invitation.registration ? (
              <Form
                submitLabel="تأكيد البريد والمتابعة"
                onSubmit={async () => {
                  const result = await api<{ next: string }>(
                    "account.registration.verify",
                    { token },
                  );
                  location.assign(result.next);
                }}
              >
                <span />
              </Form>
            ) : (
              <Form
                submitLabel="توثيق الحساب وإكمال التسجيل"
                onSubmit={async (data) => {
                  await api("account.invite.accept", {
                    token,
                    ...data,
                    consent: data.consent === "on",
                  });
                  setDone(true);
                }}
              >
                <Field
                  label="كلمة المرور الجديدة"
                  hint="١٢ حرفًا على الأقل. اختر كلمة مرور خاصة لا تستخدمها في حساب آخر."
                >
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={72}
                  />
                </Field>
                <Field label="تأكيد كلمة المرور">
                  <input
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={72}
                  />
                </Field>
                <label className="check-label">
                  <input type="checkbox" name="consent" required /> أوافق على{" "}
                  <Link to="/terms" target="_blank" rel="noreferrer">
                    شروط الاستخدام
                  </Link>{" "}
                  و
                  <Link to="/privacy" target="_blank" rel="noreferrer">
                    سياسة الخصوصية
                  </Link>
                  .
                </label>
                <p className="activation-note">
                  <ShieldCheck size={18} /> رابطك شخصي ويُستخدم مرة واحدة. لا
                  تشاركه مع الآخرين.
                </p>
              </Form>
            )}
          </>
        )}
      </section>
      <p className="activation-footer">
        مركز تفاصيل للتدريب • اهتمام بالتعلّم، عناية بالتفاصيل.
      </p>
    </main>
  );
}
