import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

// /agence est le logiciel des agences (autre application) : la langue y est gérée par lui-même.
export const config = { matcher: ["/((?!_next|agence(?:/|$)|.*\..*).*)"] };
