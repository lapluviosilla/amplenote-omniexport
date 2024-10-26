import dotenv from "dotenv";
import esbuild from "esbuild";
import path from "path";
import fs from "fs";
import pluginConfig from "./plugin.config.js";

dotenv.config();

const README_FILE = path.resolve("README.md");

/**
 * Escapes Markdown special characters in a string to prevent formatting issues.
 *
 * @param {any} text - The text to escape.
 * @returns {string} - The escaped text.
 */
function escapeMarkdown(text) {
  if (typeof text !== "string") {
    text = String(text);
  }
  return text
    .replace(/\\/g, "\\\\") // Escape backslashes
    .replace(/\|/g, "\\|") // Escape pipe characters
    .replace(/\n/g, "<br />"); // Replace newlines with backslash + newline for Markdown
}

/**
 * Converts a JSON object into a uniformly formatted Markdown string with a header and a table,
 * respecting a maximum column width to ensure consistent formatting.
 *
 * @param {Object} jsonObj - The JSON object to convert.
 * @param {number} [maxCol1Width=30] - Maximum width for the first column (keys).
 * @param {number} [maxCol2Width=65] - Maximum width for the second column (values).
 * @returns {string} - The resulting Markdown string with aligned columns.
 */
function jsonToMetadataTable(jsonObj, maxCol1Width = 30, maxCol2Width = 65) {
  // Define the header line
  const header = "## Table - Plugin Parameters:\n\n";

  // Initialize an array to hold all table rows
  const allRows = [];

  // Initialize arrays to hold rows within the max width for column width calculation
  const validRowsForWidth = [];

  // Iterate over each key-value pair in the JSON object
  for (const [key, value] of Object.entries(jsonObj)) {
    if (Array.isArray(value)) {
      // If the value is an array, create a separate row for each item
      value.forEach((item) => {
        const escapedKey = escapeMarkdown(key);
        const escapedValue = escapeMarkdown(item);
        allRows.push([escapedKey, escapedValue]);

        // Check if both key and value are within the max widths
        if (escapedKey.length <= maxCol1Width && escapedValue.length <= maxCol2Width) {
          validRowsForWidth.push([escapedKey, escapedValue]);
        }
      });
    } else {
      // For single values, create one row
      const escapedKey = escapeMarkdown(key);
      const escapedValue = escapeMarkdown(value);
      allRows.push([escapedKey, escapedValue]);

      // Check if both key and value are within the max widths
      if (escapedKey.length <= maxCol1Width && escapedValue.length <= maxCol2Width) {
        validRowsForWidth.push([escapedKey, escapedValue]);
      }
    }
  }

  // Determine the maximum width for each column based on valid rows
  const col1Width = Math.min(
    Math.max(
      ...validRowsForWidth.map((row) => row[0].length),
      "Key".length // Minimum width based on header
    ),
    maxCol1Width
  );

  const col2Width = Math.min(
    Math.max(
      ...validRowsForWidth.map((row) => row[1].length),
      "Value".length // Minimum width based on header
    ),
    maxCol2Width
  );

  // Helper function to pad a string with spaces to a desired length
  const pad = (str, length) => {
    if (str.length >= length) return str;
    return str + " ".repeat(length - str.length);
  };

  // Create the table header with padded columns
  const tableHeader =
    `| ${pad("", col1Width)} | ${pad("", col2Width)} |\n` +
    `| ${"-".repeat(col1Width)} | ${"-".repeat(col2Width)} |\n`;

  // Create table rows with padded columns
  const tableRows =
    allRows
      .map((row) => {
        const [col1, col2] = row;
        return `| ${pad(col1, col1Width)} | ${pad(col2, col2Width)} |`;
      })
      .join("\n") + "\n";

  // Combine the header, table header, and all table rows
  return header + tableHeader + tableRows;
}

// Custom plugin to modify the output
// Amplenote is sensitive about the code format and expects to evaluate to a JS Object, so we use this plugin to produce the code in a way it accepts
const amplenoteifyPlugin = {
  name: "amplenoteify",
  setup(build) {
    build.onEnd(async () => {
      const outfilePath = path.resolve("build/compiled.js");

      // Read the content of the outfile
      let modifiedOutput = fs.readFileSync(outfilePath, "utf-8");

      // Modify the output content as needed
      // Amplenote doesn't like the code block to end with a semicolon
      // And it expects a JS object to be returned which iife modules don't do by default
      // So we modify the compiled js to return the plugin object, and remove the final semicolon
      modifiedOutput = modifiedOutput.replace(
        /var plugin_default = plugin;\s*\}\)\(\);/,
        "var plugin_default = plugin;\nreturn plugin;\n})()"
      );

      // Write the modified output back to the file system
      fs.writeFileSync(outfilePath, modifiedOutput);
    });
  },
};

/**
 * Build and generate a markdown file
 * @param {String} compiledCode
 * @param {String} markdownFile Target file name
 */
async function generateMarkdownFile(compiledCode, markdownFile) {
  try {
    // Read the contents of README.md and plugin.config.js
    const readmeContent = fs.readFileSync(README_FILE, "utf-8");

    const { name, description, version, sourceRepo, icon, instructions, setting } = pluginConfig;

    // Prepare metadata table from plugin config using only relevant parameters
    const metadataTable = jsonToMetadataTable({ name, description, icon, instructions, setting });

    // Prepare the compiled code block
    const compiledCodeBlock = "```js\n" + compiledCode + "\n```";

    // Concatenate all parts
    const outputContent = `${readmeContent}

# ${name}${version ? " (" + version + ")" : ""}
    
${metadataTable}

## Code Base:${sourceRepo ? "\n\nSource Repo: [" + sourceRepo + "](" + sourceRepo + ")" : ""}

${compiledCodeBlock}`;

    // Write to the markdown file
    fs.writeFileSync(markdownFile, outputContent);

    console.log(`Successfully generated ${markdownFile}`);
  } catch (err) {
    console.error(`Error generating ${markdownFile}:`, err);
    process.exit(1);
  }
}
/**
 * Build and generate the markdown in a two-step process to generate normal and minified versions
 */
async function buildAndGenerateMarkdown() {
  const outfile = "build/compiled.js";
  const markdownFile = "build/plugin.md";
  const minifiedMarkdownFile = "build/plugin.min.md";

  // Build the code without minification
  await esbuild.build({
    entryPoints: ["lib/plugin.js"],
    bundle: true,
    format: "iife",
    outfile: outfile,
    // packages: "external",
    platform: "browser",
    loader: {
      ".css": "text",
      ".html": "text",
      ".png": "dataurl",
    },
    plugins: [amplenoteifyPlugin],
    minify: false,
    write: true,
  });

  console.log(`Build completed for ${outfile}`);

  // Read the unminified code
  const compiledCode = fs.readFileSync(outfile, "utf-8");

  // Generate the unminified markdown file
  await generateMarkdownFile(compiledCode, markdownFile);

  // Minify the code using esbuild.transform
  const minifiedResult = await esbuild.transform(compiledCode, {
    minify: true,
    loader: "js",
  });

  // Remove the final semicolon from the minified code to make it acceptable by amplenote
  const finalCode = minifiedResult.code.replace(/;[\s]*$/, "");

  // Write the minified code to a file
  fs.writeFileSync("build/compiled.min.js", finalCode);

  console.log("Minified code generated at build/compiled.min.js");

  // Generate the minified markdown file
  await generateMarkdownFile(finalCode, minifiedMarkdownFile);
}

await buildAndGenerateMarkdown();
