const zoomVersion = "6.10.0";
const zoomOrigin = "https://source.zoom.us";
const vendorPath = `/${zoomVersion}/lib/vendor`;
const zoomScripts = [
  [
    `${vendorPath}/react.min.js`,
    "DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z",
  ],
  [
    `${vendorPath}/react-dom.min.js`,
    "gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1",
  ],
  [
    `${vendorPath}/redux.min.js`,
    "rG4GKxh/ojcHqPD0zvAWGoTbdtGOR9jTH1oeTQ5pnRNDgts3oclAi9EI63TxXfMb",
  ],
  [
    `${vendorPath}/redux-thunk.min.js`,
    "W4l2TiN6a5ehGctYQAtP/Y30Inm1F7yySVQXePn9LgMxmr6vtKJdm/R3wgU2+yuI",
  ],
  [
    `${vendorPath}/react-redux.min.js`,
    "SolceUhVnIawRDbgCOJYlDOxNY288CfgrFwenvmpC4S9ucmE/Sd+rBLIKeoI/3u1",
  ],
  [
    `${vendorPath}/lodash.min.js`,
    "jC7q3III065vSuJ5pJ5KABQTNoQYM3PkN9JDtaoCro/okpUkD6IKqkYr3D8hXxBp",
  ],
  [
    `/zoom-meeting-${zoomVersion}.min.js`,
    "1TA5KeL1/rKHEvx0tJjN14hplm9AWAJsIMEeUjlxzHwx8JXQrNPY5GHzIhR3P3RA",
  ],
];

const entry = document.getElementById("room-entry");
const status = document.getElementById("room-status");
const back = document.getElementById("room-back");
const retry = document.getElementById("room-retry");
const root = document.getElementById("zmmtg-root");

retry.addEventListener("click", () => window.location.reload());

async function request(action, options) {
  const response = await fetch(`./api/index.php?action=${action}`, {
    cache: "no-store",
    ...options,
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "تعذّر الاتصال بتفاصيل. حاول مجددًا.");
  }
  return result;
}

async function loadZoom() {
  for (const [path, checksum] of zoomScripts) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = zoomOrigin + path;
      script.integrity = "sha384-" + checksum;
      script.crossOrigin = "anonymous";
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener(
        "error",
        () =>
          reject(
            new Error("تعذّر تحميل مشغل الحصة. تحقق من اتصالك وحاول مجددًا."),
          ),
        { once: true },
      );
      document.head.append(script);
    });
  }
  window.ZoomMtg.setZoomJSLib(`${zoomOrigin}/${zoomVersion}/lib`, "/av");
  window.ZoomMtg.preLoadWasm();
  window.ZoomMtg.prepareWebSDK();
}

async function joinRoom() {
  const query = new URLSearchParams(window.location.search);
  const classId = query.get("class");
  if (!classId || !/^[a-zA-Z0-9_-]{1,40}$/.test(classId)) {
    throw new Error("اختر حصة من الجدول.");
  }

  const session = await request("session");
  if (!session.user) {
    back.href = "./login";
    back.textContent = "تسجيل الدخول";
    throw new Error("سجّل دخولك ثم افتح الحصة من الجدول.");
  }
  const { title, course_id, ...joinOptions } = await request("zoom.embed", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": session.csrf,
    },
    body: JSON.stringify({
      class_id: classId,
      host: query.get("host") === "1",
    }),
  });
  document.getElementById("room-title").textContent = title;
  const schedule = new URL("./schedule", window.location.href);
  schedule.searchParams.set("course", course_id);
  back.href = schedule.href;
  status.textContent = "جارٍ الاتصال بزوم…";
  await loadZoom();
  await new Promise((resolve, reject) => {
    const failed = () =>
      reject(new Error("تعذّر الاتصال باللقاء. حاول مجددًا أو تواصل مع المركز."));
    root.hidden = false;
    window.ZoomMtg.init({
      leaveUrl: schedule.href,
      leaveOnPageUnload: true,
      disableInvite: true,
      isSupportAV: true,
      isShowJoiningErrorDialog: false,
      success: () => {
        entry.hidden = true;
        window.ZoomMtg.join({
          ...joinOptions,
          success: resolve,
          error: failed,
        });
      },
      error: failed,
    });
  });
}

joinRoom().catch((error) => {
  root.hidden = true;
  entry.hidden = false;
  status.textContent = error.message || "تعذّر فتح الحصة.";
  retry.hidden = false;
});
