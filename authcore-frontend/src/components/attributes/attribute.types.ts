/**
 * A user schema variable as a form gets it (GET /admin/users/create-config, GET /user-schema/form).
 */
export interface FormAttribute {
  id: string;
  name: string;
  label: string;
  description: string;
  kind: 'FIELD' | 'GROUP';
  dataType:
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
    | 'MULTI_SELECT'
    | null;
  groupType: 'OBJECT' | 'LIST' | null;
  options: Array<{ value: string; label: string }>;
  minLength: number | null;
  maxLength: number | null;
  min: number | null;
  max: number | null;
  isRequired: boolean;
  isInternal: boolean;
  /** Seeded OpenID Connect claim (middle_name, gender, address …). */
  isSystem: boolean;
  isUnique: boolean;
  mutability: 'READ_WRITE' | 'READ_ONLY' | 'IMMUTABLE' | 'WRITE_ONLY';
  displayOrder: number;
  children?: FormAttribute[];
}
