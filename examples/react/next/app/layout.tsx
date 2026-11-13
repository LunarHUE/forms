// The shared stylesheet, imported once for the whole app. A stylesheet has nothing to assign.
// oxlint-disable-next-line import/no-unassigned-import
import "@lunarhue/forms-example-order/styles.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Forms, Next.js example",
};

/** Props for `RootLayout`. */
interface RootLayoutProps {
  /** The page. */
  readonly children: ReactNode;
}

/** The root layout: a nav between the pages. The shared stylesheet is the only styling. */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <nav className="site-nav" aria-label="Examples">
          <a href="/">Full example</a>
          <a href="/basic">Basic example</a>
          <a href="/bind">Bind example</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
