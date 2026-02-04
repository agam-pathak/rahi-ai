import type { Metadata } from "next";
import { Space_Grotesk, Fraunces } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rahi.AI – Travel Smart with AI",
  description:
    "Rahi.AI helps students and backpackers plan smarter trips within budget using AI-powered itineraries.",

  icons: {
    icon: "/icons/favicon.ico",
    shortcut: "/icons/favicon.ico",
    apple: "/icons/apple-icon.png",
  },

  openGraph: {
    title: "Rahi.AI – Travel Smart with AI",
    description:
      "Plan smarter trips. Save money. Travel confidently with AI.",
    url: "https://rahi.ai",
    siteName: "Rahi.AI",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Rahi.AI – Travel Smart with AI",
    description:
      "AI-powered trip planning for students and backpackers.",
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${fraunces.variable}`}>
      <body className="bg-gradient-to-br from-black via-slate-950 to-slate-900 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
