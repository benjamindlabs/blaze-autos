import { CinematicHero } from "@/components/CinematicHero";

export default function Home() {
  return (
    <main className="relative w-full min-h-screen bg-black overflow-x-hidden">
      <CinematicHero />
      {/* Follow-up section allowing scroll to release the pinned hero cleanly */}
      <section className="relative w-full min-h-screen bg-black" />
    </main>
  );
}
