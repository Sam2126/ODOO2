import { redirect } from "next/navigation";

// Middleware sends anonymous visitors to /login, so anyone reaching the root
// is signed in and belongs on the dashboard.
export default function RootPage() {
  redirect("/dashboard");
}
