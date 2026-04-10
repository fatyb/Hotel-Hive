import Sidebar from "@/components/manager/Sidebar";
import Header  from "@/components/manager/Header";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F5F5F5] dark:bg-gray-950 transition-colors">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
