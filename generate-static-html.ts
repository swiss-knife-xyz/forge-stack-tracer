import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to run the Forge test command and capture its output
function runForgeTestAndCaptureOutput(): string {
  try {
    const command =
      "cd /Users/apoorvlathey/blockchain/flayer/flaunch-contracts && forge test --mt test_liquidity -vvvv";
    console.log("Running Forge test command...");
    const output = execSync(command, {
      encoding: "utf-8",
      maxBuffer: 1024 * 1024 * 100,
    }); // 100 MB buffer
    console.log("Forge test completed successfully.");
    return output.trim();
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error running Forge test:", error.message);
    }
    return "";
  }
}

// Run the Forge test and capture its output
console.log("Starting script execution...");
const traceData: string = runForgeTestAndCaptureOutput();

// Read the built index.html file
const indexPath: string = path.join(__dirname, "dist", "index.html");
console.log("Reading index.html from:", indexPath);
let htmlContent: string = fs.readFileSync(indexPath, "utf-8");

// Inject the trace data into the HTML
const injectedScript: string = `
<script>
  window.TRACE_DATA = ${JSON.stringify(traceData)};
</script>
`;

htmlContent = htmlContent.replace("</head>", `${injectedScript}</head>`);

// Write the modified HTML to a new file
const outputPath: string = path.join(__dirname, "dist", "output.html");
fs.writeFileSync(outputPath, htmlContent);

console.log("Static HTML file generated successfully:", outputPath);
