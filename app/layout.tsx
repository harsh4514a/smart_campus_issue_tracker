import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";
import PageTitleManager from "@/components/PageTitleManager";

export const metadata = {
  title: "Smart Campus Issue Tracker",
  description: "Manage and track campus issues efficiently",
  keywords: ["campus", "issue tracker", "student portal","smart campus management system","campus management"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      
      <body className="antialiased min-h-screen">
        <ToastProvider>
          <PageTitleManager />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}







