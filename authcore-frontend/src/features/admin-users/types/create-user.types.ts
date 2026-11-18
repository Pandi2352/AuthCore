/** A user schema variable as the create form gets it (GET /admin/users/create-config). */
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

export interface CoreFieldSetting {
  label: string;
  isEnabled: boolean;
  isRequired: boolean;
  maxLength: number | null;
}

export interface PasswordRequirements {
  minimumLength: number;
  maximumLength: number;
  minimumDigitCount: number;
  minimumSpecialCharacterCount: number;
  minimumUppercaseCount: number;
  minimumLowercaseCount: number;
  allowWhitespace: boolean;
  maximumRepeatedCharacters: number;
  /** Ready-to-show sentences. */
  rules: string[];
}

/** GET /admin/users/create-config */
export interface CreateUserConfig {
  coreFields: Record<'firstName' | 'lastName' | 'username', CoreFieldSetting>;
  attributes: FormAttribute[];
  passwordRequirements: PasswordRequirements;
  defaults: { mustChangePassword: boolean; isEmailVerified: boolean; sendWelcomeEmail: boolean };
  canAssignGroups: boolean;
}

/** POST /admin/users */
export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName?: string;
  username?: string;
  password: string;
  mustChangePassword: boolean;
  isEmailVerified: boolean;
  sendWelcomeEmail: boolean;
  groupIds?: string[];
  attributes?: Record<string, unknown>;
}

export interface CreatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
}

export interface Availability {
  isEmailAvailable: boolean | null;
  isUsernameAvailable: boolean | null;
}

export interface GroupOption {
  id: string;
  label: string;
  parentId?: string | null;
}
