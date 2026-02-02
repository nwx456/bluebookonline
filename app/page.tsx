import Link from "next/link";
import { HeaderNav } from "@/components/HeaderNav";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <span className="font-semibold text-gray-900">Bluebook Online</span>
          <HeaderNav />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-xl text-center">
          <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
            Bluebook Online
          </h1>
          <p className="mt-2 text-gray-600">
            Academic, trusted learning platform. Sign in or sign up to continue.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="rounded-md border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-[#1B365D] px-5 py-3 text-sm font-medium text-white hover:bg-[#152a4a]"
            >
              Sign up
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
