// Dashboard layout — Katman 2'de Sidebar, Navbar, MobileNav eklenecek
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen">{children}</div>;
}
