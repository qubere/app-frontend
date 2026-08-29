import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Pages that must render for signed-out visitors.
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/invite(.*)",
]);

// API routes self-guard (each returns a 401 JSON body via getAccountContext);
// middleware must never turn those into a redirect.
const isApiRoute = createRouteMatcher(["/api(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isApiRoute(req) || isPublicRoute(req)) return;

  // Local dev has no Clerk session — getAccountContext() serves a demo identity,
  // so the redirect would break `next dev`. Every real deployment sets
  // NODE_ENV=production, where an unauthenticated page load is bounced to
  // Clerk's sign-in URL (defaults to /sign-in). Without this, `/` renders the
  // full portal shell (with placeholder identity) for anonymous visitors.
  if (process.env.NODE_ENV === "production") {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|__clerk|[^?]*\\.(?:html?|css|js(?!on)|json|webmanifest|png|jpg|jpeg|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
