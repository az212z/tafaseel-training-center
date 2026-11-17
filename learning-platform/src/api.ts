export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
let csrf = "";
export function setCsrf(value: string) {
  csrf = value;
}
export async function api<T = Record<string, unknown>>(
  action: string,
  body?: object | FormData,
): Promise<T> {
  const url = new URL("/api/index.php", location.origin);
  url.searchParams.set("action", action);
  const multipart = body instanceof FormData;
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    headers: body
      ? {
          "X-CSRF-Token": csrf,
          ...(!multipart ? { "Content-Type": "application/json" } : {}),
        }
      : {},
    body: body ? (multipart ? body : JSON.stringify(body)) : undefined,
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("تعذّر الاتصال بالخادم. تحقق من الاتصال ثم حاول مجددًا.");
  }
  if (!response.ok) {
    if (response.status === 401 && action !== "login" && action !== "login.mfa")
      window.dispatchEvent(new Event("session-expired"));
    throw new ApiRequestError(
      result.error || "تعذّر إتمام العملية.",
      response.status,
    );
  }
  if (result.csrf) setCsrf(result.csrf);
  return result as T;
}
export async function get<T>(
  action: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL("/api/index.php", location.origin);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url, { credentials: "same-origin" });
  const result = await response.json();
  if (!response.ok)
    throw new ApiRequestError(
      result.error || "تعذّر إتمام العملية.",
      response.status,
    );
  return result;
}
export const fileUrl = (id: string) =>
  `/api/index.php?action=file&id=${encodeURIComponent(id)}`;
