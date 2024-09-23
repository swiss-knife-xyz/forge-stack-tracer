#!/usr/bin/env node

import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getOutputPath() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    return args[0];
  }
  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\..+/, "");
  return path.join(process.cwd(), "out", "_fst", `fst-${timestamp}.html`);
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

function processInput(input: string) {
  // Output the input back to the terminal
  console.log(input);

  // Read the template HTML file
  const templateHtmlPath = path.join(__dirname, "index.html");
  let htmlContent = fs.readFileSync(templateHtmlPath, "utf-8");

  // Inject the trace data into the HTML
  const injectedScript: string = `
<script>
  window.TRACE_DATA = ${JSON.stringify(input)};
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
