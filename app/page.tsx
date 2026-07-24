import { getSessionUser } from "@/lib/auth";
import { Landing } from "@/components/marketing/landing";

export default async function Home() {
  const user = await getSessionUser();
  return <Landing isAuthed={!!user && !user.isGuest} />;
}
