import type { Metadata } from "next";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = { title: "Privacy | OFFICE BARDAGULAN 2100" };

export default function PrivacyPage() {
  return (
    <Shell>
      <h1 className="mb-4 text-3xl font-black neon-text">Privacy Notice</h1>
      <div className="glass space-y-4 rounded-2xl p-6 leading-relaxed text-white/80">
        <p>
          <b className="text-white">Anonymous nicknames lang.</b> Walang email, totoong pangalan, o
          phone number na hinihingi. Pumili ka lang ng nickname sa bawat room.
        </p>
        <p>
          <b className="text-white">Hidden ang boto hanggang i-reveal.</b> Walang nakakakita ng
          resulta (pati host) sa app hanggang pinindot ng host ang Reveal. Hindi ipinapakita kung
          sino ang bumoto kanino, ang bilang lang kada pangalan.
        </p>
        <p>
          <b className="text-white">Host controls ay naka-secure sa server.</b> Hindi mapapalitan ng
          ibang player ang laro kahit i-edit nila ang browser.
        </p>
        <p>
          <b className="text-white">Retention.</b> Active ang room ng 24 oras. Pagkatapos nito
          ay mamarkahan itong expired at buburahin makalipas ang 7 araw, kasama ang mga boto.
        </p>
        <p>
          <b className="text-white">Browser storage.</b> Isang session token lang ang tinatabi
          sa browser mo para hindi ka ma-kick kapag nag-refresh. Walang tracking cookies o ads.
        </p>
        <p className="text-sm text-white/50">
          Paalala: ang nickname ay hindi garantiya ng kumpletong anonymity sa antas ng hosting o
          network (hal. server logs). Para sa tawanan lang ito. Huwag gumamit ng nickname na
          makaka-offend o makaka-identify ng iba.
        </p>
      </div>
    </Shell>
  );
}
