export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center overflow-y-auto bg-[#F9FAFB] px-4 py-8 pb-28">
      {children}
    </div>
  );
}
