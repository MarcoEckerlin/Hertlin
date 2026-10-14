import { redirect } from "next/navigation";

/** /admin/website/seiten hat keine eigene Ansicht – die Seitenliste steht in der Website-Übersicht. */
export default function WebsitePagesIndex() {
  redirect("/admin/website");
}
