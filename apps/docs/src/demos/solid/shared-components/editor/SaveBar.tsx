import { useFormContext } from "@lunarhue/forms-solid";
import { history } from "@lunarhue/forms-solid/plugins";
import { forms } from "./forms";

// Works under any form from `forms`, whatever its definition. Its type knows
// the shared plugins, so `form.plugins.history` type-checks.
export function SaveBar() {
  const form = useFormContext(forms);
  return (
    <div>
      <button
        type="button"
        disabled={!history.formMeta(form.state).canUndo}
        onClick={() => form.plugins.history.undo()}
      >
        Undo
      </button>
      <button type="submit" disabled={!form.state.dirty}>
        Save
      </button>
    </div>
  );
}
