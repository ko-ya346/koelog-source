import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KOELOG — 声で整う生活ログ",
    short_name: "KOELOG",
    description: "健康、仕事、目標、期限を声だけで記録するライフアシスタント。",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f0e8",
    theme_color: "#245b43",
    orientation: "portrait",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
