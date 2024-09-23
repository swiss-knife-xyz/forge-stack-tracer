#!/usr/bin/env node

import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getOutputPath(): string {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    return args[0];
  }
  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\..+/, "");
  return path.join(process.cwd(), "out", `fst-${timestamp}.html`);
}

function openFile(filePath: string) {
  let command;
  switch (process.platform) {
    case "darwin":
      command = "open";
      break;
    case "win32":
      command = "start";
      break;
    default:
      command = "xdg-open";
  }
  spawn(command, [filePath], { stdio: "inherit" });
}

function processInput(input: string): void {
  // Output the input back to the terminal
  console.log(input);

  // Read the built index.html file
  const inputHtmlPath = path.join(__dirname, "..", "index.html");
  let htmlContent: string = fs.readFileSync(inputHtmlPath, "utf-8");

  // Inject the trace data into the HTML
  const injectedScript: string = `
<script>
  window.TRACE_DATA = ${JSON.stringify(input)};
  // Ensure the setTraceData function exists
  if (typeof window.setTraceData === 'function') {
    window.setTraceData(window.TRACE_DATA);
  } else {
    console.error('setTraceData function not found');
  }
</script>
`;

  // Insert the injected script just before the closing </body> tag
  htmlContent = htmlContent.replace("</body>", `${injectedScript}</body>`);

  // Write the modified HTML to the output file
  const outputHtmlPath = getOutputPath();
  fs.outputFileSync(outputHtmlPath, htmlContent);
  console.log(
    "Forge Stack Tracer output generated successfully:",
    outputHtmlPath
  );

  // Open the generated HTML file
  openFile(outputHtmlPath);
}

// Read from stdin
let input = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  processInput(input.trim());
});
