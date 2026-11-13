import { HibiLogo } from "@/components/brand/hibi-logo";

/* Auth, Linear/Vercel-style: one narrow column on the ground, everything on
   ONE left edge — logo, heading, labels, fields, buttons, footer. (Centred
   titles over left-aligned fields read as two axes, i.e. misaligned.) */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-[340px] flex-col gap-10">
        <HibiLogo size={22} />
        <div>{children}</div>
      </div>
    </main>
  );
}
