import { Shell } from "@/components/Shell";
import { HomeForms } from "@/components/HomeForms";

export default function Home() {
  return (
    <Shell>
      <section className="py-8 text-center sm:py-12">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-neon-blue">
          Office Party Game
        </p>
        <h1 className="text-5xl font-black leading-[0.95] tracking-tight neon-text sm:text-7xl">
          OFFICE
          <br />
          BARDAGULAN
          <br />
          <span className="text-neon-pink">2100</span>
        </h1>
        <p className="mt-6 text-xl font-bold text-white/90">
          Walang personalan, bardagulan lang!
        </p>
        <p className="mt-1 text-white/60">
          2,100+ tanong. 21 pangalan. Walang ligtas sa tawanan!
        </p>
      </section>
      <HomeForms />
      <p className="mt-6 text-center text-xs text-white/40">
        Anonymous nicknames lang. Walang email o totoong pangalan na hinihingi. Basahin ang{" "}
        <a href="/privacy" className="underline hover:text-white">Privacy Notice</a>.
      </p>
    </Shell>
  );
}
