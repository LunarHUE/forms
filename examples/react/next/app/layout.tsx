// The shared stylesheet, imported once for the whole app. A stylesheet has nothing to assign.
// oxlint-disable-next-line import/no-unassigned-import
import "@lunarhue/forms-example-order/styles.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "New order, Next.js",
};

/** The root layout. The shared stylesheet is the page's only styling. */
export default function RootLayout(props: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>{props.children}</body>
    </html>
  );
}
