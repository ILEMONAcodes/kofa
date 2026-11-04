import { NextResponse, type NextRequest } from "next/server";
import { publicNotFoundHtml } from "@/lib/public-not-found";
import { propertyVisibility } from "@/lib/api/public-visibility";
export async function proxy(request: NextRequest) {
  const segment = request.nextUrl.pathname.split("/")[2];
  let slug: string;
  try {
    slug = decodeURIComponent(segment);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  const status = await propertyVisibility(slug);
  if (status === 404) {
    return new NextResponse(publicNotFoundHtml, {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  return NextResponse.next();
}
export const config = { matcher: "/properties/:slug" };
