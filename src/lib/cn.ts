/** Klassen zusammenfügen, falsy-Werte werden ignoriert. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
