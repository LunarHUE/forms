/** Returns a function that throws, standing in for an export whose implementation is not written yet. */
export function notImplemented(name: string): never {
  // The contract types each stub through its declared type, so this cast is the only one.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return ((): never => {
    throw new Error(`@lunarhue/forms-react: ${name} is not implemented yet.`);
  }) as never;
}
