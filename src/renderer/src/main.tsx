import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/app";
import { THEME } from "./theme";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("index.html has no #root element");
}

createRoot(rootElement).render(
  <StrictMode>
    <MantineProvider theme={THEME} defaultColorScheme="auto">
      <App />
    </MantineProvider>
  </StrictMode>,
);
