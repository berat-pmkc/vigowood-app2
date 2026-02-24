import { getTasks, getAssignableUsers } from "../actions";
import { KanbanBoard } from "./components/kanban-board";

export default async function OpsBoardPage() {
  const [tasks, users] = await Promise.all([
    getTasks(),
    getAssignableUsers(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-vw-dark">Board</h1>
          <p className="text-sm text-muted-foreground">
            Görevleri sürükle bırak ile yönetin
          </p>
        </div>
      </div>
      <KanbanBoard initialTasks={tasks} users={users} />
    </div>
  );
}
