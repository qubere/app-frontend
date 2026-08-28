// Re-exported from @qubere/auth so every DomainError subclass thrown
// anywhere in apps/custom is recognized by withAuthenticatedRoute's shared
// error handler. A separate local copy of DomainError/handleApiError used
// to live here; that meant an apps/custom-thrown DomainError was a
// different, unrelated class from the one packages/auth's handleApiError
// checked via `instanceof`, so every DomainError subclass in this app was
// falling through to a generic 500 once withAuthenticatedRoute moved into
// the shared package.
export * from "@qubere/auth";
