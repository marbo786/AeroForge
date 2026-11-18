import type { Metadata } from "next";
import localFont from "next/font/local";
import "./style.css";

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
    "Edit accurate NACA airfoil geometry and evaluate lift and drag with local browser inference. Explore aerodynamic design with transparent model limitations.",
  metadataBase: new URL("https://aeroforge-9tf.pages.dev"),
  openGraph: {
    type: "website",
    title: "AeroForge | Aerodynamic Design Studio",
    description:
      "Explore the AF�02. Design isolated NACA sections with live browser predictions and honest limits.",
    images: [
      {
        url: "/social-preview.png",
        width: 1200,
        height: 630,
        alt: "AeroForge AF�02 aerodynamic design studio. Illustrative car, isolated section predictions.",
      },
    ],
  },
  twitter: { card: "summary_large_image", images: ["/social-preview.png"] },
  icons: { icon: "/icon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${mono.variable} ${condensed.variable}`}>
      <body>{children}</body>
    </html>
  );
}
