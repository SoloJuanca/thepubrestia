import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { homePathForRoles } from "@/lib/post-login";

export default async function PostLoginPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  redirect(homePathForRoles(session.user.roles));
}
