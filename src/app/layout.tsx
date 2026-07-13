import type { Metadata } from "next";
import { Hanken_Grotesk, Spectral } from "next/font/google";
import "./globals.css";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-hanken",
  display: "swap",
});

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-spectral",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Gate Pass System — Acacia LLC",
  description: "Gate pass management for Acacia LLC Landscaping & Nursery",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${hankenGrotesk.variable} ${spectral.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
