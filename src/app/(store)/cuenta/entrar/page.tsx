import { redirect } from "next/navigation";
import { CUSTOMER_LOGIN_PATH } from "@/lib/auth-paths";
import { safeCustomerPath } from "@/validations/store";

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

/** Older customer links. The main login now lives at /login. */
export default async function CustomerLoginAliasPage({ searchParams }: Props) {
  const params = await searchParams;
  const callbackUrl = safeCustomerPath(params.callbackUrl);
  redirect(
    `${CUSTOMER_LOGIN_PATH}?callbackUrl=${encodeURIComponent(callbackUrl)}`,
  );
}
