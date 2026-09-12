import React from "react";
import { createRoot } from "react-dom/client";
import TrainerAccessEditor from "../../components/auth/TrainerAccessEditor";
createRoot(document.getElementById("root")!).render(<TrainerAccessEditor readOnly={new URLSearchParams(location.search).has("readonly")} />);
