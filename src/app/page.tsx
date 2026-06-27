import Image from "next/image";
import Link from "next/link";
import { TypewriterQuote } from "@/components/TypewriterQuote";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <TypewriterQuote />

        <Image
          src="/zostel-logo.avif"
          alt="Zostel"
          width={48}
          height={48}
          className="mx-auto mb-4 animate-spin"
          style={{ animationDuration: "6s", animationTimingFunction: "linear" }}
        />
        <p className="mb-6 text-center text-sm text-zinc-400">ZoCo by Zostel</p>

        <h1 className="mb-3 text-center text-2xl font-semibold text-white">
          Find the right Zostel for your trip.
        </h1>

        <p className="mb-10 text-center text-base leading-relaxed text-zinc-400">
          Answer five quick questions about your travel style and we&apos;ll match you to Zostel
          properties that fit.
        </p>

        <Link
          href="/intake"
          className="block w-full rounded-lg bg-[#E84B2B] px-6 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-[#c73b1f]"
        >
          Find my stay →
        </Link>

        <p className="mt-4 text-center text-xs text-zinc-600">Takes about 30 seconds.</p>
      </div>
    </main>
  );
}
