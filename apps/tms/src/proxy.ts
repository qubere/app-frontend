import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware(async () => {});

export const config = {
  matcher: [
    // Skip Next.js internals, Clerk proxy paths (/__clerk), and static files
    "/((?!_next|__clerk|[^?]*\\.(?:html?|css|js(?!on)|json|webmanifest|png|jpg|jpeg|gif|svg|ttf|woff2?|ico)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
