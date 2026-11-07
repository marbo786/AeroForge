import type { Metadata } from "next";
import localFont from "next/font/local";
import "./style.css";

const geist = localFont({ src: "../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2", variable: "--font-geist", display: "swap" });
const mono = localFont({ src: "./fonts/JetBrainsMono-Regular.woff2", variable: "--font-mono", display: "swap" });
const condensed = localFont({ src: "./fonts/BarlowSemiCondensed-Bold.ttf", variable: "--font-condensed", weight: "700", display: "swap" });

export const metadata: Metadata = {
  title: "AeroForge | Aerodynamic Design Studio",
  description: "Edit accurate NACA airfoil geometry and evaluate lift and drag with local browser inference. Explore aerodynamic design with transparent model limitations.",
  icons: { icon: "/icon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${geist.variable} ${mono.variable} ${condensed.variable}`}><body>{children}</body></html>;
}
