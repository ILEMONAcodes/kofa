import { MediaSession } from "@/components/features/media-help/session";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <MediaSession>{children}</MediaSession>;
}
