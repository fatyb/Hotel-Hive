export const metadata = { title: "Front Office — HotelHive" };

export default function FrontOfficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex flex-col">
      {children}
    </div>
  );
}
