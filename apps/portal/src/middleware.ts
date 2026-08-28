import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/shipments(.*)",
  "/freight(.*)",
  "/documents(.*)",
  "/invoices(.*)",
  "/requests(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (process.env.NODE_ENV === "production" && isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|__clerk|[^?]*\\.(?:html?|css|js(?!on)|json|webmanifest|png|jpg|jpeg|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
