import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";
import PageTitleManager from "@/components/PageTitleManager";

export const metadata: Metadata = {
  title: "CampusTracker",
  description: "Smart Campus Issue Tracker",
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







