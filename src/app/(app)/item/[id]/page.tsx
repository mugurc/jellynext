import { DetailView } from "@/components/detail/detail-view";

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DetailView itemId={id} />;
}
