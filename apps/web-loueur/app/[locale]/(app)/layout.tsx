import type { ReactNode } from "react";
import { Coquille } from "@/components/coquille";

export default function Layout({ children }: { children: ReactNode }) {
  return <Coquille>{children}</Coquille>;
}
