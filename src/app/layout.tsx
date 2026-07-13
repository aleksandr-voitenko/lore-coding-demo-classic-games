import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { CookieNotice } from "@/components/cookie-notice";
import { APP_THEME_CSS_VARIABLES, APP_THEME_STORAGE_KEY } from "@/lib/app-theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Game Library",
  description:
    "A card-based launcher with classic arcade and puzzle games including Snake, Tetris, Breakout, Minesweeper, Space Invaders, Asteroids, and Tank Patrol.",
};

const themeInitScript = `
(() => {
  try {
    const themeVariables = ${JSON.stringify(APP_THEME_CSS_VARIABLES)};
    const storedTheme = window.localStorage.getItem(${JSON.stringify(APP_THEME_STORAGE_KEY)});
    const theme = storedTheme === "dark" ? "dark" : "light";
    const root = document.documentElement;

    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;

    for (const [property, value] of Object.entries(themeVariables[theme])) {
      root.style.setProperty(property, value);
    }
  } catch {
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
          id="app-theme-init"
        />
        {children}
        <CookieNotice />
      </body>
    </html>
  );
}
