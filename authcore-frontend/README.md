# 🔐 AuthCore Frontend

### Reusable, production-grade authentication & authorization UI

The companion frontend for **AuthCore Backend**, designed as a plug-and-play IAM (Identity & Access Management) client foundation. When you start a new project, copy this repository and choose which auth flows, APIs, and screens you want to enable.

---

## 🧰 Tech Stack

| Technology              | Version | Purpose                                              |
| ----------------------- | ------- | ---------------------------------------------------- |
| ⚡ **Vite**             | 8.x     | Next-gen lightning-fast dev server and bundler       |
| ⚛️ **React**            | 19.x    | Modern UI runtime                                    |
| 📘 **TypeScript**       | 7.x     | Strict type safety and autocompletion                |
| 🎨 **Tailwind CSS**     | 4.x     | CSS-first utility framework with `@tailwindcss/vite` |
| 🧭 **React Router DOM** | 7.x     | Client-side routing, route guards, layouts           |
| 🔣 **Lucide React**     | 1.x     | Lightweight, consistent iconography                  |

---

## 📁 Project Structure

```text
authcore-frontend/
├── src/
│   ├── components/
│   │   ├── auth/              # Route guards and auth widgets
│   │   │   ├── GuestRoute.tsx
│   │   │   ├── PasswordRequirements.tsx
│   │   │   ├── PermissionGate.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   └── common/            # Reusable UI primitives
│   │       ├── Alert.tsx
│   │       ├── Badge.tsx
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Input.tsx
│   │       ├── Layout.tsx
│   │       └── Navbar.tsx
│   ├── config/
│   │   └── project.ts         # Branding, app identity & feature toggles
│   ├── context/
│   │   └── AuthContext.tsx    # Auth state, login/logout, session lifecycle
│   ├── hooks/
│   │   └── usePermissions.ts  # RBAC & permissions checking helper
│   ├── lib/
│   │   ├── api-client.ts      # Fetch client with auto-refresh queue & errors
│   │   └── utils.ts           # Class merging (clsx + tailwind-merge)
│   ├── pages/
│   │   ├── account/           # Profile, Security, Sessions, Activity
│   │   ├── auth/              # Login, Register, Verify, Forgot/Reset Password, Recovery
│   │   ├── dashboard/         # Authenticated home dashboard
│   │   └── NotFound.tsx       # 404 handler
│   ├── router/
│   │   └── index.tsx          # Application route definitions
│   ├── services/              # Modular backend API adapters
│   │   ├── access-control.service.ts
│   │   ├── account.service.ts
│   │   └── auth.service.ts
│   ├── types/                 # TypeScript interfaces matching backend DTOs
│   │   ├── access-control.ts
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   ├── session.ts
│   │   └── user.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css              # Tailwind v4 entry (@import "tailwindcss";)
├── vite.config.ts             # Dev proxy (/api/v1 → http://localhost:3000)
├── tsconfig.app.json          # TS config with path alias (@/*)
└── .env.example
```

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
cd authcore-frontend
npm install
```

### 2. Configure Environment

Create `.env` (optional, defaults to proxying `/api/v1` to `http://localhost:3000/api/v1`):

```bash
cp .env.example .env
```

### 3. Start Development Server

```bash
npm run dev
```

The app runs at [http://localhost:5173](http://localhost:5173). Requests to `/api` are automatically proxied to the backend at `http://localhost:3000`.

### 4. Build for Production

```bash
npm run build
```

---

## 🔑 How Authentication Works

1. **Access Token in Memory**: Access tokens are kept in JavaScript memory inside `apiClient` and never written to localStorage or sessionStorage (protecting against XSS token theft).
2. **Refresh Token in HttpOnly Cookie**: Handled by the backend (`authcore_refresh` cookie) with `credentials: 'include'`. JavaScript cannot read it.
3. **Silent Auto-Refresh Queue**: If an API request returns `401 AUTH_ACCESS_TOKEN_EXPIRED`, the `apiClient` automatically calls `POST /api/v1/auth/refresh`. Multiple concurrent requests are queued and re-executed once the refresh finishes without redundant refresh calls.
4. **Instant Invalidation**: When a user logs out or a session is revoked, the token is cleared and session state immediately resets across tabs.

---

## 🛠️ Customizing for an Upcoming Project

When adopting this repo for a new project:

### 1. Configure Project Branding & Features (`src/config/project.ts`)

```ts
export const projectConfig = {
  name: 'Your Project Name',
  slug: 'your-project',
  branding: {
    primaryColor: '#4f46e5',
    logoUrl: '/logo.svg',
    companyName: 'Acme Corp',
    supportEmail: 'help@acme.com',
  },
  features: {
    allowRegistration: true,
    registrationFlow: 'otp', // 'otp' | 'link' | 'none' | 'approval'
    loginIdentifiers: ['email', 'username'],
    enableRememberMe: true,
    enableSessionsPage: true,
    enableActivityPage: true,
  },
};
```

### 2. Choose Your Routes (`src/router/index.tsx`)

Pick the pages your project requires:

- Simple App: Only keep `/login`, `/register`, `/forgot-password`, `/dashboard`.
- Complete IAM App: Keep all routes (active sessions, security, device history, recovery).

### 3. Protect Your Own Components

```tsx
import { PermissionGate } from '@/components/auth/PermissionGate';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

function MyFeature() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();

  return (
    <div>
      <p>Hello, {user?.firstName}!</p>

      {/* Conditionally show actions based on RBAC permissions */}
      <PermissionGate permission="USER_CREATE">
        <button>Add New User</button>
      </PermissionGate>
    </div>
  );
}
```
