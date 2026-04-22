import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "R&D Research Engine",
  description: "AI-powered research intelligence for engineering R&D",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
