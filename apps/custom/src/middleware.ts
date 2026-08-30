import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/app(.*)",
  "/api/agents(.*)",
  "/api/intake(.*)",
  "/api/documents(.*)",
  "/chat(.*)",
  "/api/assistant(.*)",
]);

// Keep unauthenticated users on our own Qubere-branded /sign-in page rather than
// the unstyled Clerk Account Portal. This is passed to auth.protect() as an
// absolute URL built from the request origin — NOT as a clerkMiddleware
// `signInUrl` option, which is validated as absolute and throws
// "The signInUrl needs to have a absolute url format." for a relative path,
// 500-ing every protected route (including /api/documents/upload).
export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect({
      unauthenticatedUrl: new URL("/sign-in", req.url).toString(),
      unauthorizedUrl: new URL("/sign-in", req.url).toString(),
    });
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
