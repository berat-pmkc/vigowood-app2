import {
  getTasks,
  getAssignableUsers,
  getAssignableAgents,
  getTaskTemplates,
  getRecurringTasks,
} from "../actions";
import { KanbanBoard } from "./components/kanban-board";
import { BoardTabs } from "./components/board-tabs";
import { TemplatesTab } from "./components/templates-tab";
import { RecurringTab } from "./components/recurring-tab";
import { ListView } from "./components/list-view";
import { CalendarView } from "./components/calendar-view";
import { ViewSwitcher, type BoardView } from "./components/view-switcher";

export default async function OpsBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; view?: string }>;
}) {
  const params = await searchParams;
  const activeTab = params.tab ?? "gorevler";
  const activeView = (params.view ?? "pano") as BoardView;

  const [tasks, users, agents, templates, recurringTasks] = await Promise.all([
    getTasks(),
    getAssignableUsers(),
    getAssignableAgents(),
    getTaskTemplates(),
    getRecurringTasks(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-vw-dark">Görev Panosu</h1>
          <p className="text-sm text-muted-foreground">
            Görevleri sürükle bırak ile yönetin
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <BoardTabs activeTab={activeTab} />
        {activeTab === "gorevler" && (
          <ViewSwitcher activeView={activeView} />
        )}
      </div>

      {activeTab === "gorevler" && activeView === "pano" && (
        <KanbanBoard
          initialTasks={tasks}
          users={users}
          agents={agents}
        />
      )}

      {activeTab === "gorevler" && activeView === "liste" && (
        <ListView
          tasks={tasks.filter((t) => !t.parent_id)}
          users={users}
          agents={agents}
        />
      )}

      {activeTab === "gorevler" && activeView === "takvim" && (
        <CalendarView
          tasks={tasks.filter((t) => !t.parent_id)}
          users={users}
          agents={agents}
        />
      )}

      {activeTab === "sablonlar" && (
        <TemplatesTab
          templates={templates}
          users={users}
          agents={agents}
        />
      )}

      {activeTab === "tekrar-eden" && (
        <RecurringTab
          recurringTasks={recurringTasks}
          templates={templates}
          users={users}
          agents={agents}
        />
      )}
    </div>
  );
}
