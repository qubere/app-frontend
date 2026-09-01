import { useState } from "react";
import { createRoot } from "react-dom/client";
import { PgaHoldResolutionDrawer } from "../../src/app/app/shipments/[id]/PgaHoldResolutionDrawer";
import { AssistEntryBanner } from "../../src/app/app/filing/[id]/AssistEntryBanner";
import { AssistRegistry } from "../../src/app/app/assists/AssistRegistry";
import "../../src/app/globals.css";

// Only production UI components live here. Playwright supplies HTTP fixtures;
// no auth bypass or test route is added to the deployed Next application.
function App() {
  const [open, setOpen] = useState(false);
  const view = new URLSearchParams(location.search).get("view");
  return <main className="min-h-screen bg-white p-6 text-ink">
    {view === "assists" ? <AssistEntryBanner filingId="filing" revision="1"/> : view === "registry" ? <AssistRegistry canUpdate/> : <>
      <button onClick={() => setOpen(true)}>Resolve FDA hold</button>
      {open && <PgaHoldResolutionDrawer id="hold" onClose={() => setOpen(false)} onChanged={() => undefined}/>}
    </>}
  </main>;
}
createRoot(document.getElementById("root")!).render(<App/>);
