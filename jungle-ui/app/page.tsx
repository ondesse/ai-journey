import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-3xl px-6 py-24">
        <div className="rounded-3xl border border-zinc-200 bg-white p-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Jungle Coach UI
          </h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-300">
            Enter a Riot ID and view a style profile, draft win-conditions, and a coaching report.
          </p>
          <div className="mt-8">
            <Link
              href="/analyze"
              className="inline-flex items-center justify-center rounded-xl bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-pink-400"
            >
              Open analysis
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
