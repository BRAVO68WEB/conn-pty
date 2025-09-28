import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Layout } from "@/components/Layout";
import Index from "@/pages/Index";
import Console from "@/pages/Console";
import SessionNew from "@/pages/SessionNew";
import Servers from "@/pages/Servers";
import CredentialManager from "@/pages/CredentialManager";
import AddServer from "./pages/AddServer";
import AddCredential from "./pages/AddCredential";
import ProtectedRoute from "@/components/ProtectedRoute";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router>
          <Routes>
            {/* Landing page without sidebar */}
            <Route path="/" element={<Index />} />
            
            {/* Dashboard routes with sidebar layout */}
            <Route path="/console" element={<ProtectedRoute><Layout><Console /></Layout></ProtectedRoute>} />
            <Route path="/sessions/:id" element={<ProtectedRoute><Layout><SessionNew /></Layout></ProtectedRoute>} />
            <Route path="/servers" element={<ProtectedRoute><Layout><Servers /></Layout></ProtectedRoute>} />
            <Route path="/credentials" element={<ProtectedRoute><Layout><CredentialManager /></Layout></ProtectedRoute>} />
            <Route path="/servers/new" element={<AddServer />} />
            <Route path="/credentials/new" element={<AddCredential />} />

            {/* All other routes, redirect to home */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
