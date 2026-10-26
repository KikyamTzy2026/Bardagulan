import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { RoomClient } from "@/components/RoomClient";

export const metadata: Metadata = { title: "Room | OFFICE BARDAGULAN 2100" };

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <Shell>
      <RoomClient code={code.toUpperCase()} />
    </Shell>
  );
}
