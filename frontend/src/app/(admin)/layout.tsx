import { LocalGate } from "@/components/access/local-access";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <LocalGate area="admin">{children}</LocalGate>;
}
