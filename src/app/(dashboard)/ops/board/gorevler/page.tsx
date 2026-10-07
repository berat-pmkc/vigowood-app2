import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getTasks,
  getAssignableUsers,
  getTaskTemplates,
  getRecurringTasks,
  getBoardStats,
} from "../../actions";
import { KanbanBoard } from "../components/kanban-board";
import { BoardTabs } from "../components/board-tabs";
import { TemplatesTab } from "../components/templates-tab";
import { RecurringTab } from "../components/recurring-tab";
import { ListView } from "../components/list-view";
import { CalendarView } from "../components/calendar-view";
import { ViewSwitcher, type BoardView } from "../components/view-switcher";

export default async function GorevlerBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; view?: string }>;
}) {
  const params = await searchParams;
  const activeTab = params.tab ?? "gorevler";
  const activeView = (params.view ?? "pano") as BoardView;

  const agents: never[] = [];
  const [tasks, users, templates, recurringTasks, stats] = await Promise.all([
    getTasks(),
    getAssignableUsers(),
    getTaskTemplates(),
    getRecurringTasks(),
    getBoardStats(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/ops/board/beyaz-yaka" className="text-vw-deep hover:text-vw-dark"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
          <h1 className="text-2xl font-bold text-vw-dark">Beyaz Yaka Görev Panosu</h1>
          <p className="text-sm text-muted-foreground">
            Görevleri sürükle bırak ile yönetin
          </p>
        </div>
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
          stats={stats}
        />
      )}

      {activeTab === "gorevler" && activeView === "liste" && (
        <ListView
          tasks={tasks.filter((t) => !t.parent_id)}
          users={users}
          agents={agents}
          stats={stats}
        />
      )}

      {activeTab === "gorevler" && activeView === "takvim" && (
        <CalendarView
          tasks={tasks.filter((t) => !t.parent_id)}
          users={users}
          agents={agents}
          stats={stats}
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
