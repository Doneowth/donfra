import EditLessonClient from "./EditLessonClient";

export default function EditLessonPage({ params }: { params: { slug: string } }) {
  return <EditLessonClient slug={params.slug} />;
}
