import { type Line, rendersScenario as scenario } from "@lunarhue/forms-e2e/contract";
import { Items, type FieldHandle, useField, useForm, useFormContext } from "@lunarhue/forms-react";
import { arrays } from "@lunarhue/forms-react/plugins";
import { forms, Probe, Renders, serverId, Status, SubmitButton } from "../parts.js";

const order = forms.define({ ...scenario.definition, plugins: [arrays()] });
const { labels, counters, totals } = scenario;

interface LineProps {
  readonly line: FieldHandle<Line>;
  readonly index: number;
}

/** A line's total. It reads one number, so only a new quantity or price renders it. */
function LineTotal({ line, index }: LineProps) {
  const total = useField(line, (snapshot) => scenario.lineTotal(snapshot.value));
  return (
    <span>
      <output data-testid={totals.line(index)}>{scenario.money(total)}</output>
      <Renders id={counters.lineTotal(index)} />
    </span>
  );
}

/** One row. It reads no state, so typing in its cells never renders it. */
function LineRow({ line, index }: LineProps) {
  const form = useFormContext(order);
  return (
    <li>
      <form.TextField handle={line.at("description")} label={labels.description(index)} />
      <form.NumberField handle={line.at("quantity")} label={labels.quantity(index)} />
      <form.NumberField handle={line.at("price")} label={labels.price(index)} />
      <LineTotal line={line} index={index} />
      <Renders id={counters.row(index)} />
    </li>
  );
}

function OrderTotal() {
  const form = useFormContext(order);
  const total = useField(form.root.at("lines"), (snapshot) => scenario.orderTotal(snapshot.value));
  return (
    <p>
      Total <output data-testid={totals.order}>{scenario.money(total)}</output>
      <Renders id={counters.orderTotal} />
    </p>
  );
}

export function RendersPage() {
  const form = useForm(order, serverId(scenario.id));
  return (
    <>
      <form.Form>
        {(formProps) => (
          <form {...formProps}>
            <form.TextField name="customer.name" label={labels.name} />
            <form.TextField name="customer.email" label={labels.email} />
            <ol>
              <Items handle={form.root.at("lines")}>{(line, index) => <LineRow line={line} index={index} />}</Items>
            </ol>
            <OrderTotal />
            <SubmitButton {...scenario.submit} />
            <Status />
          </form>
        )}
      </form.Form>
      <Renders id={counters.page} />
      <Probe store={form.store} />
    </>
  );
}
