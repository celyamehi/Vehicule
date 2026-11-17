import { direction, FournisseurSession } from "@lvb/ui";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { routing } from "@/i18n/routing";
import { URL_API } from "@/lib/config";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t("commun.nomPlateforme"), robots: { index: false } };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b63ce" };

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <html lang={locale} dir={direction(locale)}>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider messages={messages} timeZone="Africa/Algiers">
          <FournisseurSession urlApi={URL_API} espace="loueur">
            {children}
          </FournisseurSession>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
