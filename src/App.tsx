import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthGuard } from "./components/auth/AuthGuard";
import { AppLayout } from "./components/layout/AppLayout";
import Auth from "./pages/Auth";
import Cases from "./pages/Cases";
import NewCase from "./pages/NewCase";
import AddTest from "./pages/AddTest";
import EditTest from "./pages/EditTest";
import CaseDashboard from "./pages/CaseDashboard";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/"
            element={
              <AuthGuard>
                <AppLayout>
                  <Cases />
                </AppLayout>
              </AuthGuard>
            }
          />
          <Route
            path="/new-case"
            element={
              <AuthGuard>
                <AppLayout>
                  <NewCase />
                </AppLayout>
              </AuthGuard>
            }
          />
          <Route
            path="/case/:caseId/add-test"
            element={
              <AuthGuard>
                <AppLayout>
                  <AddTest />
                </AppLayout>
              </AuthGuard>
            }
          />
          <Route
            path="/case/:caseId/test/:testId/edit"
            element={
              <AuthGuard>
                <AppLayout>
                  <EditTest />
                </AppLayout>
              </AuthGuard>
            }
          />
          <Route
            path="/case/:caseId"
            element={
              <AuthGuard>
                <AppLayout>
                  <CaseDashboard />
                </AppLayout>
              </AuthGuard>
            }
          />
          <Route
            path="/case/:caseId/dashboard"
            element={
              <AuthGuard>
                <AppLayout>
                  <CaseDashboard />
                </AppLayout>
              </AuthGuard>
            }
          />
          <Route
            path="/settings"
            element={
              <AuthGuard>
                <AppLayout>
                  <Settings />
                </AppLayout>
              </AuthGuard>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
