import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { FormPrivacy } from "@/components/form-privacy";
import { ScrollToTop } from "@/components/scroll-to-top";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Delivery Now | Villa Constitución",
  description: "Envíos, compras y mandados locales con seguimiento.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><FormPrivacy/><ScrollToTop/>{children}</body>
    </html>
  );
}
