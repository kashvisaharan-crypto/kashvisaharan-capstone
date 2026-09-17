// Real MCP (Model Context Protocol) client connection to the official
// filesystem MCP server. This is what makes the "MCP connector" requirement
// genuine rather than just plain fs.readFileSync/writeFileSync calls.
//
// The agent connects to this server as an MCP client and calls its tools
// (read_text_file, write_file) instead of touching the filesystem directly.

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const path = require("path");

let client = null;

// Connects once at server startup. allowedDir scopes the MCP server to only
// this folder, same safety principle as the Claude Code setup.
async function connectFilesystemMCP(allowedDir) {
  const serverBin = path.join(
    __dirname,
    "node_modules",
    "@modelcontextprotocol",
    "server-filesystem",
    "dist",
    "index.js"
  );

  const transport = new StdioClientTransport({
    command: "node",
    args: [serverBin, allowedDir]
  });

  client = new Client({ name: "meal-billing-agent", version: "1.0.0" });
  await client.connect(transport);
  console.log("[MCP] Connected to filesystem MCP server, scoped to:", allowedDir);
}

async function readJSONViaMCP(absolutePath) {
  const result = await client.callTool({
    name: "read_text_file",
    arguments: { path: absolutePath }
  });
  const text = result.content?.[0]?.text ?? result.structuredContent?.content;
  return JSON.parse(text);
}

async function writeJSONViaMCP(absolutePath, data) {
  await client.callTool({
    name: "write_file",
    arguments: {
      path: absolutePath,
      content: JSON.stringify(data, null, 2)
    }
  });
}

module.exports = { connectFilesystemMCP, readJSONViaMCP, writeJSONViaMCP };
