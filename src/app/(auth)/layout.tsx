import { HibiLogo } from "@/components/brand/hibi-logo";

/* Linear-style auth: the form straight on the ground, a narrow centred column. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-8 p-6">
      <HibiLogo size={30} />
      <div className="w-full max-w-[340px]">{children}</div>
    </main>
  );
}
