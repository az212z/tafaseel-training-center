export const isStaticPreview = import.meta.env.VITE_STATIC_PREVIEW === "true";
export const asset = (path: string) =>
  path.startsWith("/") ? `${import.meta.env.BASE_URL}${path.slice(1)}` : path;
