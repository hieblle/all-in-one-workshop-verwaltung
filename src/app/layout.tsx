import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "dbrains Workshop-Hub",
  description: "Source of Truth für den Workshop-Prozess der dbrains academy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
