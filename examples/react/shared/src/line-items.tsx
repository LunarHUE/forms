import { type OrderDraft, orderTotal, type ReadonlyOrderDraft } from "@lunarhue/forms-example-order";
import { errorId, type FieldHandle, type HandleOf, useField, useFormContext } from "@lunarhue/forms-react";
import { RenderBadge, useRenderBadge } from "./badge.js";
import { FieldErrors } from "./fields.js";
import { LineItemFieldset, order } from "./order.js";

/** Formats an amount of money for display. */
export const money = (amount: number): string => amount.toFixed(2);

/** The handle of the order's line item array. */
type LineItemsHandle = FieldHandle<OrderDraft["lineItems"]>;

/** One line's total: quantity times unit price, with a missing number counted as 0. */
const lineTotal = (item: ReadonlyOrderDraft["lineItems"][number]): number => orderTotal({ lineItems: [item] });

/**
 * A line's total. It reads the row through `useField` with a selector, so
 * it re-renders only when the total changes, not on every keystroke in the
 * description.
 */
function LineTotal(props: { readonly item: HandleOf<typeof LineItemFieldset> }) {
  const total = useField(props.item, (snapshot) => lineTotal(snapshot.value));
  return <>{money(total)}</>;
}

/** Props for `LineItemRow`. */
interface LineItemRowProps {
  /** The item's handle. It follows the item when it moves. */
  readonly item: HandleOf<typeof LineItemFieldset>;
  /** The array handle, for `move` and `remove`. */
  readonly lineItems: LineItemsHandle;
  readonly index: number;
  readonly last: boolean;
}

/**
 * One row. The registered components are bound to the row's own scope, so
 * `name="quantity"` is this item's quantity. Typing in a cell re-renders
 * that cell's field component and the line total, not the row.
 */
function LineItemRow(props: LineItemRowProps) {
  const { item, lineItems, index } = props;
  const scope = LineItemFieldset.scope(item);
  const badge = useRenderBadge();
  return (
    <tr>
      <td>
        <scope.TextField name="description" label={`Item ${index + 1} description`} inline />
      </td>
      <td className="num">
        <scope.NumberField name="quantity" label={`Item ${index + 1} quantity`} inline />
      </td>
      <td className="num">
        <scope.NumberField name="unitPrice" label={`Item ${index + 1} unit price`} step={0.01} inline />
      </td>
      <td className="num">
        <LineTotal item={item} />
      </td>
      <td className="num">
        <RenderBadge counter={badge} name={`row ${item.id}`} />{" "}
        <button
          type="button"
          className="button button-small"
          aria-label={`Move item ${index + 1} up`}
          disabled={index === 0}
          onClick={() => lineItems.move(index, index - 1)}
        >
          Up
        </button>{" "}
        <button
          type="button"
          className="button button-small"
          aria-label={`Move item ${index + 1} down`}
          disabled={props.last}
          onClick={() => lineItems.move(index, index + 1)}
        >
          Down
        </button>{" "}
        <button
          type="button"
          className="button button-small button-danger"
          aria-label={`Remove item ${index + 1}`}
          onClick={() => lineItems.remove(index)}
        >
          Remove
        </button>
      </td>
    </tr>
  );
}

/** The table footer: the order total before the discount. */
function OrderTotalRow(props: { readonly lineItems: LineItemsHandle }) {
  const total = useField(props.lineItems, (snapshot) => orderTotal({ lineItems: snapshot.value }));
  return (
    <tr className="line-items-total">
      <td colSpan={3}>Order total</td>
      <td className="num" data-testid="order-total">
        {money(total)}
      </td>
      <td />
    </tr>
  );
}

/**
 * The line items. `form.Items` renders one child per item, keyed by the
 * item's stable key, and re-renders only when items are added, removed or
 * moved. So each row keeps its DOM node, focus included, when it moves.
 */
export function LineItems() {
  const form = useFormContext(order);
  const lineItems = form.root.at("lineItems");
  const count = useField(lineItems, (snapshot) => snapshot.keys.length);
  const errors = useField(lineItems, (snapshot) => snapshot.shownErrors);
  const badge = useRenderBadge();
  return (
    <fieldset className="fieldset">
      <legend>
        Line items <RenderBadge counter={badge} name="Line items fieldset" />
      </legend>
      <table className="line-items">
        <thead>
          <tr>
            <th>Item</th>
            <th className="num">Quantity</th>
            <th className="num">Unit price</th>
            <th className="num">Total</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <form.Items name="lineItems">
            {(item, index) => <LineItemRow item={item} lineItems={lineItems} index={index} last={index === count - 1} />}
          </form.Items>
        </tbody>
        <tfoot>
          <OrderTotalRow lineItems={lineItems} />
        </tfoot>
      </table>
      <FieldErrors id={errorId(lineItems)} errors={errors} />
      <div className="form-actions">
        {/* With no argument, `push` adds the valibot adapter's empty line item. */}
        <button type="button" className="button" onClick={() => lineItems.push()}>
          Add item
        </button>
      </div>
    </fieldset>
  );
}
