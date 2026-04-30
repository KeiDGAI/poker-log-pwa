import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ポーカープレーログ",
    short_name: "Poker Log",
    description: "ライブポーカーのセッション・プレイヤー・ゲームを高速記録するPWA",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f3ea",
    theme_color: "#16201c",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
