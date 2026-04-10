// Minimal layout for login / auth pages (no header, no sidebar)
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-[#F5F5F5]">{children}</div>;
}
