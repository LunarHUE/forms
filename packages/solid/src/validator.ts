import { getOwner, onCleanup } from "solid-js";

/** What `addValidator` calls on a handle. */
interface RegistersValidators {
  registerValidator(validator: unknown): () => void;
}

/** See `CreateValidator`. With no owner the validator stays for the life of the store. */
export function addValidator(handle: RegistersValidators, validator: unknown): void {
  if (validator === undefined || validator === null || validator === false) return;
  const remove = handle.registerValidator(validator);
  if (getOwner() !== null) onCleanup(remove);
}
