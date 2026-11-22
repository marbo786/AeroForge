import type { Metadata } from "next";
import localFont from "next/font/local";
import "./style.css";
import { LiveryProvider } from "./studio/livery";

const geist = localFont({
  src: "../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2",
  variable: "--font-geist",
  display: "swap",
});
const mono = localFont({
  src: "./fonts/JetBrainsMono-Regular.woff2",
  variable: "--font-mono",
  display: "swap",
});
const condensed = localFont({
  src: "./fonts/BarlowSemiCondensed-Bold.ttf",
  variable: "--font-condensed",
  weight: "700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AeroForge | Aerodynamic Design Studio",
  description:
    "Scroll from shape to pressure, then design isolated NACA sections with real browser inference. An illustrative AF–02 car, original colorways and honest model limits.",
  metadataBase: new URL("https://aeroforge-9tf.pages.dev"),
  openGraph: {
    type: "website",
    title: "AeroForge | Aerodynamic Design Studio",
    description:
      "Shape. Pressure. Your next iteration. Explore the illustrative AF–02 and design isolated NACA sections with honest limits.",
    images: [
      {
        url: "/social-preview.png",
        width: 1200,
        height: 630,
        alt: "AeroForge AF–02 aerodynamic design studio. Illustrative car, isolated section predictions.",
      },
    ],
  },
  twitter: { card: "summary_large_image", images: ["/social-preview.png"] },
  icons: { icon: "/icon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${mono.variable} ${condensed.variable}`}>
      <body>
        <LiveryProvider>{children}</LiveryProvider>
      </body>
    </html>
  );
}
