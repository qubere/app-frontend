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

  const { userId } = await auth();
  if (!userId) {
    return (await auth()).redirectToSignIn({ returnBackUrl: req.url });
  }
});

export const config = {
  matcher: [
    "/((?!_next|__clerk|[^?]*\\.(?:html?|css|js(?!on)|json|webmanifest|png|jpg|jpeg|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
