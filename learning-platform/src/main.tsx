import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import App from "./App";
import "./styles.css";

class ApplicationBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="application-error" dir="rtl" role="alert">
          <img
            src={`${import.meta.env.BASE_URL}brand/logo.webp`}
            alt="مركز تفاصيل للتدريب"
          />
          <h1>تعذّر عرض الصفحة</h1>
          <p>
            أعد تحميل الصفحة للمحاولة مجددًا. إذا استمرت المشكلة تواصل مع إدارة
            المركز.
          </p>
          <button className="btn btn-primary" onClick={() => location.reload()}>
            إعادة تحميل الصفحة
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ApplicationBoundary>
      <App />
    </ApplicationBoundary>
  </React.StrictMode>,
);
