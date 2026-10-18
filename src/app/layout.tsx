import type { Metadata } from "next";
import { Baloo_2, Geist, Geist_Mono, Lilita_One, Nunito } from "next/font/google";
import "./globals.css";

const fontSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Display caixa-alta / divertida para headlines de marketing.
 * Lilita One = personalidade forte; Baloo 2 = fallback arredondado no app shell.
 */
const fontStoryDisplay = Lilita_One({
  variable: "--font-lilita",
  subsets: ["latin"],
  weight: "400",
});

const fontHeading = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

/** Corpo arredondado, altamente legível para texto infantil. */
const fontStoryBody = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Euzim",
    template: "%s · Euzim",
  },
  description:
    "Crie histórias onde a sua criança é a protagonista. O Euzim constrói o hábito da leitura, e nós fazemos tudo por você.",
  applicationName: "Euzim",
  icons: {
    icon: [
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/brand/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Euzim",
    description:
      "Crie histórias onde a sua criança é a protagonista. O Euzim constrói o hábito da leitura, e nós fazemos tudo por você.",
    siteName: "Euzim",
    images: [{ url: "/brand/euzim-hero-serena-boy.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${fontSans.variable} ${fontMono.variable} ${fontStoryDisplay.variable} ${fontHeading.variable} ${fontStoryBody.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: extensões (ex. ColorZilla cz-shortcut-listen) alteram o <body> */}
      <body
        className="flex min-h-full flex-col font-story-body antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
