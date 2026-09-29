import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { realMainApiOf } from "./api/main-api";
import { App } from "./app/app";
import { THEME } from "./theme";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("index.html has no #root element");
}

createRoot(rootElement).render(
  <StrictMode>
    <MantineProvider theme={THEME} defaultColorScheme="auto">
      <App api={realMainApiOf(window.api)} />
    </MantineProvider>
  </StrictMode>,
);
