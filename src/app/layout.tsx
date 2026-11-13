import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

// Autumn-style type (useautumn.com): Geist for everything read, Geist Mono
// for labels, values and the uppercase section tags.
const geist = Geist({ variable: "--font-sans", subsets: ["latin", "cyrillic"] });
const geistMono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });
// Brand only: the "hibi" wordmark.
const brand = Outfit({ variable: "--font-brand", subsets: ["latin"], weight: ["500"] });

export const metadata: Metadata = { title: "hibi", description: "hibi — plan your day, week and month." };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes sets the theme class before hydration.
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${brand.variable} h-full antialiased`} suppressHydrationWarning>
      <body suppressHydrationWarning className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
