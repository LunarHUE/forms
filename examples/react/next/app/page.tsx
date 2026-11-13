import { loadOrder } from "@lunarhue/forms-example-order";
import { OrderPage } from "@lunarhue/forms-example-react";
import { connection } from "next/server.js";
import { saveOrderAction } from "./actions.js";

/**
 * A server component. It loads the order on the server and hands it to the
 * client component as `defaultValues`, so the HTML already has the values
 * in the inputs and the client's first render matches it. The save goes
 * through a server action.
 */
export default async function Page() {
  // Render on every request, so the time below is the time of this request.
  await connection();
  const renderedAt = new Date();
  return (
    <OrderPage
      defaultValues={loadOrder()}
      save={saveOrderAction}
      header={
        <p>
          Rendered on the server at <time dateTime={renderedAt.toISOString()}>{renderedAt.toISOString()}</time>.
        </p>
      }
    />
  );
}
