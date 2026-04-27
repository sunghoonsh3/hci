import { cookies } from "next/headers";

// Demo mode is opted into by setting a `demo=1` cookie. The Playwright
// walkthrough sets it before navigating so route loading skeletons can
// suppress themselves, leaving the previous page visible during the brief
// data-fetch window. Production users never receive this cookie.
export async function isDemoMode(): Promise<boolean> {
  const store = await cookies();
  return store.get("demo")?.value === "1";
}
