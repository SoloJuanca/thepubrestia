import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { STAFF_LOGIN_PATH } from "@/lib/auth-paths";
import { homePathForRoles } from "@/lib/post-login";

export default async function PostLoginPage() {
  const session = await auth();
  if (!session?.user) {
    redirect(STAFF_LOGIN_PATH);
  }
  redirect(homePathForRoles(session.user.roles));
}
