import { getCurrentUser } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { APPROVAL_ROLES } from "@/lib/constants";
import { getAgentById } from "../../actions";
import { AgentDetailClient } from "./components/agent-detail-client";

interface AgentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AgentDetailPage({ params }: AgentDetailPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!APPROVAL_ROLES.includes(user.role as (typeof APPROVAL_ROLES)[number])) {
    redirect("/ops");
  }

  const { id } = await params;
  const agent = await getAgentById(id);

  if (!agent) {
    notFound();
  }

  return <AgentDetailClient agent={agent} />;
}
