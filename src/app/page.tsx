import { redirect } from "next/navigation";
import { CUSTOMER_LOGIN_PATH } from "@/lib/auth-paths";

export default function HomePage() {
  redirect(CUSTOMER_LOGIN_PATH);
}
