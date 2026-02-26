import { getAgents } from "../actions";
import { ChatClient } from "./chat-client";

export default async function ChatPage() {
  const agents = await getAgents({ status: "active" });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-vw-dark">Agent Chat</h1>
        <p className="text-sm text-muted-foreground">
          Asistanlara hızlı sorular sorun
        </p>
      </div>
      <ChatClient agents={agents} />
    </div>
  );
}
