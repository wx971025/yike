import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import { GroupProvider } from "./context/GroupContext";
import CalendarPage from "./pages/CalendarPage";
import Dashboard from "./pages/Dashboard";
import GroupsPage from "./pages/GroupsPage";
import ItemsPage from "./pages/ItemsPage";
import Login from "./pages/Login";
import PlanItemsPage from "./pages/PlanItemsPage";
import RemindersPage from "./pages/RemindersPage";
import Register from "./pages/Register";
import WordsPage from "./pages/WordsPage";
import AgentSkillsPage from "./pages/AgentSkillsPage";

function ProtectedApp() {
  const { username, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400 dark:text-slate-500">
        加载中...
      </div>
    );
  }

  if (!username) {
    return <Navigate to="/login" replace />;
  }

  return (
    <GroupProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/items" element={<ItemsPage />} />
          <Route path="/plan" element={<PlanItemsPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/words" element={<WordsPage />} />
          <Route path="/reminders" element={<RemindersPage />} />
          <Route path="/skills" element={<AgentSkillsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </GroupProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/*" element={<ProtectedApp />} />
    </Routes>
  );
}
