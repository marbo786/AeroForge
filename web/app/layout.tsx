import type { Metadata } from "next";
import "./style.css";

export const metadata: Metadata = {
  title: "AeroForge | Browser inference feasibility",
  description: "Phase 1 static hosting and browser ONNX infrastructure test.",
  icons: { icon: "/icon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
