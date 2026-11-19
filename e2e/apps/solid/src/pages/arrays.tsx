import { arraysScenario as scenario } from "@lunarhue/forms-e2e/contract";
import { createField, createForm } from "@lunarhue/forms-solid";
import { arrays } from "@lunarhue/forms-solid/plugins";
import { forms, Probe, Status, SubmitButton } from "../parts.js";

const team = forms.define({ ...scenario.definition, plugins: [arrays()] });
const { labels } = scenario;

export function ArraysPage() {
  const form = createForm(team);
  const members = form.root.at("members");
  const list = createField(members);
  return (
    <>
      <form.Form>
        {(formProps) => (
          <form {...formProps}>
            <ol>
              <form.Items name="members">
                {(member, index) => (
                  <li>
                    <form.TextField handle={member.at("name")} label={labels.member(index())} />
                    <button
                      type="button"
                      aria-label={labels.insertAbove(index())}
                      onClick={() => members.insert(index(), scenario.emptyMember())}
                    >
                      Insert
                    </button>
                    <button
                      type="button"
                      aria-label={labels.moveUp(index())}
                      disabled={index() === 0}
                      onClick={() => members.move(index(), index() - 1)}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      aria-label={labels.moveDown(index())}
                      disabled={index() === list.keys.length - 1}
                      onClick={() => members.move(index(), index() + 1)}
                    >
                      Down
                    </button>
                    <button type="button" aria-label={labels.remove(index())} onClick={() => members.remove(index())}>
                      Remove
                    </button>
                  </li>
                )}
              </form.Items>
            </ol>
            <button type="button" onClick={() => members.push(scenario.emptyMember())}>
              {labels.add}
            </button>
            <SubmitButton {...scenario.submit} />
            <Status />
          </form>
        )}
      </form.Form>
      <Probe store={form.store} />
    </>
  );
}
