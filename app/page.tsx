import { CinematicHero } from "@/components/CinematicHero";

export default function Home() {
  return (
    <main className="relative w-full min-h-screen min-h-[100dvh] bg-black overflow-x-hidden">
      <CinematicHero />
      {/* Follow-up section allowing scroll to release the pinned hero cleanly */}
      <section className="relative w-full min-h-screen min-h-[100dvh] bg-black" />
    </main>
  );
}
