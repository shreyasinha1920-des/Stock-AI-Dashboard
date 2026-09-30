import { AIProvider } from "@/components/ai/ai-provider";
import { AISurface } from "@/components/ai/ai-surface";
import { Dashboard } from "@/components/dashboard/dashboard";
import { PortfolioEditor } from "@/components/portfolio/portfolio-editor";
import { PortfolioProvider } from "@/components/portfolio/portfolio-provider";

export default function Home() {
  return (
    <PortfolioProvider>
      <AIProvider>
        {/* `overflow-x-clip` keeps the drifting orb from ever causing sideways scroll. */}
        <div className="relative min-h-dvh overflow-x-clip">
          <Dashboard />
          <AISurface />
        </div>
        <PortfolioEditor />
      </AIProvider>
    </PortfolioProvider>
  );
}
