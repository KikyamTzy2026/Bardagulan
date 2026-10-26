import Link from "next/link";

export function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-black tracking-tight neon-text">
          BARDAGULAN <span className="text-neon-blue">2100</span>
        </Link>
        <nav className="flex gap-4 text-sm text-white/70">
          <Link href="/library" className="hover:text-white">Library</Link>
          <Link href="/privacy" className="hover:text-white">Privacy</Link>
        </nav>
      </header>
      <main className={`mx-auto w-full flex-1 px-4 pb-16 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
        {children}
      </main>
      <footer className="px-4 pb-6 text-center text-xs text-white/40">
        Walang personalan, bardagulan lang. Pang-office party lang ito. Be kind, be funny. 💜
      </footer>
    </div>
  );
}
