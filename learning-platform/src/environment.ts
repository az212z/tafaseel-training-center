export const isStaticPreview = import.meta.env.VITE_STATIC_PREVIEW === "true";
export const githubTrialUrl =
  "https://codespaces.new/az212z/tafaseel-training-center/tree/feat/learning-platform?devcontainer_path=.devcontainer%2Flearning-platform%2Fdevcontainer.json";
export const asset = (path: string) =>
  path.startsWith("/") ? `${import.meta.env.BASE_URL}${path.slice(1)}` : path;
