import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flow Merge",
  description: "Canvas de automação e analytics inspirado nas versões A e B.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
