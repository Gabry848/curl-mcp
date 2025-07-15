#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { spawn } from "child_process";
import { promisify } from "util";

// Create an MCP server
const server = new Server({
  name: "curl-mcp-server",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {},
    resources: {}
  }
});

// Helper function to execute curl commands
async function executeCurl(curlArgs) {
  return new Promise((resolve, reject) => {
    const curl = spawn('curl', curlArgs, { shell: true });
    
    let stdout = '';
    let stderr = '';
    
    curl.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    curl.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    curl.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Curl failed with code ${code}: ${stderr}`));
      }
    });
    
    curl.on('error', (error) => {
      reject(new Error(`Failed to spawn curl: ${error.message}`));
    });
  });
}

// Helper function to add authentication to curl arguments
function addAuthToCurl(curlArgs, auth) {
  if (auth) {
    switch (auth.type) {
      case 'bearer':
        curlArgs.push('-H', `Authorization: Bearer ${auth.token}`);
        break;
      case 'basic':
        if (auth.username && auth.password) {
          curlArgs.push('-u', `${auth.username}:${auth.password}`);
        }
        break;
      case 'digest':
        if (auth.username && auth.password) {
          curlArgs.push('--digest', '-u', `${auth.username}:${auth.password}`);
        }
        break;
      case 'oauth2':
        curlArgs.push('-H', `Authorization: Bearer ${auth.token}`);
        break;
      case 'api_key':
        if (auth.key && auth.value) {
          curlArgs.push('-H', `${auth.key}: ${auth.value}`);
        }
        break;
      case 'custom':
        if (auth.header) {
          curlArgs.push('-H', auth.header);
        }
        break;
    }
  }
}

// Define authentication schema for reuse
const authSchema = z.object({
  type: z.enum(['bearer', 'basic', 'digest', 'oauth2', 'api_key', 'custom']).describe("Authentication type"),
  token: z.string().optional().describe("Bearer token or OAuth2 token"),
  username: z.string().optional().describe("Username for basic/digest auth"),
  password: z.string().optional().describe("Password for basic/digest auth"),
  key: z.string().optional().describe("API key header name"),
  value: z.string().optional().describe("API key value"),
  header: z.string().optional().describe("Custom authorization header (e.g., 'Authorization: Custom token123')")
}).optional().describe("Authentication configuration");

// Define tool schemas
const httpGetSchema = z.object({
  url: z.string().describe("The URL to make the GET request to"),
  headers: z.record(z.string()).optional().describe("Optional headers to include"),
  auth: authSchema,
  timeout: z.number().optional().describe("Request timeout in seconds (default: 30)"),
  followRedirects: z.boolean().optional().describe("Follow redirects (default: true)"),
  insecure: z.boolean().optional().describe("Allow insecure SSL connections (default: false)")
});

const httpPostSchema = z.object({
  url: z.string().describe("The URL to make the POST request to"),
  data: z.string().optional().describe("Request body data"),
  headers: z.record(z.string()).optional().describe("Optional headers to include"),
  auth: authSchema,
  contentType: z.string().optional().describe("Content-Type header (default: application/json)"),
  timeout: z.number().optional().describe("Request timeout in seconds (default: 30)"),
  followRedirects: z.boolean().optional().describe("Follow redirects (default: true)"),
  insecure: z.boolean().optional().describe("Allow insecure SSL connections (default: false)")
});

const httpPutSchema = z.object({
  url: z.string().describe("The URL to make the PUT request to"),
  data: z.string().optional().describe("Request body data"),
  headers: z.record(z.string()).optional().describe("Optional headers to include"),
  auth: authSchema,
  contentType: z.string().optional().describe("Content-Type header (default: application/json)"),
  timeout: z.number().optional().describe("Request timeout in seconds (default: 30)"),
  followRedirects: z.boolean().optional().describe("Follow redirects (default: true)"),
  insecure: z.boolean().optional().describe("Allow insecure SSL connections (default: false)")
});

const httpDeleteSchema = z.object({
  url: z.string().describe("The URL to make the DELETE request to"),
  headers: z.record(z.string()).optional().describe("Optional headers to include"),
  auth: authSchema,
  timeout: z.number().optional().describe("Request timeout in seconds (default: 30)"),
  followRedirects: z.boolean().optional().describe("Follow redirects (default: true)"),
  insecure: z.boolean().optional().describe("Allow insecure SSL connections (default: false)")
});

const httpHeadSchema = z.object({
  url: z.string().describe("The URL to make the HEAD request to"),
  headers: z.record(z.string()).optional().describe("Optional headers to include"),
  auth: authSchema,
  timeout: z.number().optional().describe("Request timeout in seconds (default: 30)"),
  followRedirects: z.boolean().optional().describe("Follow redirects (default: true)"),
  insecure: z.boolean().optional().describe("Allow insecure SSL connections (default: false)")
});

const curlCustomSchema = z.object({
  args: z.array(z.string()).describe("Array of curl arguments (without 'curl' command itself)")
});

const httpUploadSchema = z.object({
  url: z.string().describe("The URL to upload the file to"),
  filePath: z.string().describe("Path to the file to upload"),
  fieldName: z.string().optional().describe("Form field name for the file (default: file)"),
  headers: z.record(z.string()).optional().describe("Optional headers to include"),
  auth: authSchema,
  timeout: z.number().optional().describe("Request timeout in seconds (default: 60)"),
  insecure: z.boolean().optional().describe("Allow insecure SSL connections (default: false)")
});

const httpDownloadSchema = z.object({
  url: z.string().describe("The URL to download from"),
  outputPath: z.string().describe("Path where to save the downloaded file"),
  headers: z.record(z.string()).optional().describe("Optional headers to include"),
  auth: authSchema,
  timeout: z.number().optional().describe("Request timeout in seconds (default: 300)"),
  followRedirects: z.boolean().optional().describe("Follow redirects (default: true)"),
  insecure: z.boolean().optional().describe("Allow insecure SSL connections (default: false)")
});

const authTestSchema = z.object({
  url: z.string().describe("The URL to test authentication against"),
  auth: authSchema.refine(val => val !== undefined, {
    message: "Authentication configuration is required for this tool"
  }),
  timeout: z.number().optional().describe("Request timeout in seconds (default: 30)"),
  insecure: z.boolean().optional().describe("Allow insecure SSL connections (default: false)")
});

// Set up request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "http_get",
        description: "Perform an HTTP GET request using curl",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "The URL to make the GET request to" },
            headers: { type: "object", additionalProperties: { type: "string" }, description: "Optional headers to include" },
            auth: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["bearer", "basic", "digest", "oauth2", "api_key", "custom"] },
                token: { type: "string", description: "Bearer token or OAuth2 token" },
                username: { type: "string", description: "Username for basic/digest auth" },
                password: { type: "string", description: "Password for basic/digest auth" },
                key: { type: "string", description: "API key header name" },
                value: { type: "string", description: "API key value" },
                header: { type: "string", description: "Custom authorization header" }
              },
              description: "Authentication configuration"
            },
            timeout: { type: "number", description: "Request timeout in seconds (default: 30)" },
            followRedirects: { type: "boolean", description: "Follow redirects (default: true)" },
            insecure: { type: "boolean", description: "Allow insecure SSL connections (default: false)" }
          },
          required: ["url"]
        }
      },
      {
        name: "http_post",
        description: "Perform an HTTP POST request using curl",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "The URL to make the POST request to" },
            data: { type: "string", description: "Request body data" },
            headers: { type: "object", additionalProperties: { type: "string" }, description: "Optional headers to include" },
            auth: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["bearer", "basic", "digest", "oauth2", "api_key", "custom"] },
                token: { type: "string", description: "Bearer token or OAuth2 token" },
                username: { type: "string", description: "Username for basic/digest auth" },
                password: { type: "string", description: "Password for basic/digest auth" },
                key: { type: "string", description: "API key header name" },
                value: { type: "string", description: "API key value" },
                header: { type: "string", description: "Custom authorization header" }
              },
              description: "Authentication configuration"
            },
            contentType: { type: "string", description: "Content-Type header (default: application/json)" },
            timeout: { type: "number", description: "Request timeout in seconds (default: 30)" },
            followRedirects: { type: "boolean", description: "Follow redirects (default: true)" },
            insecure: { type: "boolean", description: "Allow insecure SSL connections (default: false)" }
          },
          required: ["url"]
        }
      },
      {
        name: "http_put",
        description: "Perform an HTTP PUT request using curl",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "The URL to make the PUT request to" },
            data: { type: "string", description: "Request body data" },
            headers: { type: "object", additionalProperties: { type: "string" }, description: "Optional headers to include" },
            auth: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["bearer", "basic", "digest", "oauth2", "api_key", "custom"] },
                token: { type: "string", description: "Bearer token or OAuth2 token" },
                username: { type: "string", description: "Username for basic/digest auth" },
                password: { type: "string", description: "Password for basic/digest auth" },
                key: { type: "string", description: "API key header name" },
                value: { type: "string", description: "API key value" },
                header: { type: "string", description: "Custom authorization header" }
              },
              description: "Authentication configuration"
            },
            contentType: { type: "string", description: "Content-Type header (default: application/json)" },
            timeout: { type: "number", description: "Request timeout in seconds (default: 30)" },
            followRedirects: { type: "boolean", description: "Follow redirects (default: true)" },
            insecure: { type: "boolean", description: "Allow insecure SSL connections (default: false)" }
          },
          required: ["url"]
        }
      },
      {
        name: "http_delete",
        description: "Perform an HTTP DELETE request using curl",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "The URL to make the DELETE request to" },
            headers: { type: "object", additionalProperties: { type: "string" }, description: "Optional headers to include" },
            auth: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["bearer", "basic", "digest", "oauth2", "api_key", "custom"] },
                token: { type: "string", description: "Bearer token or OAuth2 token" },
                username: { type: "string", description: "Username for basic/digest auth" },
                password: { type: "string", description: "Password for basic/digest auth" },
                key: { type: "string", description: "API key header name" },
                value: { type: "string", description: "API key value" },
                header: { type: "string", description: "Custom authorization header" }
              },
              description: "Authentication configuration"
            },
            timeout: { type: "number", description: "Request timeout in seconds (default: 30)" },
            followRedirects: { type: "boolean", description: "Follow redirects (default: true)" },
            insecure: { type: "boolean", description: "Allow insecure SSL connections (default: false)" }
          },
          required: ["url"]
        }
      },
      {
        name: "http_head",
        description: "Perform an HTTP HEAD request using curl",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "The URL to make the HEAD request to" },
            headers: { type: "object", additionalProperties: { type: "string" }, description: "Optional headers to include" },
            auth: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["bearer", "basic", "digest", "oauth2", "api_key", "custom"] },
                token: { type: "string", description: "Bearer token or OAuth2 token" },
                username: { type: "string", description: "Username for basic/digest auth" },
                password: { type: "string", description: "Password for basic/digest auth" },
                key: { type: "string", description: "API key header name" },
                value: { type: "string", description: "API key value" },
                header: { type: "string", description: "Custom authorization header" }
              },
              description: "Authentication configuration"
            },
            timeout: { type: "number", description: "Request timeout in seconds (default: 30)" },
            followRedirects: { type: "boolean", description: "Follow redirects (default: true)" },
            insecure: { type: "boolean", description: "Allow insecure SSL connections (default: false)" }
          },
          required: ["url"]
        }
      },
      {
        name: "curl_custom",
        description: "Execute a custom curl command with full control over parameters",
        inputSchema: {
          type: "object",
          properties: {
            args: { type: "array", items: { type: "string" }, description: "Array of curl arguments (without 'curl' command itself)" }
          },
          required: ["args"]
        }
      },
      {
        name: "http_upload",
        description: "Upload a file using HTTP POST with curl",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "The URL to upload the file to" },
            filePath: { type: "string", description: "Path to the file to upload" },
            fieldName: { type: "string", description: "Form field name for the file (default: file)" },
            headers: { type: "object", additionalProperties: { type: "string" }, description: "Optional headers to include" },
            auth: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["bearer", "basic", "digest", "oauth2", "api_key", "custom"] },
                token: { type: "string", description: "Bearer token or OAuth2 token" },
                username: { type: "string", description: "Username for basic/digest auth" },
                password: { type: "string", description: "Password for basic/digest auth" },
                key: { type: "string", description: "API key header name" },
                value: { type: "string", description: "API key value" },
                header: { type: "string", description: "Custom authorization header" }
              },
              description: "Authentication configuration"
            },
            timeout: { type: "number", description: "Request timeout in seconds (default: 60)" },
            insecure: { type: "boolean", description: "Allow insecure SSL connections (default: false)" }
          },
          required: ["url", "filePath"]
        }
      },
      {
        name: "http_download",
        description: "Download a file using curl",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "The URL to download from" },
            outputPath: { type: "string", description: "Path where to save the downloaded file" },
            headers: { type: "object", additionalProperties: { type: "string" }, description: "Optional headers to include" },
            auth: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["bearer", "basic", "digest", "oauth2", "api_key", "custom"] },
                token: { type: "string", description: "Bearer token or OAuth2 token" },
                username: { type: "string", description: "Username for basic/digest auth" },
                password: { type: "string", description: "Password for basic/digest auth" },
                key: { type: "string", description: "API key header name" },
                value: { type: "string", description: "API key value" },
                header: { type: "string", description: "Custom authorization header" }
              },
              description: "Authentication configuration"
            },
            timeout: { type: "number", description: "Request timeout in seconds (default: 300)" },
            followRedirects: { type: "boolean", description: "Follow redirects (default: true)" },
            insecure: { type: "boolean", description: "Allow insecure SSL connections (default: false)" }
          },
          required: ["url", "outputPath"]
        }
      },
      {
        name: "auth_test",
        description: "Test different authentication methods with a simple GET request",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "The URL to test authentication against" },
            auth: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["bearer", "basic", "digest", "oauth2", "api_key", "custom"] },
                token: { type: "string", description: "Bearer token or OAuth2 token" },
                username: { type: "string", description: "Username for basic/digest auth" },
                password: { type: "string", description: "Password for basic/digest auth" },
                key: { type: "string", description: "API key header name" },
                value: { type: "string", description: "API key value" },
                header: { type: "string", description: "Custom authorization header" }
              },
              description: "Authentication configuration",
              required: ["type"]
            },
            timeout: { type: "number", description: "Request timeout in seconds (default: 30)" },
            insecure: { type: "boolean", description: "Allow insecure SSL connections (default: false)" }
          },
          required: ["url", "auth"]
        }
      }
    ]
  };
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "http_get": {
        const { url, headers, auth, timeout = 30, followRedirects = true, insecure = false } = args;
        const curlArgs = ['-s', '-w', '\\n\\nHTTP_CODE:%{http_code}\\nTIME_TOTAL:%{time_total}'];
        
        if (followRedirects) curlArgs.push('-L');
        if (insecure) curlArgs.push('-k');
        if (timeout) curlArgs.push('--max-time', timeout.toString());
        
        addAuthToCurl(curlArgs, auth);
        
        if (headers) {
          for (const [key, value] of Object.entries(headers)) {
            curlArgs.push('-H', `${key}: ${value}`);
          }
        }
        
        curlArgs.push(url);
        
        const result = await executeCurl(curlArgs);
        return {
          content: [{ type: "text", text: result }]
        };
      }

      case "http_post": {
        const { url, data, headers, auth, contentType = "application/json", timeout = 30, followRedirects = true, insecure = false } = args;
        const curlArgs = ['-s', '-w', '\\n\\nHTTP_CODE:%{http_code}\\nTIME_TOTAL:%{time_total}', '-X', 'POST'];
        
        if (followRedirects) curlArgs.push('-L');
        if (insecure) curlArgs.push('-k');
        if (timeout) curlArgs.push('--max-time', timeout.toString());
        
        addAuthToCurl(curlArgs, auth);
        
        if (data) {
          curlArgs.push('-d', data);
          curlArgs.push('-H', `Content-Type: ${contentType}`);
        }
        
        if (headers) {
          for (const [key, value] of Object.entries(headers)) {
            curlArgs.push('-H', `${key}: ${value}`);
          }
        }
        
        curlArgs.push(url);
        
        const result = await executeCurl(curlArgs);
        return {
          content: [{ type: "text", text: result }]
        };
      }

      case "http_put": {
        const { url, data, headers, auth, contentType = "application/json", timeout = 30, followRedirects = true, insecure = false } = args;
        const curlArgs = ['-s', '-w', '\\n\\nHTTP_CODE:%{http_code}\\nTIME_TOTAL:%{time_total}', '-X', 'PUT'];
        
        if (followRedirects) curlArgs.push('-L');
        if (insecure) curlArgs.push('-k');
        if (timeout) curlArgs.push('--max-time', timeout.toString());
        
        addAuthToCurl(curlArgs, auth);
        
        if (data) {
          curlArgs.push('-d', data);
          curlArgs.push('-H', `Content-Type: ${contentType}`);
        }
        
        if (headers) {
          for (const [key, value] of Object.entries(headers)) {
            curlArgs.push('-H', `${key}: ${value}`);
          }
        }
        
        curlArgs.push(url);
        
        const result = await executeCurl(curlArgs);
        return {
          content: [{ type: "text", text: result }]
        };
      }

      case "http_delete": {
        const { url, headers, auth, timeout = 30, followRedirects = true, insecure = false } = args;
        const curlArgs = ['-s', '-w', '\\n\\nHTTP_CODE:%{http_code}\\nTIME_TOTAL:%{time_total}', '-X', 'DELETE'];
        
        if (followRedirects) curlArgs.push('-L');
        if (insecure) curlArgs.push('-k');
        if (timeout) curlArgs.push('--max-time', timeout.toString());
        
        addAuthToCurl(curlArgs, auth);
        
        if (headers) {
          for (const [key, value] of Object.entries(headers)) {
            curlArgs.push('-H', `${key}: ${value}`);
          }
        }
        
        curlArgs.push(url);
        
        const result = await executeCurl(curlArgs);
        return {
          content: [{ type: "text", text: result }]
        };
      }

      case "http_head": {
        const { url, headers, auth, timeout = 30, followRedirects = true, insecure = false } = args;
        const curlArgs = ['-s', '-I', '-w', '\\n\\nHTTP_CODE:%{http_code}\\nTIME_TOTAL:%{time_total}'];
        
        if (followRedirects) curlArgs.push('-L');
        if (insecure) curlArgs.push('-k');
        if (timeout) curlArgs.push('--max-time', timeout.toString());
        
        addAuthToCurl(curlArgs, auth);
        
        if (headers) {
          for (const [key, value] of Object.entries(headers)) {
            curlArgs.push('-H', `${key}: ${value}`);
          }
        }
        
        curlArgs.push(url);
        
        const result = await executeCurl(curlArgs);
        return {
          content: [{ type: "text", text: result }]
        };
      }

      case "curl_custom": {
        const { args: curlArgs } = args;
        const result = await executeCurl(curlArgs);
        return {
          content: [{ type: "text", text: result }]
        };
      }

      case "http_upload": {
        const { url, filePath, fieldName = "file", headers, auth, timeout = 60, insecure = false } = args;
        const curlArgs = ['-s', '-w', '\\n\\nHTTP_CODE:%{http_code}\\nTIME_TOTAL:%{time_total}'];
        
        if (insecure) curlArgs.push('-k');
        if (timeout) curlArgs.push('--max-time', timeout.toString());
        
        addAuthToCurl(curlArgs, auth);
        
        curlArgs.push('-F', `${fieldName}=@${filePath}`);
        
        if (headers) {
          for (const [key, value] of Object.entries(headers)) {
            curlArgs.push('-H', `${key}: ${value}`);
          }
        }
        
        curlArgs.push(url);
        
        const result = await executeCurl(curlArgs);
        return {
          content: [{ type: "text", text: `File uploaded successfully to: ${url}\n${result}` }]
        };
      }

      case "http_download": {
        const { url, outputPath, headers, auth, timeout = 300, followRedirects = true, insecure = false } = args;
        const curlArgs = ['-s', '-w', '\\n\\nHTTP_CODE:%{http_code}\\nTIME_TOTAL:%{time_total}', '-o', outputPath];
        
        if (followRedirects) curlArgs.push('-L');
        if (insecure) curlArgs.push('-k');
        if (timeout) curlArgs.push('--max-time', timeout.toString());
        
        addAuthToCurl(curlArgs, auth);
        
        if (headers) {
          for (const [key, value] of Object.entries(headers)) {
            curlArgs.push('-H', `${key}: ${value}`);
          }
        }
        
        curlArgs.push(url);
        
        const result = await executeCurl(curlArgs);
        return {
          content: [{ type: "text", text: `File downloaded successfully to: ${outputPath}\n${result}` }]
        };
      }

      case "auth_test": {
        const { url, auth, timeout = 30, insecure = false } = args;
        const curlArgs = ['-s', '-w', '\\n\\nHTTP_CODE:%{http_code}\\nTIME_TOTAL:%{time_total}', '-v'];
        
        if (insecure) curlArgs.push('-k');
        if (timeout) curlArgs.push('--max-time', timeout.toString());
        
        addAuthToCurl(curlArgs, auth);
        
        curlArgs.push(url);
        
        const result = await executeCurl(curlArgs);
        return {
          content: [{ 
            type: "text", 
            text: `Authentication test completed with ${auth.type} authentication:\n\n${result}` 
          }]
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true
        };
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

// Resource handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "http://info/tools",
        name: "HTTP Tools Information",
        description: "Information about available HTTP tools",
        mimeType: "text/plain"
      },
      {
        uri: "http://info/auth",
        name: "Authentication Information",
        description: "Information about authentication methods",
        mimeType: "text/plain"
      },
      {
        uri: "http://info/examples",
        name: "Usage Examples",
        description: "Examples of how to use the tools",
        mimeType: "text/plain"
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  
  const infoMap = {
    "http://info/tools": `Available HTTP tools:
- http_get: Perform GET requests
- http_post: Perform POST requests  
- http_put: Perform PUT requests
- http_delete: Perform DELETE requests
- http_head: Perform HEAD requests
- curl_custom: Execute custom curl commands
- http_upload: Upload files via HTTP POST
- http_download: Download files via HTTP GET
- auth_test: Test authentication methods

All tools support:
- Custom headers
- Authentication (Bearer, Basic, Digest, OAuth2, API Key, Custom)
- Timeout configuration
- SSL/TLS options
- Redirect handling`,
    
    "http://info/auth": `Authentication types supported:
1. Bearer Token:
   { "type": "bearer", "token": "your-jwt-token" }

2. Basic Authentication:
   { "type": "basic", "username": "user", "password": "pass" }

3. Digest Authentication:
   { "type": "digest", "username": "user", "password": "pass" }

4. OAuth2 Token:
   { "type": "oauth2", "token": "your-oauth2-token" }

5. API Key in Header:
   { "type": "api_key", "key": "X-API-Key", "value": "your-api-key" }

6. Custom Authorization:
   { "type": "custom", "header": "Authorization: Custom token123" }`,
   
    "http://info/examples": `Authentication examples:
1. Bearer token API call:
   auth: { "type": "bearer", "token": "eyJhbGciOiJIUzI1NiIs..." }

2. Basic auth login:
   auth: { "type": "basic", "username": "admin", "password": "secret" }

3. API key in header:
   auth: { "type": "api_key", "key": "X-API-Key", "value": "abc123" }

4. Custom OAuth header:
   auth: { "type": "custom", "header": "Authorization: OAuth oauth_token=abc123" }

5. Test authentication:
   Use auth_test tool to verify credentials work correctly`
  };
  
  const content = infoMap[uri];
  if (!content) {
    throw new Error(`Resource not found: ${uri}`);
  }
  
  return {
    contents: [{
      uri,
      mimeType: "text/plain",
      text: content
    }]
  };
});

// Start the server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Curl MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});