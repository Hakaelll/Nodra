import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter-tight";
import "./globals.css";
import { ValidationNotice } from "../components/validation-notice";
import { ConfirmationProvider } from "../components/confirmation-provider";
import { cookies } from "next/headers";
import { LocaleProvider } from "../lib/locale-provider";
import { defaultLocale, isSupportedLocale, translate } from "../lib/i18n";
const baseMetadata: Metadata = {
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
async function requestLocale() {
  const stored = (await cookies()).get("nodra_locale")?.value;
  return isSupportedLocale(stored) ? stored : defaultLocale;
}
export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  return {
    ...baseMetadata,
    title: translate(locale, "Nodra — Personas, en sintonía"),
    description: translate(
      locale,
      "Tu equipo, tus servicios y cada confirmación. Un solo lugar para coordinar.",
    ),
  };
}
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
  const locale = await requestLocale();
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
