import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { REQUEST_PATH_HEADER } from "@/lib/hosts";

const previousRoot = process.env.ROOT_DOMAIN;
beforeAll(() => {
  process.env.ROOT_DOMAIN = "localhost:3000";
});
afterAll(() => {
  if (previousRoot === undefined) delete process.env.ROOT_DOMAIN;
  else process.env.ROOT_DOMAIN = previousRoot;
});

function request(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers: { host: new URL(url).host, ...headers } });
}

describe("Proxy", () => {
  it("gibt im Portal den Browser-Pfad (ohne /portal/<kuerzel>) für den Rücksprung nach der Anmeldung weiter", () => {
    const res = proxy(request("http://muster.localhost:3000/tickets/7?x=1", { [REQUEST_PATH_HEADER]: "/von-aussen" }));
    expect(res.headers.get("x-middleware-rewrite")).toBe("http://muster.localhost:3000/portal/muster/tickets/7?x=1");
    expect(res.headers.get(`x-middleware-request-${REQUEST_PATH_HEADER}`)).toBe("/tickets/7?x=1");
  });

  it("gibt in der Verwaltung den angefragten Pfad weiter", () => {
    const res = proxy(request("http://localhost:3000/admin/tickets/7"));
    expect(res.headers.get(`x-middleware-request-${REQUEST_PATH_HEADER}`)).toBe("/admin/tickets/7");
  });

  it("beantwortet ungültige Subdomains mit der schlichten 404-Seite statt der Website", () => {
    const res = proxy(request("http://admin.localhost:3000/leistungen"));
    expect(res.status).toBe(404);
    // Zweiteilig, damit die Website-Seite /[slug] (mit Menü und relativen Links) nicht greift
    expect(res.headers.get("x-middleware-rewrite")).toBe("http://admin.localhost:3000/__unbekannt/host");
  });
});
