import { direction, FournisseurSession } from "@lvb/ui";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { EnTeteSite, PiedSite } from "@/components/cadre";
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
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: {
      default: `${t("client.accueil.titre")} — ${t("commun.nomPlateforme")}`,
      template: `%s — ${t("commun.nomPlateforme")}`,
    },
    description: t("client.accueil.sousTitre"),
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])) },
  };
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
      <body className="flex min-h-dvh flex-col antialiased">
        <NextIntlClientProvider messages={messages} timeZone="Africa/Algiers">
          <FournisseurSession urlApi={URL_API} espace="client">
            <EnTeteSite />
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
              {children}
            </main>
            <PiedSite />
          </FournisseurSession>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
