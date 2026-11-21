import { Items, useField, useForm } from "@lunarhue/forms-react";
import { baselineOnSubmit, persist, ruled } from "@lunarhue/forms-react/plugins";
import { type FormEvent, useRef, useState } from "react";
import { Loaded, Page, ServerControls } from "../../shared/ui.tsx";
import { companies, customers, orders, sendInvite } from "../../shared/server.ts";
import { orderTotal } from "../format.ts";
import { Company, Customer, Invite, Order, roles } from "../schemas.ts";
import { Section } from "../ui.tsx";
import { forms } from "./forms.ts";
import { AddressFields, ErrorSummary, SaveBar } from "./parts.tsx";

// Each record form starts from the server's copy and takes what it sent as
// the new baseline after a save.

const customerForm = forms.define(
  (saved: Customer) => ({
    schema: Customer,
    defaultValues: saved,
    plugins: [baselineOnSubmit()],
    onSubmit: async (value) => {
      await customers.save(value);
      return "Customer saved.";
    },
  }),
  ruled({ shipping: (customer) => ({ hidden: customer.sameAsBilling }) }),
);

function CustomerForm({ saved }: { readonly saved: Customer }) {
  const form = useForm(customerForm, saved);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <ErrorSummary />
          <form.TextField name="name" label="Name" />
          <form.TextField name="email" label="Email" />
          <form.PhoneField name="phone" label="Phone" inputMode="tel" />
          <AddressFields field={form.root.at("billing")} legend="Billing address" />
          <form.Checkbox name="sameAsBilling" label="Ship to the billing address" />
          <AddressFields field={form.root.at("shipping")} legend="Shipping address" />
          <SaveBar load={customers.get} />
          <form.State select={(state) => state.submission}>
            {(submission) => <p role="status">{submission.status === "succeeded" ? submission.result : null}</p>}
          </form.State>
        </form>
      )}
    </form.Form>
  );
}

const orderForm = forms.define(
  (saved: Order) => ({
    schema: Order,
    defaultValues: saved,
    plugins: [baselineOnSubmit()],
    onSubmit: async (value) => {
      await orders.save(value);
      return "Order saved.";
    },
  }),
  ruled({ giftMessage: (order) => ({ hidden: !order.gift }) }),
);

function OrderForm({ saved }: { readonly saved: Order }) {
  const form = useForm(orderForm, saved);
  const lines = form.root.at("lines");
  const total = useField(lines, (snapshot) => orderTotal(snapshot.value));
  const listErrors = useField(lines, (snapshot) => snapshot.shownErrors);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <ErrorSummary />
          <form.TextField name="reference" label="Reference" />
          <fieldset>
            <legend>Lines</legend>
            <Items handle={lines}>
              {(line, index) => (
                <div className="line">
                  <form.TextField handle={line.at("sku")} label={`SKU ${index + 1}`} />
                  <form.QuantityField handle={line.at("quantity")} label={`Quantity ${index + 1}`} inputMode="numeric" />
                  <form.MoneyField handle={line.at("price")} label={`Price ${index + 1}`} inputMode="decimal" />
                  <button type="button" onClick={() => lines.remove(index)}>
                    Remove line {index + 1}
                  </button>
                </div>
              )}
            </Items>
            <ul className="errors">
              {listErrors.map((error) => (
                <li key={error.message}>{error.message}</li>
              ))}
            </ul>
            <button type="button" onClick={() => lines.push({ sku: "", quantity: "1", price: "" })}>
              Add line
            </button>
            <p>Total: {total}</p>
          </fieldset>
          <form.Checkbox name="gift" label="This order is a gift" />
          <form.TextArea name="giftMessage" label="Gift message" />
          <SaveBar load={orders.get} />
          <form.State select={(state) => state.submission}>
            {(submission) => <p role="status">{submission.status === "succeeded" ? submission.result : null}</p>}
          </form.State>
        </form>
      )}
    </form.Form>
  );
}

const companyForm = forms.define((saved: Company) => ({
  schema: Company,
  defaultValues: saved,
  plugins: [baselineOnSubmit()],
  // A refusal goes on the fields, as the submit docs show. That ends the
  // submit as invalid, so baselineOnSubmit() leaves the values unsaved.
  onSubmit: async (value, { store }) => {
    const response = await companies.save(value);
    if (!response.ok) {
      store.setErrors({ fields: Object.fromEntries(Object.entries(response.errors).map(([name, message]) => [name, { message }])) });
      return null;
    }
    return "Company saved.";
  },
}));

function CompanyForm({ saved }: { readonly saved: Company }) {
  const form = useForm(companyForm, saved);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <ErrorSummary />
          <form.TextField name="name" label="Company name" />
          <form.PhoneField name="phone" label="Phone" inputMode="tel" />
          <form.TaxIdField name="taxId" label="Tax ID" inputMode="numeric" />
          <AddressFields field={form.root.at("address")} legend="Registered address" />
          <SaveBar load={companies.get} />
          <form.State select={(state) => state.submission}>
            {(submission) => <p role="status">{submission.status === "succeeded" ? submission.result : null}</p>}
          </form.State>
        </form>
      )}
    </form.Form>
  );
}

// The draft survives closing the dialog and reloading the page.
const inviteForm = forms.define({
  schema: Invite,
  defaultValues: { email: "", role: "member", message: "" },
  plugins: [persist("backoffice-invite")],
  onSubmit: (value) => sendInvite(value),
});

function InviteDialog() {
  const form = useForm(inviteForm);
  const dialog = useRef<HTMLDialogElement>(null);
  const [sent, setSent] = useState("");

  // A reset puts the submission back to idle, so the message is kept here.
  // The reset also saves the empty form as the draft.
  const send = async (event: FormEvent) => {
    event.preventDefault();
    const submission = await form.submit();
    if (submission.status !== "succeeded") return;
    setSent(submission.result);
    form.store.reset();
  };

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()}>
        Invite a teammate
      </button>
      <dialog ref={dialog} aria-labelledby="invite-heading">
        <h2 id="invite-heading">Invite a teammate</h2>
        <form.Form>
          {(formProps) => (
            <form {...formProps} onSubmit={(event) => void send(event)}>
              <form.TextField name="email" label="Email" />
              <form.Select name="role" label="Role" options={roles} />
              <form.TextArea name="message" label="Message" />
              <p role="status">{sent}</p>
              <div className="save-bar">
                <button type="button" onClick={() => dialog.current?.close()}>
                  Close
                </button>
                <form.State select={(state) => state.submitting}>
                  {(submitting) => <button type="submit">{submitting ? "Sending..." : "Send invite"}</button>}
                </form.State>
              </div>
            </form>
          )}
        </form.Form>
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
        <Loaded load={customers.get}>{(saved) => <CustomerForm saved={saved} />}</Loaded>
      </Section>
      <Section title="Order">
        <Loaded load={orders.get}>{(saved) => <OrderForm saved={saved} />}</Loaded>
      </Section>
      <Section title="Company settings">
        <Loaded load={companies.get}>{(saved) => <CompanyForm saved={saved} />}</Loaded>
      </Section>
    </Page>
  );
}
