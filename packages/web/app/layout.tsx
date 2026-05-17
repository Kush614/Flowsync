import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlowSync Dashboard",
  description: "Engineering-native sync layer for Notion"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
