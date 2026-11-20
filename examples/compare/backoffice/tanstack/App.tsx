import { type AnyFormApi, getBy, useStore } from "@tanstack/react-form";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { companies, customers, orders, type SaveResponse, sendInvite } from "../../shared/server.ts";
import { ErrorList, Loaded, Page, ServerControls } from "../../shared/ui.tsx";
import { orderTotal } from "../format.ts";
import { type Address, Company, countries, Customer, Invite, Order, roles } from "../schemas.ts";
import { Section } from "../ui.tsx";
import { messageOf, useAppForm, withFieldGroup } from "./form.tsx";
import { undoStackOf } from "./history.ts";
import { rebaseline, same } from "./values.ts";

const blankAddress: Address = { street: "", city: "", region: "", postcode: "", country: "US" };

/** An address anywhere in any form. The state shows only for the US. */
const AddressFields = withFieldGroup({
  defaultValues: blankAddress,
  props: { legend: "" },
  render: function Render({ group, legend }) {
    const country = useStore(group.store, (state) => state.values.country);
    return (
      <fieldset>
        <legend>{legend}</legend>
        <group.AppField name="street">{(field) => <field.TextField label="Street" />}</group.AppField>
        <group.AppField name="city">{(field) => <field.TextField label="City" />}</group.AppField>
        {country === "US" ? <group.AppField name="region">{(field) => <field.TextField label="State" />}</group.AppField> : null}
        <group.AppField name="postcode">{(field) => <field.TextField label="Postcode" />}</group.AppField>
        <group.AppField name="country">{(field) => <field.Select label="Country" options={countries} />}</group.AppField>
      </fieldset>
    );
  },
});

/**
 * A form for a record loaded from the server, with Refresh for the save bar.
 * `useForm` applies its options again on every render, so defaults moved
 * with `form.reset(values)` would snap back to the first ones. They live in
 * React state and move with each rebaseline. After a save, what was sent
 * becomes the defaults, and a field edited while the save ran keeps the
 * newer value and stays changed.
 *
 * A refusal puts the server's messages on the fields with `setErrorMap` and
 * leaves the defaults alone. `onSubmit` returning still counts as a
 * successful submit, so the status line is React state, not
 * `isSubmitSuccessful`.
 */
function useRecordForm<T>(
  initial: T,
  schema: z.ZodType<T, T>,
  server: { readonly get: () => Promise<T>; readonly save: (value: T) => Promise<SaveResponse> },
  savedMessage: string,
) {
  const [defaults, setDefaults] = useState(initial);
  const [status, setStatus] = useState("");
  const form = useAppForm({
    defaultValues: defaults,
    validators: { onChange: schema },
    onSubmitInvalid: () => setStatus(""),
    onSubmit: async ({ value, formApi }) => {
      setStatus("");
      const response = await server.save(value);
      if (!response.ok) {
        // The server names fields by string, and `T` is generic here, so the
        // form is used through TanStack's untyped form type.
        const untyped: AnyFormApi = formApi;
        untyped.setErrorMap({ onSubmit: { fields: response.errors } });
        return;
      }
      rebaseline(formApi, value, (name, current) => !same(current, getBy(value, name)));
      setDefaults(value);
      setStatus(savedMessage);
    },
  });

  // Leaves the user hasn't changed take the server's copy. Changed ones keep
  // their value and stay changed against the new defaults.
  const refresh = async () => {
    const fresh = await server.get();
    rebaseline(form, fresh, (name, value) => !same(value, getBy(defaults, name)));
    setDefaults(fresh);
  };

  return { form, status, saveBar: { defaults, refresh } };
}

function CustomerForm({ initial }: { readonly initial: Customer }) {
  const { form, status, saveBar } = useRecordForm(initial, Customer, customers, "Customer saved.");
  return (
    <form.AppForm>
      <form.RecordForm status={status}>
        <form.ErrorSummary />
        <form.AppField name="name">{(field) => <field.TextField label="Name" />}</form.AppField>
        <form.AppField name="email">{(field) => <field.TextField label="Email" />}</form.AppField>
        <form.AppField name="phone">{(field) => <field.PhoneField label="Phone" inputMode="tel" />}</form.AppField>
        <AddressFields form={form} fields="billing" legend="Billing address" />
        <form.AppField name="sameAsBilling">{(field) => <field.Checkbox label="Ship to the billing address" />}</form.AppField>
        <form.Subscribe selector={(state) => state.values.sameAsBilling}>
          {(sameAsBilling) => (sameAsBilling ? null : <AddressFields form={form} fields="shipping" legend="Shipping address" />)}
        </form.Subscribe>
        <form.SaveBar {...saveBar} />
      </form.RecordForm>
    </form.AppForm>
  );
}

const newLine = { sku: "", quantity: "1", price: "" };

function OrderForm({ initial }: { readonly initial: Order }) {
  const { form, status, saveBar } = useRecordForm(initial, Order, orders, "Order saved.");
  return (
    <form.AppForm>
      <form.RecordForm status={status}>
        <form.ErrorSummary />
        <form.AppField name="reference">{(field) => <field.TextField label="Reference" />}</form.AppField>
        <form.Field name="lines" mode="array">
          {(lines) => (
            <fieldset>
              <legend>Lines</legend>
              {lines.state.value.map((_, index) => (
                // TanStack's docs key array rows by index.
                // oxlint-disable-next-line react/no-array-index-key
                <div className="line" key={index}>
                  <form.AppField name={`lines[${index}].sku`}>{(field) => <field.TextField label={`SKU ${index + 1}`} />}</form.AppField>
                  <form.AppField name={`lines[${index}].quantity`}>
                    {(field) => <field.QuantityField label={`Quantity ${index + 1}`} inputMode="numeric" />}
                  </form.AppField>
                  <form.AppField name={`lines[${index}].price`}>
                    {(field) => <field.MoneyField label={`Price ${index + 1}`} inputMode="decimal" />}
                  </form.AppField>
                  <button
                    type="button"
                    onClick={() => {
                      undoStackOf(form).record("lines", lines.state.value);
                      lines.removeValue(index);
                    }}
                  >
                    Remove line {index + 1}
                  </button>
                </div>
              ))}
              <form.Subscribe selector={(state) => state.submissionAttempts > 0}>
                {(submitted) => <ErrorList errors={submitted ? lines.state.meta.errors.map(messageOf) : []} />}
              </form.Subscribe>
              <button
                type="button"
                onClick={() => {
                  undoStackOf(form).record("lines", lines.state.value);
                  lines.pushValue(newLine);
                }}
              >
                Add line
              </button>
              {/* The array field re-renders only when rows come or go, so the total subscribes on its own. */}
              <form.Subscribe selector={(state) => orderTotal(state.values.lines)}>{(total) => <p>Total: {total}</p>}</form.Subscribe>
            </fieldset>
          )}
        </form.Field>
        <form.AppField name="gift">{(field) => <field.Checkbox label="This order is a gift" />}</form.AppField>
        <form.Subscribe selector={(state) => state.values.gift}>
          {(gift) => (gift ? <form.AppField name="giftMessage">{(field) => <field.TextArea label="Gift message" />}</form.AppField> : null)}
        </form.Subscribe>
        <form.SaveBar {...saveBar} />
      </form.RecordForm>
    </form.AppForm>
  );
}

function CompanyForm({ initial }: { readonly initial: Company }) {
  const { form, status, saveBar } = useRecordForm(initial, Company, companies, "Company saved.");
  return (
    <form.AppForm>
      <form.RecordForm status={status}>
        <form.ErrorSummary />
        <form.AppField name="name">{(field) => <field.TextField label="Company name" />}</form.AppField>
        <form.AppField name="phone">{(field) => <field.PhoneField label="Phone" inputMode="tel" />}</form.AppField>
        <form.AppField name="taxId">{(field) => <field.TaxIdField label="Tax ID" inputMode="numeric" />}</form.AppField>
        <AddressFields form={form} fields="address" legend="Registered address" />
        <form.SaveBar {...saveBar} />
      </form.RecordForm>
    </form.AppForm>
  );
}

const draftKey = "backoffice-invite";
const blankInvite: Invite = { email: "", role: "member", message: "" };
// A draft may hold a half-typed email, so it is checked for shape only.
const Draft = z.object({ email: z.string(), role: z.enum(roles), message: z.string() });

/** The saved draft, or undefined when storage is empty, blocked or holds something else. */
function loadDraft(): Invite | undefined {
  try {
    const parsed = Draft.safeParse(JSON.parse(localStorage.getItem(draftKey) ?? "null"));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function InviteDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [sent, setSent] = useState("");
  // In state for the same reason as useRecordForm: a reset to the blank
  // invite has to stick past the next render.
  const [defaults, setDefaults] = useState(() => loadDraft() ?? blankInvite);
  const form = useAppForm({
    defaultValues: defaults,
    validators: { onChange: Invite },
    onSubmit: async ({ value, formApi }) => {
      setSent(await sendInvite(value));
      formApi.reset(blankInvite);
      setDefaults(blankInvite);
    },
  });

  // TanStack has no persistence, so the draft is saved on every change.
  const values = useStore(form.store, (state) => state.values);
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(values));
    } catch {
      // Storage is blocked or full. The draft just isn't kept.
    }
  }, [values]);

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()}>
        Invite a teammate
      </button>
      <dialog ref={dialog} aria-labelledby="invite-heading">
        <h2 id="invite-heading">Invite a teammate</h2>
        <form.AppForm>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <form.AppField name="email">{(field) => <field.TextField label="Email" />}</form.AppField>
            <form.AppField name="role">{(field) => <field.Select label="Role" options={roles} />}</form.AppField>
            <form.AppField name="message">{(field) => <field.TextArea label="Message" />}</form.AppField>
            <p role="status">{sent}</p>
            <div className="save-bar">
              <button type="button" onClick={() => dialog.current?.close()}>
                Close
              </button>
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(submitting) => <button type="submit">{submitting ? "Sending..." : "Send invite"}</button>}
              </form.Subscribe>
            </div>
          </form>
        </form.AppForm>
      </dialog>
    </>
  );
}

export function App() {
  return (
    <Page title="Back office" lede="Three record forms and a dialog that share field components, a save bar and an error summary.">
      <ServerControls>
        <button type="button" onClick={customers.editElsewhere}>
          Edit customer
        </button>
        <button type="button" onClick={orders.editElsewhere}>
          Edit order
        </button>
        <button type="button" onClick={companies.editElsewhere}>
          Edit company
        </button>
      </ServerControls>
      <InviteDialog />
      <Section title="Customer">
        <Loaded load={customers.get}>{(saved) => <CustomerForm initial={saved} />}</Loaded>
      </Section>
      <Section title="Order">
        <Loaded load={orders.get}>{(saved) => <OrderForm initial={saved} />}</Loaded>
      </Section>
      <Section title="Company settings">
        <Loaded load={companies.get}>{(saved) => <CompanyForm initial={saved} />}</Loaded>
      </Section>
    </Page>
  );
}
