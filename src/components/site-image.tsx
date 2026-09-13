import NextImage, { type ImageProps } from "next/image";
import { assetPath } from "@/lib/site";

export default function Image({ src, ...props }: ImageProps) {
  return (
    <NextImage
      {...props}
      src={typeof src === "string" ? assetPath(src) : src}
    />
  );
}
