import { PersonView } from "@/components/person/person-view";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PersonView personId={id} />;
}
