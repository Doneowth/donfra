import CreateLessonClient from "./CreateLessonClient";

export async function generateStaticParams() {
  try {
    const res = await fetch(`http://host.docker.internal:8080/api/lessons`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const lessons = (await res.json()) as Array<{ Slug?: string; slug?: string }>;
    return lessons
      .map((l) => l.Slug || l.slug)
      .filter(Boolean)
      .map((slug) => ({ slug }));
  } catch (err: any) {
    console.warn("generateStaticParams lessons fetch failed, returning []:", err?.message || err);
    return [];
  }
}

export default function CreateLessonPage() {
  return <CreateLessonClient />;
}
