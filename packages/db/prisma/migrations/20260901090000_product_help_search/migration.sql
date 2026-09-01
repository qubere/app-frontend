-- Product help is a shared, versioned corpus. It is intentionally not scoped
-- to an Account: account-specific learned facts remain isolated in
-- "AccountMemory" and are never retrieved as product documentation.
CREATE TABLE "ProductHelpArticle" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "steps" JSONB NOT NULL,
  "href" TEXT,
  "actionLabel" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "popular" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
  "sourcePath" TEXT,
  "contentHash" TEXT NOT NULL,
  "searchText" TEXT NOT NULL,
  "embedding" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
  "embeddingVector" vector(768),
  "contentTsv" tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', "searchText")
  ) STORED,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductHelpArticle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductHelpArticle_moduleId_status_idx"
  ON "ProductHelpArticle"("moduleId", "status");
CREATE INDEX "ProductHelpArticle_status_publishedAt_idx"
  ON "ProductHelpArticle"("status", "publishedAt");
CREATE INDEX "ProductHelpArticle_contentTsv_gin_idx"
  ON "ProductHelpArticle" USING gin ("contentTsv");
CREATE INDEX "ProductHelpArticle_embeddingVector_hnsw_idx"
  ON "ProductHelpArticle" USING hnsw ("embeddingVector" vector_cosine_ops);
