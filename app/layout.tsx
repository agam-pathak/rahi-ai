import type { Metadata } from "next";
import { Space_Grotesk, Fraunces } from "next/font/google";
import "./globals.css";
import AppBackButton from "@/components/AppBackButton";

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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://rahi.ai"),
  title: {
    default: "Rahi.AI – Travel Smart with AI",
    template: "%s | Rahi.AI",
  },
  description:
    "Rahi.AI helps students and backpackers plan smarter trips within budget using AI-powered itineraries.",
  applicationName: "Rahi.AI",
  category: "travel",
  alternates: {
    canonical: "/",
  },

  icons: {
    icon: "/icons/favicon.ico",
    shortcut: "/icons/favicon.ico",
    apple: "/icons/apple-icon.png",
  },

  openGraph: {
    title: "Rahi.AI – Travel Smart with AI",
    description:
      "Plan smarter trips. Save money. Travel confidently with AI.",
    url: "/",
    siteName: "Rahi.AI",
    type: "website",
    images: [
      {
        url: "/og/rahi-og.svg",
        width: 1200,
        height: 630,
        alt: "Rahi.AI – Travel Smart with AI",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Rahi.AI – Travel Smart with AI",
    description:
      "AI-powered trip planning for students and backpackers.",
    images: ["/og/rahi-og.svg"],
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
        <AppBackButton />
      </body>
    </html>
  );
}
