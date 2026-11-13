/** Returns a function that throws, standing in for an export whose implementation is not written yet. */
export function notImplemented(name: string): never {
  const fail = () => {
    throw new Error(`@lunarhue/forms-solid: ${name} is not implemented yet.`);
  };
  // The stand-in only has to fail when called. Its declared type is the contract's.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return fail as never;
}
