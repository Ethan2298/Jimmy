import "./magi.css";

export const metadata = {
  title: "Jimmy Console",
};

export default function MagiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="magi-root">
      {children}
    </div>
  );
}
