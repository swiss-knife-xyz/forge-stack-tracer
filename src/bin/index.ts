#!/usr/bin/env node

import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import inquirer from "inquirer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputFolderPath = path.join(process.cwd(), "out", "_fst");

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

async function cleanOutputFolder() {
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Are you sure you want to delete the folder "${outputFolderPath}"?`,
      default: true,
    },
  ]);

  if (confirm) {
    await fs.remove(outputFolderPath);
    console.log(`Folder "${outputFolderPath}" has been deleted.`);
  } else {
    console.log("Operation cancelled.");
  }
}

const args = process.argv.slice(2);
if (args[0] === "clean") {
  // "fst clean"
  cleanOutputFolder();
} else {
  // piping forge stack trace data "forge test -vvvv | fst"
  // Read from stdin
  let input = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk) => {
    input += chunk;
  });
  process.stdin.on("end", () => {
    processInput(input.trim());
  });
}
