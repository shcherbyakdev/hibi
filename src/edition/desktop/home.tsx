import { redirect } from "next/navigation";
import { DEFAULT_AFTER_LOGIN } from "@/lib/auth/next-path";

/** Desktop "/": the app has no landing page; straight into the planner. */
export default function Home() {
  redirect(DEFAULT_AFTER_LOGIN);
}
