import type { Metadata } from "next";
import { Fredoka, Geist, Geist_Mono, Nunito } from "next/font/google";
import "./globals.css";

const fontSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Display amigável para títulos do livro (modo leitura). */
const fontStoryDisplay = Fredoka({
  variable: "--font-story-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/** Corpo arredondado e legível para texto infantil. */
const fontStoryBody = Nunito({
  variable: "--font-story-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Estúdio Mágico",
  description:
    "Histórias infantis personalizadas com o avatar da sua criança.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${fontSans.variable} ${fontMono.variable} ${fontStoryDisplay.variable} ${fontStoryBody.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: extensões (ex. ColorZilla cz-shortcut-listen) alteram o <body> */}
      <body
        className="flex min-h-full flex-col font-sans"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
