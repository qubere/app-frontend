import { InboundReviewTable } from '../InboundReviewTable';
export default async function InboundReviewPage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  const { clientId } = await searchParams;
  return <InboundReviewTable filterClientId={clientId} />;
}
