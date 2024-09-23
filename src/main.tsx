import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ChakraProvider, extendTheme } from "@chakra-ui/react";
import App from "./App.tsx";
import React from "react";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProvider
      theme={extendTheme({
        config: {
          initialColorMode: "dark",
          useSystemColorMode: false,
        },
        styles: {
          global: {
            html: {
              scrollBehavior: "smooth",
            },
            body: {
              bg: "#101010",
              color: "white",
            },
          },
        },
      })}
    >
      <App traceData="" />
    </ChakraProvider>
  </StrictMode>
);
