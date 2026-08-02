# i-SMARTLUPUS-MEDI

Sistem Pelupusan Aset Hospital Besut (Hospital Besut Asset Disposal System).
Built with Next.js 14, Supabase, and Tailwind CSS.

## Overview

i-SMARTLUPUS-MEDI is a PWA designed for Malaysian government hospitals to track the lifecycle of medical asset disposal:
1.  **Permohonan**: Hospital staff submit disposal requests.
2.  **Semakan**: Unit Aset officers review and approve/reject requests.
3.  **Pelaksanaan**: Approved requests move to the disposal process.
4.  **Sijil**: Official disposal certificates are generated upon completion.

## Security Model

The system enforces a strict security boundary:
- **Role Immutability**: Users cannot change their own roles.
- **Audited Transitions**: All ticket status changes are performed via SECURITY DEFINER database functions (RPCs) that automatically write to an immutable audit trail.
- **Storage Authorization**: Access to asset photos and certificates is restricted via RLS policies and served via signed URLs.
- **Admin Hardening**: User registration is restricted to admins and includes server-side validation and atomic rollbacks.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS (Emerald/Slate theme).
- **Backend**: Supabase (Auth, PostgreSQL, Storage, Edge Functions/RPC).
- **UI Components**: Lucide React, Radix UI, Sonner (Toasts), Recharts (Analytics).
- **PDF Generation**: jsPDF.

## Local Development

### Prerequisites

- Node.js 18+
- Supabase CLI
- Local `.env.local` file (see `.env.local.example`)

### Setup

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Set up Supabase:
    ```bash
    supabase start
    ```
4.  Apply migrations:
    ```bash
    supabase db reset
    ```
5.  Run the development server:
    ```bash
    npm run dev
    ```

### Environment Variables

Required variables in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Used for admin registration API)

## Role Model

- **Pengguna (`user`)**: Can create and view their own disposal requests.
- **Unit Aset (`unit_aset`)**: Can review, approve, reject, and complete any disposal request.
- **Pentadbir (`admin`)**: Can manage users and has all `unit_aset` privileges.

## Verification

Before pushing changes, run the following:

```bash
npm run lint      # Check for code quality issues
npm test          # Run Vitest suite
npx tsc --noEmit  # Check for TypeScript errors
npm run build     # Verify production build
```

## Design System

The app follows the "Impeccable" design standard:
- **Brand**: Emerald-600 Primary.
- **Aesthetic**: Institutional, clean, high-contrast.
- **Typography**: Inter (16px body floor for iOS).
- **Components**: Flat lists, Bento grid dashboard, stamp-style chips.

---
© 2026 i-SMARTLUPUS Team. Official Government Tool.
