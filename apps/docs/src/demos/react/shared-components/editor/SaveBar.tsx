import { useFormContext, useFormState } from "@lunarhue/forms-react";
import { history } from "@lunarhue/forms-react/plugins";
import { forms } from "./forms";

// Works under any form from `forms`, whatever its definition. Its type knows
// the shared plugins, so `form.plugins.history` type-checks.
export function SaveBar() {
  const form = useFormContext(forms);
  const changed = useFormState(form, (state) => state.dirty);
  const canUndo = useFormState(form, (state) => history.formMeta(state).canUndo);
  return (
    <div>
      <button type="button" disabled={!canUndo} onClick={() => form.plugins.history.undo()}>
        Undo
      </button>
      <button type="submit" disabled={!changed}>
        Save
      </button>
    </div>
  );
}
