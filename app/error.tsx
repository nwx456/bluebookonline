"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
      <div className="max-w-lg w-full rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Something went wrong</h2>
        <p className="mt-2 text-sm text-gray-600">
          {error.message}
        </p>
        <p className="mt-4 text-sm text-gray-500">
          If you&apos;re the site owner and this happens after deploying to Vercel, ensure{" "}
          <code className="font-mono text-xs bg-gray-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="font-mono text-xs bg-gray-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are
          set in Project Settings → Environment Variables, then redeploy.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
