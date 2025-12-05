import LessonDetailClient from "./LessonDetailClient";

export default function LessonDetailPage({ params }: { params: { slug: string } }) {
  return <LessonDetailClient slug={params.slug} />;
}
