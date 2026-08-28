import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/api/documents/proxy(.*)"]);

const isProtectedRoute = createRouteMatcher([
  "/app(.*)",
  "/api/agents(.*)",
  "/api/intake(.*)",
  "/chat(.*)",
  "/api/assistant(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req) && !isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals, Clerk proxy paths (/__clerk), and static files
    "/((?!_next|__clerk|[^?]*\\.(?:html?|css|js(?!on)|json|webmanifest|png|jpg|jpeg|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
