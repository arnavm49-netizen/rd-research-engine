import { Sidebar } from "@/components/layout/sidebar";

// All authenticated pages are user-specific and read from the database at request time.
// Force dynamic rendering so Next.js doesn't try to prerender them at build time
// (the DB schema is only present after `prisma db push` runs at startup, not build).
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">{children}</main>
    </div>
  );
}
