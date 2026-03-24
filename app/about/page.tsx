import type { Metadata } from "next";
import Link from "next/link";
import { HeaderNav } from "@/components/HeaderNav";
import { BookOpen } from "lucide-react";

export const metadata: Metadata = {
  title: "About",
  description:
    "Bluebook Online mimics the real College Board Bluebook exam. Free AP exam practice for students worldwide. AP CSA, CSP, Economics, Calculus.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <header className="border-b border-gray-200 bg-white shadow-sm sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold text-gray-900 hover:text-blue-600 transition-colors">
            <BookOpen className="h-6 w-6 text-blue-600" />
            Bluebook Online
          </Link>
          <HeaderNav />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-12">
        <section className="rounded-2xl bg-gradient-to-b from-white to-gray-50/80 px-6 py-10 shadow-sm border border-gray-100">
          <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">About Bluebook Online</h1>
          <p className="mt-4 text-gray-600 leading-relaxed">
            Bluebook Online mimics the real College Board Bluebook digital exam experience. It is a free educational platform for AP students. We help you practice AP exams by uploading PDFs,
            solving multiple-choice questions, and getting instant scoring. The exam interface and flow are designed to feel familiar if you have used the official Bluebook app.
          </p>
          <p className="mt-4 text-gray-600 leading-relaxed">
            When your PDF has no answer key, our AI can generate one after your first attempt. The key is saved so future attempts use it directly. The platform is designed for students, teachers, and anyone preparing for AP exams. Sign up to upload your own exams,
            solve published ones, and share your practice tests with others.
          </p>

          <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>Not affiliated with College Board.</strong> Bluebook Online is an independent educational tool.
            We are not endorsed by or connected with College Board or AP. For practice only.
          </div>

          <div className="mt-8">
            <h2 className="text-base font-semibold text-gray-900">Contact</h2>
            <p className="mt-2 text-sm text-gray-600">
              Questions or feedback? Email us at{" "}
              <a href="mailto:info@apbluebookonline.com" className="font-medium text-blue-600 hover:underline">
                info@apbluebookonline.com
              </a>
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/" className="text-gray-600 hover:text-blue-600 hover:underline">
              Home
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/about" className="text-gray-600 hover:text-blue-600 hover:underline">
              About
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 hover:underline">
              Dashboard
            </Link>
            <span className="text-gray-300">|</span>
            <a href="mailto:info@apbluebookonline.com" className="text-gray-600 hover:text-blue-600 hover:underline">
              Contact
            </a>
          </div>
          <p className="mt-3 text-center text-sm text-gray-600">
            If you encounter any issues, you can always email us at{" "}
            <a href="mailto:info@apbluebookonline.com" className="font-medium text-blue-600 hover:underline">
              info@apbluebookonline.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
