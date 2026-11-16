/**
 * Email texts. Every language implements MailMessages; values from users
 * (names, reasons, messages) are passed in and HTML-escaped by the renderer.
 * Add a language: copy this file, translate, register it in mail-locales.ts.
 */
export interface MailMessages {
  /** BCP 47 code used for date formatting, e.g. "en-GB". */
  dateLocale: string;
  common: {
    greeting: (name: string) => string;
    greetingAnonymous: string;
    reason: (reason: string) => string;
    message: (message: string) => string;
    notYou: string;
    expiresIn: (minutes: number) => string;
    contactSupport: string;
  };
  verificationCode: {
    subject: (code: string, app: string) => string;
    heading: string;
    intro: (app: string, minutes: number) => string;
    footer: string;
  };
  verificationLink: {
    subject: (app: string) => string;
    heading: string;
    intro: (app: string, minutes: number) => string;
    button: string;
    footer: string;
  };
  pendingApproval: {
    subject: (app: string) => string;
    heading: string;
    body: (app: string) => string;
  };
  accountApproved: {
    subject: (app: string) => string;
    heading: string;
    body: (app: string) => string;
  };
  accountRejected: {
    subject: (app: string) => string;
    heading: string;
    body: (app: string) => string;
  };
  passwordResetCode: {
    subject: (code: string, app: string) => string;
    heading: string;
    intro: (app: string, minutes: number) => string;
    footer: string;
  };
  passwordResetLink: {
    subject: (app: string) => string;
    heading: string;
    intro: (app: string, minutes: number) => string;
    button: string;
    footer: string;
  };
  passwordChanged: {
    subjectReset: (app: string) => string;
    subjectChanged: (app: string) => string;
    headingReset: string;
    headingChanged: string;
    bodyReset: (app: string) => string;
    bodyChanged: (app: string) => string;
    footer: string;
  };
  passwordExpiry: {
    tomorrow: string;
    inDays: (days: number) => string;
    subject: (app: string, when: string) => string;
    heading: string;
    body: (app: string, when: string, date: string) => string;
    footer: string;
  };
  emailChangeCode: {
    subject: (code: string, app: string) => string;
    heading: string;
    intro: (app: string) => string;
    footer: string;
  };
  emailChanged: {
    subject: (app: string) => string;
    heading: string;
    body: (app: string, newEmail: string) => string;
  };
  accountDeactivated: {
    subject: (app: string) => string;
    heading: string;
    body: string;
  };
  deletionScheduled: {
    subject: (app: string) => string;
    heading: string;
    body: (date: string) => string;
    undo: string;
  };
  recoveryCode: {
    subject: (code: string, app: string) => string;
    heading: string;
    intro: (app: string) => string;
    footer: string;
  };
  recovered: {
    subject: (app: string) => string;
    heading: string;
    body: string;
  };
  statusChanged: {
    subject: (app: string, heading: string) => string;
    headings: Record<'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'INACTIVE', string>;
    bodies: Record<'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'INACTIVE', string>;
  };
  adminCreated: {
    subject: (app: string) => string;
    heading: string;
    body: (app: string, email: string) => string;
    mustChange: string;
  };
  invite: {
    subject: (inviter: string, app: string) => string;
    heading: string;
    intro: (inviter: string, app: string, date: string) => string;
    button: string;
    footer: string;
  };
  passwordSetByAdmin: {
    subject: (app: string) => string;
    heading: string;
    body: string;
    mustChange: string;
  };
  newDevice: {
    subject: (app: string) => string;
    heading: string;
    intro: string;
    when: (value: string) => string;
    device: (value: string) => string;
    ip: (value: string) => string;
    ifYou: string;
    footer: string;
  };
  accountLocked: {
    subject: (app: string) => string;
    heading: string;
    body: (attempts: number, ip: string) => string;
    retry: (until: string) => string;
    forgot: string;
    footer: string;
  };
}

export const EN_MESSAGES: MailMessages = {
  dateLocale: 'en-GB',
  common: {
    greeting: (name) => `Hi ${name},`,
    greetingAnonymous: 'Hi there,',
    reason: (reason) => `Reason: ${reason}`,
    message: (message) => `Message: ${message}`,
    notYou: "If you didn't do this, contact support right away.",
    expiresIn: (minutes) => `It expires in ${String(minutes)} minutes.`,
    contactSupport: 'Questions? Contact support.',
  },
  verificationCode: {
    subject: (code, app) => `${code} is your ${app} verification code`,
    heading: 'Verify your email',
    intro: (app, minutes) =>
      `Use this code to verify your email address for ${app}. It expires in ${String(minutes)} minutes.`,
    footer:
      "If you didn't create an account, you can ignore this email. Never share this code with anyone.",
  },
  verificationLink: {
    subject: (app) => `Verify your email for ${app}`,
    heading: 'Verify your email',
    intro: (app, minutes) =>
      `Confirm your email address for ${app} with the button below. The link expires in ${String(minutes)} minutes and works once.`,
    button: 'Verify email',
    footer: "If you didn't create an account, you can ignore this email.",
  },
  pendingApproval: {
    subject: (app) => `Your ${app} account is waiting for approval`,
    heading: 'Account pending approval',
    body: (app) =>
      `Thanks for registering with ${app}. Your account is waiting for approval by an administrator. We'll email you as soon as it has been reviewed.`,
  },
  accountApproved: {
    subject: (app) => `Your ${app} account has been approved`,
    heading: 'Account approved',
    body: (app) =>
      `Good news: your ${app} account has been approved. You can now sign in.`,
  },
  accountRejected: {
    subject: (app) => `Your ${app} registration was not approved`,
    heading: 'Registration not approved',
    body: (app) => `Your registration for ${app} was not approved.`,
  },
  passwordResetCode: {
    subject: (code, app) => `${code} is your ${app} password reset code`,
    heading: 'Reset your password',
    intro: (app, minutes) =>
      `Use this code to reset your ${app} password. It expires in ${String(minutes)} minutes.`,
    footer:
      "If you didn't ask to reset your password, ignore this email: your password stays the same. Never share this code with anyone.",
  },
  passwordResetLink: {
    subject: (app) => `Reset your ${app} password`,
    heading: 'Reset your password',
    intro: (app, minutes) =>
      `Reset your ${app} password with the button below. The link expires in ${String(minutes)} minutes and works once.`,
    button: 'Reset password',
    footer:
      "If you didn't ask to reset your password, ignore this email: your password stays the same.",
  },
  passwordChanged: {
    subjectReset: (app) => `Your ${app} password was reset`,
    subjectChanged: (app) => `Your ${app} password was changed`,
    headingReset: 'Password reset',
    headingChanged: 'Password changed',
    bodyReset: (app) =>
      `Your ${app} password was reset. For your security, you have been signed out on all devices.`,
    bodyChanged: (app) =>
      `Your ${app} password was changed. For your security, you have been signed out on your other devices.`,
    footer:
      "If you didn't do this, reset your password right away and contact support.",
  },
  passwordExpiry: {
    tomorrow: 'tomorrow',
    inDays: (days) => `in ${String(days)} days`,
    subject: (app, when) => `Your ${app} password expires ${when}`,
    heading: 'Your password expires soon',
    body: (app, when, date) =>
      `Your ${app} password expires ${when} (${date}). Change it before then to keep signing in without interruption.`,
    footer: 'You can change your password from your account settings.',
  },
  emailChangeCode: {
    subject: (code, app) => `${code} is your ${app} email change code`,
    heading: 'Confirm your new email address',
    intro: (app) =>
      `Use this code to confirm this address as your new ${app} sign-in email.`,
    footer: "If you didn't ask for this, ignore this email: nothing changes.",
  },
  emailChanged: {
    subject: (app) => `Your ${app} email address was changed`,
    heading: 'Email address changed',
    body: (app, newEmail) =>
      `The sign-in email of your ${app} account was changed to ${newEmail}. This address will no longer receive account emails.`,
  },
  accountDeactivated: {
    subject: (app) => `Your ${app} account was deactivated`,
    heading: 'Account deactivated',
    body: 'Your account was deactivated and you were signed out on all devices. You can reactivate it any time with account recovery.',
  },
  deletionScheduled: {
    subject: (app) => `Your ${app} account will be deleted`,
    heading: 'Account deletion scheduled',
    body: (date) =>
      `As requested, your account and its data will be permanently deleted on ${date}. You were signed out on all devices.`,
    undo: 'Changed your mind? Use account recovery before that date to keep your account.',
  },
  recoveryCode: {
    subject: (code, app) => `${code} is your ${app} account recovery code`,
    heading: 'Reactivate your account',
    intro: (app) => `Use this code to reactivate your ${app} account.`,
    footer:
      "If you didn't ask for this, ignore this email: your account stays as it is.",
  },
  recovered: {
    subject: (app) => `Your ${app} account is active again`,
    heading: 'Account reactivated',
    body: 'Your account was reactivated (any scheduled deletion was cancelled). You can sign in again.',
  },
  statusChanged: {
    subject: (app, heading) => `${app}: ${heading.toLowerCase()}`,
    headings: {
      ACTIVE: 'Account activated',
      SUSPENDED: 'Account suspended',
      BANNED: 'Account blocked',
      INACTIVE: 'Account deactivated',
    },
    bodies: {
      ACTIVE: 'Your account is active. You can sign in.',
      SUSPENDED:
        'Your account was suspended by an administrator and you were signed out.',
      BANNED:
        'Your account was blocked by an administrator and you were signed out.',
      INACTIVE:
        'Your account was deactivated by an administrator and you were signed out.',
    },
  },
  adminCreated: {
    subject: (app) => `An ${app} account was created for you`,
    heading: 'Your account is ready',
    body: (app, email) =>
      `An administrator created a ${app} account for ${email}. Your administrator will give you the password.`,
    mustChange:
      'You will be asked to choose your own password when you first sign in.',
  },
  invite: {
    subject: (inviter, app) => `${inviter} invited you to ${app}`,
    heading: "You're invited",
    intro: (inviter, app, date) =>
      `${inviter} invited you to join ${app}. Accept the invitation to create your account. The invitation is valid until ${date}.`,
    button: 'Accept invitation',
    footer: "If you weren't expecting this, you can ignore this email.",
  },
  passwordSetByAdmin: {
    subject: (app) => `Your ${app} password was reset by an administrator`,
    heading: 'Password reset by an administrator',
    body: 'An administrator set a new password for your account and you were signed out. Your administrator will give you the new password.',
    mustChange:
      'You will be asked to choose your own password when you next sign in.',
  },
  newDevice: {
    subject: (app) => `New sign-in to your ${app} account`,
    heading: 'New sign-in from a new device',
    intro:
      "Your account was just signed in to from a device we haven't seen before.",
    when: (value) => `When: ${value}`,
    device: (value) => `Device: ${value}`,
    ip: (value) => `IP address: ${value}`,
    ifYou: 'If this was you, you can ignore this email.',
    footer:
      "If this wasn't you, change your password now and sign out of all devices. You can turn off these alerts in your notification settings.",
  },
  accountLocked: {
    subject: (app) => `Your ${app} account is temporarily locked`,
    heading: 'Account temporarily locked',
    body: (attempts, ip) =>
      `We locked sign-in to your account after ${String(attempts)} failed attempts (last one from IP address ${ip}).`,
    retry: (until) => `You can try again after ${until}.`,
    forgot:
      'If you forgot your password, use "Forgot password" to set a new one.',
    footer:
      "If these attempts weren't you, someone may be trying to get into your account: choose a strong password you don't use anywhere else.",
  },
};
