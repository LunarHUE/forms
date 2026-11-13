import { type Line, rendersScenario as scenario } from "@lunarhue/forms-e2e/contract";
import { createField, createForm, type FieldHandle, useFormContext } from "@lunarhue/forms-solid";
import { forms, Probe, Renders, Status, SubmitButton } from "../parts.js";

const order = forms.define(scenario.definition);
const { labels, counters, totals } = scenario;

interface LineProps {
  readonly line: FieldHandle<Line>;
  readonly index: number;
}

/** A line's total. The text updates in place when a quantity or price changes. */
function LineTotal(props: LineProps) {
  const line = createField(props.line);
  return (
    <span>
      <output data-testid={totals.line(props.index)}>{scenario.money(scenario.lineTotal(line.value))}</output>
      <Renders id={counters.lineTotal(props.index)} />
    </span>
  );
}

/** One row. */
function LineRow(props: LineProps) {
  const form = useFormContext(order);
  return (
    <li>
      <form.TextField handle={props.line.at("description")} label={labels.description(props.index)} />
      <form.NumberField handle={props.line.at("quantity")} label={labels.quantity(props.index)} />
      <form.NumberField handle={props.line.at("price")} label={labels.price(props.index)} />
      <LineTotal line={props.line} index={props.index} />
      <Renders id={counters.row(props.index)} />
    </li>
  );
}

function OrderTotal() {
  const form = useFormContext(order);
  const lines = createField(form.root.at("lines"));
  return (
    <p>
      Total <output data-testid={totals.order}>{scenario.money(scenario.orderTotal(lines.value))}</output>
      <Renders id={counters.orderTotal} />
    </p>
  );
}

export function RendersPage() {
  const form = createForm(order);
  return (
    <>
      <form.Form>
        {(formProps) => (
          <form {...formProps}>
            <form.TextField name="customer.name" label={labels.name} />
            <form.TextField name="customer.email" label={labels.email} />
            <ol>
              <form.Items name="lines">{(line, index) => <LineRow line={line} index={index()} />}</form.Items>
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
