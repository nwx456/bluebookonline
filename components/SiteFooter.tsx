import Link from "next/link";
import { TrademarkDisclaimer } from "@/components/legal/TrademarkDisclaimer";
import { CONTACT_EMAIL } from "@/lib/site-config";



export function SiteFooter() {

  return (

    <footer className="border-t border-gray-200 bg-white py-8">

      <div className="mx-auto max-w-4xl px-4">

        <div className="mb-4 text-center">

          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Legal</p>

          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">

            <Link href="/legal" className="text-gray-600 hover:text-blue-600 hover:underline">

              Legal center

            </Link>

            <Link href="/terms" className="text-gray-600 hover:text-blue-600 hover:underline">

              Terms

            </Link>

            <Link href="/privacy" className="text-gray-600 hover:text-blue-600 hover:underline">

              Privacy

            </Link>

            <Link href="/cookies" className="text-gray-600 hover:text-blue-600 hover:underline">

              Cookies

            </Link>

            <Link href="/copyright" className="text-gray-600 hover:text-blue-600 hover:underline">

              Copyright

            </Link>

            <Link href="/settings/privacy" className="text-gray-600 hover:text-blue-600 hover:underline">

              Privacy settings

            </Link>

          </div>

        </div>

        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm border-t border-gray-100 pt-4">

          <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 hover:underline">

            Dashboard

          </Link>

          <span className="text-gray-300">|</span>

          <Link href="/exams" className="text-gray-600 hover:text-blue-600 hover:underline">

            Practice tests

          </Link>

          <span className="text-gray-300">|</span>

          <Link href="/tools/ap-score-calculator" className="text-gray-600 hover:text-blue-600 hover:underline">

            Score calculator

          </Link>

          <span className="text-gray-300">|</span>

          <Link href="/blog" className="text-gray-600 hover:text-blue-600 hover:underline">

            Blog

          </Link>

          <span className="text-gray-300">|</span>

          <Link href="/about" className="text-gray-600 hover:text-blue-600 hover:underline">

            About

          </Link>

          <span className="text-gray-300">|</span>

          <a

            href={`mailto:${CONTACT_EMAIL}`}

            className="text-gray-600 hover:text-blue-600 hover:underline"

          >

            Contact

          </a>

        </div>

        <p className="mt-3 text-center text-sm text-gray-600">

          Questions about your data? Email{" "}

          <a

            href={`mailto:${CONTACT_EMAIL}`}

            className="font-medium text-blue-600 hover:underline"

          >

            {CONTACT_EMAIL}

          </a>

        </p>

        <TrademarkDisclaimer variant="compact" className="mt-4 px-2" />

      </div>

    </footer>

  );

}

