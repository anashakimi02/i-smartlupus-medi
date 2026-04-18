import type { ReactNode } from "react";

export default function DesignSystemLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") {
    return <div className="p-8 text-center">Not available in production.</div>;
  }
  return <>{children}</>;
}
