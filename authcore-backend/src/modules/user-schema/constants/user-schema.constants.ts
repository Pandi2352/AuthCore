import {
  AttributeDataType as T,
  AttributeKind,
  AttributeMutability as M,
  AttributeReturned as R,
} from '../enums/user-schema.enum';

/** Variable names: snake_case, e.g. employee_id. */
export const ATTRIBUTE_NAME_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;
export const ATTRIBUTE_NAME_MAX_LENGTH = 50;
/** OpenID Connect scopes and custom ones, e.g. profile, hr:read. */
export const SCOPE_PATTERN = /^[a-z][a-z0-9_:.-]{1,49}$/;
export const LOCALE_PATTERN = /^[a-z]{2,3}(-[A-Z]{2})?$/;
export const MOBILE_PATTERN = /^\+[1-9]\d{6,14}$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const MAX_OPTIONS = 200;
export const MAX_LIST_ITEMS = 20;
export const DEFAULT_TEXT_MAX_LENGTH = 255;
export const DEFAULT_TEXTAREA_MAX_LENGTH = 2000;
/** Max bytes of attribute claims added to an access token. */
export const MAX_TOKEN_CLAIMS_BYTES = 2048;
export const SCHEMA_CACHE_TTL_MS = 15_000;

export const STANDARD_SCOPES = [
  'openid',
  'profile',
  'email',
  'phone',
  'address',
] as const;
export const SUPPORTED_LOCALES = [
  'en',
  'en-US',
  'en-GB',
  'en-IN',
  'hi',
  'ta',
  'te',
  'kn',
  'ml',
  'fr',
  'de',
  'es',
  'ar',
  'ja',
  'zh',
] as const;

/** Data types each kind of constraint applies to. */
export const LENGTH_TYPES: readonly T[] = [
  T.Text,
  T.TextArea,
  T.Email,
  T.Url,
  T.Mobile,
];
export const OPTION_TYPES: readonly T[] = [T.Dropdown, T.MultiSelect];
/** Types that can serve as a sign-in identifier (isUsername). */
export const USERNAME_TYPES: readonly T[] = [
  T.Text,
  T.Email,
  T.Mobile,
  T.Number,
];

/**
 * Seeded system variables: the OpenID Connect standard claims. Core ones map
 * to built-in user fields (their values live there, not in `attributes`).
 */
export interface SystemAttribute {
  name: string;
  label: string;
  description: string;
  kind: AttributeKind;
  dataType?: T;
  scopes: string[];
  coreField?:
    | 'email'
    | 'isEmailVerified'
    | 'firstName'
    | 'lastName'
    | 'username'
    | 'password';
  mutability?: M;
  returned?: R;
  isPassword?: boolean;
  isMatchEnabled?: boolean;
  matchWith?: string;
  isUnique?: boolean;
  isUsername?: boolean;
  options?: { value: string; label: string }[];
  maxLength?: number;
  children?: SystemAttribute[];
}

const field = (
  name: string,
  label: string,
  dataType: T,
  scopes: string[],
  extra: Partial<SystemAttribute> = {},
): SystemAttribute => ({
  name,
  label,
  description: extra.description ?? `OpenID Connect standard claim "${name}"`,
  kind: AttributeKind.Field,
  dataType,
  scopes,
  ...extra,
});

export const SYSTEM_ATTRIBUTES: readonly SystemAttribute[] = [
  field('given_name', 'Given Name', T.Text, ['profile'], {
    coreField: 'firstName',
    maxLength: 50,
  }),
  field('family_name', 'Family Name', T.Text, ['profile'], {
    coreField: 'lastName',
    maxLength: 50,
  }),
  field('middle_name', 'Middle Name', T.Text, ['profile'], { maxLength: 50 }),
  field('nickname', 'Nick Name', T.Text, ['profile'], { maxLength: 50 }),
  field('preferred_username', 'Username', T.Text, ['profile'], {
    coreField: 'username',
    isUnique: true,
    isUsername: true,
  }),
  field('profile', 'Profile', T.Url, ['profile'], {
    description: 'URL of the profile page',
  }),
  field('picture', 'Picture', T.Url, ['profile'], {
    description: 'URL of the profile picture',
  }),
  field('website', 'Website', T.Url, ['profile']),
  field('email', 'Email', T.Email, ['email'], {
    coreField: 'email',
    mutability: M.ReadOnly,
    isUnique: true,
    isUsername: true,
    description: 'Sign-in email (change it with POST /users/me/email/change)',
  }),
  field('email_verified', 'Email Verified', T.Boolean, ['email'], {
    coreField: 'isEmailVerified',
    mutability: M.ReadOnly,
  }),
  field('gender', 'Gender', T.Dropdown, ['profile'], {
    options: [
      { value: 'female', label: 'Female' },
      { value: 'male', label: 'Male' },
      { value: 'non_binary', label: 'Non-binary' },
      { value: 'prefer_not_to_say', label: 'Prefer not to say' },
    ],
  }),
  field('birthdate', 'Birth Date', T.Date, ['profile']),
  field('zoneinfo', 'Zone', T.Text, ['profile'], {
    description: 'IANA time zone, e.g. Asia/Kolkata',
    maxLength: 64,
  }),
  field('locale', 'Locale', T.Text, ['profile'], {
    description: 'BCP 47 language tag, e.g. en-IN',
    maxLength: 10,
  }),
  field('phone_number', 'Phone Number', T.Mobile, ['phone']),
  field(
    'phone_number_verified',
    'Phone Number Verified',
    T.Boolean,
    ['phone'],
    { mutability: M.ReadOnly },
  ),
  {
    name: 'address',
    label: 'Address',
    description: 'OpenID Connect standard claim "address"',
    kind: AttributeKind.Group,
    scopes: ['address'],
    children: [
      field('formatted', 'Formatted', T.TextArea, ['address'], {
        maxLength: 500,
      }),
      field('street_address', 'Street Address', T.TextArea, ['address'], {
        maxLength: 300,
      }),
      field('locality', 'Locality', T.Text, ['address'], { maxLength: 100 }),
      field('region', 'Region', T.Text, ['address'], { maxLength: 100 }),
      field('postal_code', 'Postal Code', T.Text, ['address'], {
        maxLength: 20,
      }),
      field('country', 'Country', T.Text, ['address'], { maxLength: 100 }),
    ],
  },
  field('password', 'Password', T.Text, ['openid'], {
    coreField: 'password',
    isPassword: true,
    mutability: M.WriteOnly,
    returned: R.Never,
    description: 'Sign-in password (set with the password endpoints)',
  }),
  field('confirm_password', 'Confirm Password', T.Text, ['openid'], {
    isPassword: true,
    isMatchEnabled: true,
    matchWith: 'password',
    mutability: M.WriteOnly,
    returned: R.Never,
    description: 'Form-only: must match password; never stored',
  }),
];
