import React, { Suspense, lazy } from "react";
import { useEffect, useState } from "react";
import { Dumbbell, History, LineChart, PlusCircle, Scale } from "lucide-react";
import { getSession, logout, onAuthChange } from "./services/authService";
import { isSupabaseConfigured } from "./lib/supabaseClient";
import SetupPage from "./pages/SetupPage";
import AuthPage from "./pages/AuthPage";


const WorkoutPage = lazy(() => import("./pages/WorkoutPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const ProgressPage = lazy(() => import("./pages/ProgressPage"));
const ExercisesPage = lazy(() => import("./pages/ExercisesPage"));
const BodyWeightPage = lazy(() => import("./pages/BodyWeightPage"));

const tabs = [
  { id: "workout", label: "Entreno", icon: PlusCircle },
  { id: "history", label: "Historial", icon: History },
  { id: "bodyWeight", label: "Peso", icon: Scale },
  { id: "progress", label: "Progreso", icon: LineChart },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("workout");
  const [hideTopbar, setHideTopbar] = useState(false);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    function handleScroll() {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY && currentScrollY > 70) {
        setHideTopbar(true);
      } else {
        setHideTopbar(false);
      }

      lastScrollY = currentScrollY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    getSession()
      .then(setSession)
      .finally(() => setLoading(false));

    const { data } = onAuthChange(setSession);
    return () => data.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await logout();
    setSession(null);
  }

  if (loading) {
    return <div className="center-screen">Cargando...</div>;
  }

  if (!isSupabaseConfigured) {
    return <SetupPage />;
  }

  if (!session) {
    return <AuthPage />;
  }

  return (
    <div className="app-shell">
      <header className={`topbar ${hideTopbar ? "topbar-hidden" : ""}`}>
        <div className="brand">
          <div className="brand-icon"><Dumbbell size={23} /></div>
          <div>
            <h1>Gym Tracker David</h1>
          </div>
        </div>
      </header>

      <main className="content">
        <Suspense fallback={<div className="center-screen">Cargando...</div>}>
          {activeTab === "workout" && <WorkoutPage onGoToExercises={() => setActiveTab("exercises")} />}
          {activeTab === "exercises" && <ExercisesPage onBackToWorkout={() => setActiveTab("workout")} />}
          {activeTab === "history" && <HistoryPage />}
          {activeTab === "bodyWeight" && <BodyWeightPage />}
          {activeTab === "progress" && <ProgressPage onLogout={handleLogout} />}
        </Suspense>
      </main>

      <nav className="bottom-nav">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;

          return (
            <button key={tab.id} className={active ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
              <Icon size={20} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
