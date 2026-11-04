import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter-tight";
import "./globals.css";
import { ValidationNotice } from "../components/validation-notice";
import { ConfirmationProvider } from "../components/confirmation-provider";
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
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <ConfirmationProvider>{children}</ConfirmationProvider>
        <ValidationNotice />
      </body>
    </html>
  );
}
