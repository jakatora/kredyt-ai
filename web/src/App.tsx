import { Routes, Route } from "react-router-dom";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Home } from "./pages/Home";
import { Analyze } from "./pages/Analyze";
import { Processing } from "./pages/Processing";
import { Report } from "./pages/Report";
import { History } from "./pages/History";
import { StripeSuccess } from "./pages/StripeSuccess";
import { StripeCancel } from "./pages/StripeCancel";
import { Privacy } from "./pages/Privacy";
import { Terms } from "./pages/Terms";
import { NotFound } from "./pages/NotFound";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/analyze" element={<Analyze />} />
          <Route path="/processing/:analysisId" element={<Processing />} />
          <Route path="/report/:analysisId" element={<Report />} />
          <Route path="/history" element={<History />} />
          <Route path="/stripe/success" element={<StripeSuccess />} />
          <Route path="/stripe/cancel" element={<StripeCancel />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
