import { BoardView } from "@/features/boards/components/board-view";

export default async function BoardPage({ params }: PageProps<"/boards/[id]">) {
  const { id } = await params;
  return <BoardView id={id} />;
}
