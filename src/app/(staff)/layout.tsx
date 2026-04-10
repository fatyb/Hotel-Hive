import StaffHeader from "@/components/staff/StaffHeader";
import BottomNav from "@/components/staff/BottomNav";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <StaffHeader />
      {/* pb-24 so content is never hidden behind the bottom nav */}
      <main className="pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
