import { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Background } from "@/components/background/Background";
import { CommandPalette } from "@/components/system/CommandPalette";
import { ToastViewport } from "@/components/ui/Toast";
import { PageLoader } from "@/components/ui/PageLoader";

const Landing = lazy(() => import("@/pages/Landing"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Execution = lazy(() => import("@/pages/Execution"));

export default function App() {
  const location = useLocation();
  return (
    <div className="relative min-h-screen">
      <Background />
      <CommandPalette />
      <ToastViewport />
      <Suspense fallback={<PageLoader />}>
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Landing />} />
            <Route path="/app" element={<Dashboard />} />
            <Route path="/runs/:runId" element={<Execution />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </div>
  );
}
