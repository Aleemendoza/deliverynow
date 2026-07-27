import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { FormPrivacy } from "@/components/form-privacy";
import { ScrollToTop } from "@/components/scroll-to-top";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Delivery Ya | Villa Constitución",
  description: "Envíos, compras y mandados locales con seguimiento.",
  // Versioned URL forces Chrome/Android to discard the former cached manifest
  // that still referenced the old yellow SVG icon.
  manifest: "/manifest-v2.webmanifest",
  icons: {
    icon: "/delivery-ya-icon-192.png",
    apple: "/delivery-ya-icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#facc15",
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
