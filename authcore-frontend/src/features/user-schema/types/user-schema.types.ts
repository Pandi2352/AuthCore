/** A single value, or a group of child variables (like `address`). */
export type AttributeKind = 'FIELD' | 'GROUP';

export type AttributeDataType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'EMAIL'
  | 'MOBILE'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATETIME'
  | 'URL'
  | 'DROPDOWN'
  | 'MULTI_SELECT';

/** One nested object, or a list of them (e.g. several addresses). */
export type AttributeGroupType = 'OBJECT' | 'LIST';
export type AttributeMutability = 'READ_WRITE' | 'READ_ONLY' | 'IMMUTABLE' | 'WRITE_ONLY';
export type AttributeReturned = 'ALWAYS' | 'DEFAULT' | 'REQUEST' | 'NEVER';

export interface AttributeOption {
  value: string;
  label: string;
}

/** A user schema variable (GET /user-schema/attributes?flat=true). */
export interface SchemaAttribute {
  id: string;
  name: string;
  label: string;
  description: string;
  kind: AttributeKind;
  dataType: AttributeDataType | null;
  groupType: AttributeGroupType | null;
  parentId: string | null;
  options: AttributeOption[];
  minLength: number | null;
  maxLength: number | null;
  min: number | null;
  max: number | null;
  scopes: string[];
  locales: string[];
  isEnabled: boolean;
  isRequired: boolean;
  isInternal: boolean;
  isUsername: boolean;
  isPassword: boolean;
  isUnique: boolean;
  isMatchEnabled: boolean;
  matchWith: string | null;
  includeInToken: boolean;
  includeInSearchFilter: boolean;
  mutability: AttributeMutability;
  returned: AttributeReturned;
  displayOrder: number;
  /** Seeded OpenID Connect claim: structure and security flags are fixed. */
  isSystem: boolean;
  /** Built-in user field the value lives in (email, firstName …). */
  coreField: string | null;
  version: number;
  updatedAt: string;
}

export interface SchemaOptionItem {
  value: string;
  label: string;
}

/** GET /user-schema/options */
export interface SchemaOptions {
  kinds: SchemaOptionItem[];
  dataTypes: SchemaOptionItem[];
  groupTypes: SchemaOptionItem[];
  scopes: SchemaOptionItem[];
  locales: SchemaOptionItem[];
  mutability: SchemaOptionItem[];
  returned: SchemaOptionItem[];
}

/** POST /user-schema/attributes */
export interface CreateAttributeRequest {
  name: string;
  label?: string;
  description?: string;
  kind: AttributeKind;
  dataType?: AttributeDataType;
  groupType?: AttributeGroupType;
  parentId?: string;
  options?: AttributeOption[];
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  scopes: string[];
  locales: string[];
  isEnabled?: boolean;
  isRequired?: boolean;
  isInternal?: boolean;
  isUsername?: boolean;
  isUnique?: boolean;
  includeInToken?: boolean;
  includeInSearchFilter?: boolean;
  mutability?: AttributeMutability;
  returned?: AttributeReturned;
  displayOrder?: number;
}

/** PATCH /user-schema/attributes/:id — name, kind, type and parent are fixed. */
export type UpdateAttributeRequest = Partial<
  Omit<CreateAttributeRequest, 'name' | 'kind' | 'dataType' | 'groupType' | 'parentId'>
> & { version?: number };
