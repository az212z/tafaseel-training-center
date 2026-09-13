import TrackPage from "@/components/track-page";
export {
  generateMetadata,
  generateStaticParams,
} from "@/components/track-page";
export const dynamicParams = false;
export default function V2Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <TrackPage params={params} variant="v2" />;
}
