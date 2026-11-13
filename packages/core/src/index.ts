export { createFormsCore } from "./forms-core.js";
export { branch } from "./store/branch.js";
export { splitPath } from "./path.js";
export { encodeSegment, errorId, fieldId, optionId } from "./store/ids.js";

// The meta interfaces are declared here, in the entry module itself, because
// module augmentation of "@lunarhue/forms-core" only reaches an interface the
// entry module declares, not one it re-exports.

/**
 * Per-field plugin state, by plugin name. It starts empty. A plugin adds its
 * slot with module augmentation:
 *
 *     declare module "@lunarhue/forms-core" {
 *       interface FieldMeta {
 *         readonly upload: { readonly progress: number };
 *       }
 *     }
 */
// oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type
export interface FieldMeta {}

/** Form-wide plugin state, by plugin name. A plugin adds its slot the same way as on `FieldMeta`. */
// oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type
export interface FormMeta {}

export type {
  AnyPlugin,
  Plugin,
  PluginContext,
  PluginDefinition,
  PluginErrorHandler,
  PluginHooks,
  When,
  Write,
  WriteCause,
  WriteRecord,
} from "./plugin.js";
export type { Path, PathSegment } from "./path.js";
export type { StandardSchemaV1 } from "./standard-schema.js";
export type { Choice, ChoiceHandle, ChoiceValue, HasChoice, WithChoice } from "./choice.js";
export type {
  AbortSignalLike,
  ChildValue,
  DeepPartial,
  DeepReadonly,
  Draft,
  IsUnknown,
  ItemOf,
  KeysOf,
  LeafValue,
  PlatformAbortSignal,
  PlatformBlob,
  PlatformFile,
  ShapeOf,
} from "./value.js";
export type {
  ErrorMap,
  FormError,
  Many,
  MapError,
  RawError,
  RawSchemaError,
  RawThrownError,
  Show,
  ShowContext,
  ShowMode,
} from "./errors.js";
export type {
  FieldValidators,
  FormValidator,
  FormValidatorInput,
  FormValidatorOptions,
  FormValidatorResult,
  NestedValidators,
  ValidateTiming,
  Validator,
  ValidatorContext,
  ValidatorInput,
  ValidatorOptions,
  ValidatorRecord,
  ValidatorResult,
} from "./validator.js";
export type {
  ArraySnapshotMembers,
  FieldSnapshot,
  FieldSnapshotBase,
  FormSnapshot,
  Submission,
  UnknownSnapshotMembers,
} from "./snapshot.js";
export type {
  AnyFieldHandle,
  ArrayHandle,
  Branch,
  ChildHandles,
  ErrorOf,
  FieldHandle,
  HandleBase,
  HandleTypes,
  ItemHandle,
  LeafHandle,
  MergeOptions,
  Narrow,
  ObjectHandle,
  Patch,
  ReplaceOptions,
  ResetOptions,
  ValueOf,
  WriteOptions,
} from "./handle.js";
export type { AnyFormStore, Change, DisabledInvalid, FormStore, IntentArgs } from "./store.js";
export type { AdapterSchema, HasAdapter, SchemaAdapter } from "./schema-adapter.js";
export type {
  CreateFormsCore,
  DefinedValue,
  Definition,
  DefinitionOptions,
  Equals,
  Flags,
  FormDefinition,
  FormsConfig,
  FormsCore,
  NestedFlags,
  PlainDefinition,
  SchemaDefinition,
  SchemaValue,
  StoreInstance,
  SubmitContext,
} from "./definition.js";
export type { Rebase, RebaseChoice, RebaseLeaf, RebaseResult, Resolve } from "./rebase.js";
