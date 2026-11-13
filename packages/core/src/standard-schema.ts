// A copy of the Standard Schema v1 interface (https://standardschema.dev).
// Core keeps its own copy so it has no dependency on `@standard-schema/spec`.
// The shape must stay identical to the published v1 spec, so any schema
// library that implements the spec fits it.

/** A schema that implements Standard Schema v1. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  /** The Standard Schema properties. */
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

// The namespace holds only types, so it emits no code.
// oxlint-disable-next-line typescript/no-namespace
export declare namespace StandardSchemaV1 {
  /** The Standard Schema properties. */
  export interface Props<Input = unknown, Output = Input> {
    /** The version of the spec. Always 1. */
    readonly version: 1;
    /** The name of the library that made the schema. */
    readonly vendor: string;
    /** Validates an unknown value and returns the result, or a promise of it. */
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
    /** The schema's input and output types. Only types read it. */
    readonly types?: Types<Input, Output> | undefined;
  }

  /** The result of `validate`. */
  export type Result<Output> = SuccessResult<Output> | FailureResult;

  /** A passing result. It has no `issues`. */
  export interface SuccessResult<Output> {
    /** The validated output value. */
    readonly value: Output;
    /** Always undefined on success. */
    readonly issues?: undefined;
  }

  /** A failing result. */
  export interface FailureResult {
    /** One entry per problem the schema found. */
    readonly issues: ReadonlyArray<Issue>;
  }

  /** One problem a schema found. */
  export interface Issue {
    /** The message the schema library wrote. */
    readonly message: string;
    /** Where in the input the problem is. Missing for a problem at the root. */
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }

  /** A path segment written as an object. */
  export interface PathSegment {
    /** The key the segment stands for. */
    readonly key: PropertyKey;
  }

  /** The schema's input and output types. */
  export interface Types<Input = unknown, Output = Input> {
    /** The type the schema accepts. */
    readonly input: Input;
    /** The type the schema produces. */
    readonly output: Output;
  }

  /** The input type of a schema. */
  export type InferInput<Schema extends StandardSchemaV1> = NonNullable<Schema["~standard"]["types"]>["input"];

  /** The output type of a schema. */
  export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<Schema["~standard"]["types"]>["output"];
}
