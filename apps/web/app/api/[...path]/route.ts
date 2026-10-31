import { NextRequest, NextResponse } from "next/server";
import { matchesRequestOrigin } from "../../../lib/request-origin";
const api = process.env.API_INTERNAL_URL ?? "http://localhost:4000";
const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};
async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const path = (await params).path.join("/");
  if (!["GET", "POST", "PATCH", "DELETE"].includes(req.method))
    return NextResponse.json(
      { message: "Método no permitido." },
      { status: 405 },
    );
  if (
    req.method !== "GET" &&
    !matchesRequestOrigin(
      req.headers.get("origin"),
      req.headers.get("host"),
      req.nextUrl.protocol,
    )
  )
    return NextResponse.json(
      { message: "Origen no permitido." },
      { status: 403 },
    );
  const authAction = [
    "auth/login",
    "auth/register",
    "auth/refresh",
    "auth/logout",
  ].includes(path);
  const incomingType = req.headers.get("content-type") ?? "application/json";
  let body: BodyInit | undefined =
    req.method === "GET" ? undefined : await req.arrayBuffer();
  if (body instanceof ArrayBuffer && body.byteLength === 0) body = undefined;
  if (path === "auth/refresh" || path === "auth/logout")
    body = JSON.stringify({
      token: req.cookies.get("nodra_refresh")?.value ?? "",
    });
  try {
    const response = await fetch(`${api}/api/v1/${path}${req.nextUrl.search}`, {
      method: req.method,
      headers: {
        ...(body === undefined ? {} : { "content-type": incomingType }),
        ...(req.cookies.get("nodra_access")
          ? {
              authorization: `Bearer ${req.cookies.get("nodra_access")!.value}`,
            }
          : {}),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.headers.get("content-type")?.includes("application/json")) {
      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          "content-type":
            response.headers.get("content-type") ?? "application/octet-stream",
          "cache-control": response.headers.get("cache-control") ?? "no-store",
        },
      });
    }
    const data: Record<string, unknown> = await response.json();
    const { accessToken, refreshToken, ...safe } = data;
    const result = NextResponse.json(authAction ? safe : data, {
      status: response.status,
    });
    if (typeof accessToken === "string" && typeof refreshToken === "string") {
      result.cookies.set("nodra_access", accessToken, {
        ...options,
        maxAge: 900,
      });
      result.cookies.set("nodra_refresh", refreshToken, {
        ...options,
        maxAge: 30 * 86400,
      });
    }
    if (
      path === "auth/logout" ||
      (path === "auth/refresh" && !response.ok) ||
      (path === "auth/reset/complete" && response.ok)
    ) {
      result.cookies.set("nodra_access", "", { ...options, maxAge: 0 });
      result.cookies.set("nodra_refresh", "", { ...options, maxAge: 0 });
    }
    return result;
  } catch {
    return NextResponse.json(
      {
        message:
          "No se puede conectar con Nodra. Comprueba la conexión e inténtalo de nuevo.",
      },
      { status: 503 },
    );
  }
}
export const GET = proxy,
  POST = proxy,
  PATCH = proxy,
  DELETE = proxy;
