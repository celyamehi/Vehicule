import { configurationRequete } from "@lvb/ui";
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ requestLocale }) =>
  configurationRequete(await requestLocale),
);
