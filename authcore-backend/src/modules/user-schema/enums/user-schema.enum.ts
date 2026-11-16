/** A single value, or a group of child variables (like `address`). */
export enum AttributeKind {
  Field = 'FIELD',
  Group = 'GROUP',
}

export enum AttributeDataType {
  Text = 'TEXT',
  TextArea = 'TEXTAREA',
  Email = 'EMAIL',
  /** E.164, e.g. +919876543210 */
  Mobile = 'MOBILE',
  Number = 'NUMBER',
  Boolean = 'BOOLEAN',
  /** YYYY-MM-DD */
  Date = 'DATE',
  /** ISO 8601 date and time */
  DateTime = 'DATETIME',
  Url = 'URL',
  /** One value from `options` */
  Dropdown = 'DROPDOWN',
  /** Several values from `options` */
  MultiSelect = 'MULTI_SELECT',
}

/** Field Group Type: one nested object, or a list of them (e.g. several addresses). */
export enum AttributeGroupType {
  Object = 'OBJECT',
  List = 'LIST',
}

/** Who may write the value (SCIM-style). */
export enum AttributeMutability {
  /** User and admins. */
  ReadWrite = 'READ_WRITE',
  /** Only admins write; users read. */
  ReadOnly = 'READ_ONLY',
  /** Set once; never changed afterwards. */
  Immutable = 'IMMUTABLE',
  /** Can be written, never returned (e.g. secrets). */
  WriteOnly = 'WRITE_ONLY',
}

/** When the value appears in responses (SCIM-style). */
export enum AttributeReturned {
  Always = 'ALWAYS',
  Default = 'DEFAULT',
  /** Only when asked for with ?include=name */
  Request = 'REQUEST',
  Never = 'NEVER',
}
