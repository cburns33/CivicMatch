import { ReviewQueue } from "@/components/review-queue";

export const metadata = { title: "Composition review", robots: { index: false, follow: false } };

export default function AdminReview() {
  return <article className="document-page">
    <div className="eyebrow">PRIVATE COMPOSITION REVIEW</div>
    <h1>Review the official record.</h1>
    <p className="lede">Compare staged records with their sources and leave an evidence-linked decision. Ballot publication requires separate validation.</p>
    <ReviewQueue />
  </article>;
}
