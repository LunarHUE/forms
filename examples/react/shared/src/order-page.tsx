import { invalidOrder, type SaveOrder, serverSettings } from "@lunarhue/forms-example-order";
import { useForm } from "@lunarhue/forms-react";
import type { ReactNode } from "react";
import { RenderBadge, useRenderBadge } from "./badge.js";
import { Inspector } from "./inspector.js";
import { order, type OrderDefaults } from "./order.js";
import { OrderForm } from "./order-form.js";

/** Props for `OrderPage`. Each app passes what differs for its framework. */
export interface OrderPageProps {
  /** Where the order is saved: `saveOrder` in a SPA, a server action in Next.js. */
  readonly save: SaveOrder;
  /** The order to start from. Apps that render on the server load it there and pass it in. */
  readonly defaultValues?: OrderDefaults;
  /** Extra content under the page intro, such as when the server rendered the page. */
  readonly header?: ReactNode;
}

/**
 * The example page: the form on the left, the inspector on the right.
 * `useForm(order, options)` makes the form once, with this page's save
 * function and starting values, and `form.Form` puts it in context for
 * everything below.
 * The page reads no form state, so it commits once and its badge stays at 1.
 */
export function OrderPage(props: OrderPageProps) {
  const form = useForm(order, {
    save: props.save,
    ...(props.defaultValues === undefined ? {} : { defaultValues: props.defaultValues }),
  });
  const badge = useRenderBadge();
  return (
    <form.Form>
      <header className="page-header">
        <h1>
          New order <RenderBadge counter={badge} name="OrderPage" />
        </h1>
        <p>
          Each pill counts how many times its component committed. Type in a field and watch which ones move.
        </p>
        {props.header}
      </header>
      <main className="page">
        <section className="page-form" aria-label="Order form">
          <OrderForm />
        </section>
        <aside className="page-inspector" aria-label="Inspector">
          <Inspector store={form.store} settings={serverSettings} invalidValue={invalidOrder} />
        </aside>
      </main>
    </form.Form>
  );
}
