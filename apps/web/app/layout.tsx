import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter-tight";
import "./globals.css";
import { ValidationNotice } from "../components/validation-notice";
import { ConfirmationProvider } from "../components/confirmation-provider";
import { cookies } from "next/headers";
import { LocaleProvider } from "../lib/locale-provider";
import { defaultLocale, isSupportedLocale } from "../lib/i18n";
export const metadata: Metadata = {
  title: "Nodra — Personas, en sintonía",
  description:
    "Tu equipo, tus servicios y cada confirmación. Un solo lugar para coordinar.",
  icons: {
    icon: [
      { url: "/brand/nodra-icon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: { url: "/brand/apple-touch-icon.png", sizes: "180x180" },
  },
};
export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const storedLocale = (await cookies()).get("nodra_locale")?.value;
  const locale = isSupportedLocale(storedLocale) ? storedLocale : defaultLocale;
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider initialLocale={locale}>
          <ConfirmationProvider>{children}</ConfirmationProvider>
          <ValidationNotice />
        </LocaleProvider>
      </body>
    </html>
  );
}
