import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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
    // Redirect straight to our own branded /sign-in page. auth().redirectToSignIn()
    // resolves to the unstyled hosted Clerk Account Portal at accounts.qubere.ai
    // whenever NEXT_PUBLIC_CLERK_SIGN_IN_URL is unset on the deployment, and a
    // relative value for that var can't be used as a fix — Clerk v7 rejects it in
    // proxy mode (see the /__clerk rewrite in next.config.ts) and breaks <SignIn>.
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: [
    "/((?!_next|__clerk|[^?]*\\.(?:html?|css|js(?!on)|json|webmanifest|png|jpg|jpeg|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
