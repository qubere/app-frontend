-- Touch-rate honest denominator (issue #202, 4.2.2).
--
-- touchRate was reconstructed after the fact from whatever ExtractionField rows
-- happened to exist. Record the raw counts instead: how many decisions the
-- pipeline presented to a human for review (denominator, recorded at decision
-- creation via triageState) and how many a human then modified (numerator).

ALTER TABLE "WorkMetricSnapshot"
  ADD COLUMN IF NOT EXISTS "lineItemsPresented" INTEGER,
  ADD COLUMN IF NOT EXISTS "lineItemsTouched" INTEGER;
