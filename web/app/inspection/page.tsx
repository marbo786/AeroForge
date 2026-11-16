import type { Metadata } from "next";
import Preview from "./preview";
import "./inspection.css";

export const metadata: Metadata = {
  title: "AF-02 Vehicle Inspection | AeroForge",
  description: "Orbit the original AeroForge inspection car and open the 2D airfoil editor.",
};

export default function InspectionPage() {
  return <Preview />;
}
