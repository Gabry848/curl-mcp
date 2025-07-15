import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "child_process";
import { promisify } from "util";

// Create an MCP server
const server = new McpServer({
  name: "curl-mcp-server",
  version: "1.0.0"
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

// HTTP GET request tool
server.registerTool("http_get",
  {
    title: "HTTP GET Request",
    description: "Perform an HTTP GET request using curl",
    inputSchema: z.object({
      url: z.string().describe("The URL to make the GET request to"),
      headers: z.record(z.string()).optional().describe("Optional headers to include"),
      auth: authSchema,
      timeout: z.number().optional().describe("Request timeout in seconds (default: 30)"),
      followRedirects: z.boolean().optional().describe("Follow redirects (default: true)"),
      insecure: z.boolean().optional().describe("Allow insecure SSL connections (default: false)")
    })
  },
  async ({ url, headers, auth, timeout = 30, followRedirects = true, insecure = false }) => {
    try {
      const curlArgs = ['-s', '-w', '\\n\\nHTTP_CODE:%{http_code}\\nTIME_TOTAL:%{time_total}'];
      
      if (followRedirects) curlArgs.push('-L');
      if (insecure) curlArgs.push('-k');
      if (timeout) curlArgs.push('--max-time', timeout.toString());
      
      // Add authentication
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
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }]
      };
    }
  }
);

// HTTP POST request tool
server.registerTool("http_post",
  {
    title: "HTTP POST Request",
    description: "Perform an HTTP POST request using curl",
    inputSchema: z.object({
      url: z.string().describe("The URL to make the POST request to"),
      data: z.string().optional().describe("Request body data"),
      headers: z.record(z.string()).optional().describe("Optional headers to include"),
      auth: authSchema,
      contentType: z.string().optional().describe("Content-Type header (default: application/json)"),
      timeout: z.number().optional().describe("Request timeout in seconds (default: 30)"),
      followRedirects: z.boolean().optional().describe("Follow redirects (default: true)"),
      insecure: z.boolean().optional().describe("Allow insecure SSL connections (default: false)")
    })
  },
  async ({ url, data, headers, auth, contentType = "application/json", timeout = 30, followRedirects = true, insecure = false }) => {
    try {
      const curlArgs = ['-s', '-w', '\\n\\nHTTP_CODE:%{http_code}\\nTIME_TOTAL:%{time_total}', '-X', 'POST'];
      
      if (followRedirects) curlArgs.push('-L');
      if (insecure) curlArgs.push('-k');
      if (timeout) curlArgs.push('--max-time', timeout.toString());
      
      // Add authentication
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
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }]
      };
    }
  }
);

// HTTP PUT request tool
server.registerTool("http_put",
  {
    title: "HTTP PUT Request",
    description: "Perform an HTTP PUT request using curl",
    inputSchema: z.object({
      url: z.string().describe("The URL to make the PUT request to"),
      data: z.string().optional().describe("Request body data"),
      headers: z.record(z.string()).optional().describe("Optional headers to include"),
      auth: authSchema,
      contentType: z.string().optional().describe("Content-Type header (default: application/json)"),
      timeout: z.number().optional().describe("Request timeout in seconds (default: 30)"),
      followRedirects: z.boolean().optional().describe("Follow redirects (default: true)"),
      insecure: z.boolean().optional().describe("Allow insecure SSL connections (default: false)")
    })
  },
  async ({ url, data, headers, auth, contentType = "application/json", timeout = 30, followRedirects = true, insecure = false }) => {
    try {
      const curlArgs = ['-s', '-w', '\\n\\nHTTP_CODE:%{http_code}\\nTIME_TOTAL:%{time_total}', '-X', 'PUT'];
      
      if (followRedirects) curlArgs.push('-L');
      if (insecure) curlArgs.push('-k');
      if (timeout) curlArgs.push('--max-time', timeout.toString());
      
      // Add authentication
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
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }]
      };
    }
  }
);

// HTTP DELETE request tool
server.registerTool("http_delete",
  {
    title: "HTTP DELETE Request",
    description: "Perform an HTTP DELETE request using curl",
    inputSchema: z.object({
      url: z.string().describe("The URL to make the DELETE request to"),
      headers: z.record(z.string()).optional().describe("Optional headers to include"),
      auth: authSchema,
      timeout: z.number().optional().describe("Request timeout in seconds (default: 30)"),
      followRedirects: z.boolean().optional().describe("Follow redirects (default: true)"),
      insecure: z.boolean().optional().describe("Allow insecure SSL connections (default: false)")
    })
  },
  async ({ url, headers, auth, timeout = 30, followRedirects = true, insecure = false }) => {
    try {
      const curlArgs = ['-s', '-w', '\\n\\nHTTP_CODE:%{http_code}\\nTIME_TOTAL:%{time_total}', '-X', 'DELETE'];
      
      if (followRedirects) curlArgs.push('-L');
      if (insecure) curlArgs.push('-k');
      if (timeout) curlArgs.push('--max-time', timeout.toString());
      
      // Add authentication
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
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }]
      };
    }
  }
);

// HTTP HEAD request tool
server.registerTool("http_head",
  {
    title: "HTTP HEAD Request",
    description: "Perform an HTTP HEAD request using curl",
    inputSchema: z.object({
      url: z.string().describe("The URL to make the HEAD request to"),
      headers: z.record(z.string()).optional().describe("Optional headers to include"),
      auth: authSchema,
      timeout: z.number().optional().describe("Request timeout in seconds (default: 30)"),
      followRedirects: z.boolean().optional().describe("Follow redirects (default: true)"),
      insecure: z.boolean().optional().describe("Allow insecure SSL connections (default: false)")
    })
  },
  async ({ url, headers, auth, timeout = 30, followRedirects = true, insecure = false }) => {
    try {
      const curlArgs = ['-s', '-I', '-w', '\\n\\nHTTP_CODE:%{http_code}\\nTIME_TOTAL:%{time_total}'];
      
      if (followRedirects) curlArgs.push('-L');
      if (insecure) curlArgs.push('-k');
      if (timeout) curlArgs.push('--max-time', timeout.toString());
      
      // Add authentication
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
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }]
      };
    }
  }
);

// Custom curl command tool
server.registerTool("curl_custom",
  {
    title: "Custom Curl Command",
    description: "Execute a custom curl command with full control over parameters",
    inputSchema: z.object({
      args: z.array(z.string()).describe("Array of curl arguments (without 'curl' command itself)")
    })
  },
  async ({ args }) => {
    try {
      const result = await executeCurl(args);
      return {
        content: [{ type: "text", text: result }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }]
      };
    }
  }
);

// File upload tool
server.registerTool("http_upload",
  {
    title: "HTTP File Upload",
    description: "Upload a file using HTTP POST with curl",
    inputSchema: z.object({
      url: z.string().describe("The URL to upload the file to"),
      filePath: z.string().describe("Path to the file to upload"),
      fieldName: z.string().optional().describe("Form field name for the file (default: file)"),
      headers: z.record(z.string()).optional().describe("Optional headers to include"),
      auth: authSchema,
      timeout: z.number().optional().describe("Request timeout in seconds (default: 60)"),
      insecure: z.boolean().optional().describe("Allow insecure SSL connections (default: false)")
    })
  },
  async ({ url, filePath, fieldName = "file", headers, auth, timeout = 60, insecure = false }) => {
    try {
      const curlArgs = ['-s', '-w', '\\n\\nHTTP_CODE:%{http_code}\\nTIME_TOTAL:%{time_total}'];
      
      if (insecure) curlArgs.push('-k');
      if (timeout) curlArgs.push('--max-time', timeout.toString());
      
      // Add authentication
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
        content: [{ type: "text", text: result }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }]
      };
    }
  }
);

// Download file tool
server.registerTool("http_download",
  {
    title: "HTTP Download File",
    description: "Download a file using curl",
    inputSchema: z.object({
      url: z.string().describe("The URL to download from"),
      outputPath: z.string().describe("Path where to save the downloaded file"),
      headers: z.record(z.string()).optional().describe("Optional headers to include"),
      auth: authSchema,
      timeout: z.number().optional().describe("Request timeout in seconds (default: 300)"),
      followRedirects: z.boolean().optional().describe("Follow redirects (default: true)"),
      insecure: z.boolean().optional().describe("Allow insecure SSL connections (default: false)")
    })
  },
  async ({ url, outputPath, headers, auth, timeout = 300, followRedirects = true, insecure = false }) => {
    try {
      const curlArgs = ['-s', '-w', '\\n\\nHTTP_CODE:%{http_code}\\nTIME_TOTAL:%{time_total}', '-o', outputPath];
      
      if (followRedirects) curlArgs.push('-L');
      if (insecure) curlArgs.push('-k');
      if (timeout) curlArgs.push('--max-time', timeout.toString());
      
      // Add authentication
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
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }]
      };
    }
  }
);

// Add a resource for HTTP request history
server.registerResource(
  "http_info",
  new ResourceTemplate("http://info/{type}", { list: undefined }),
  { 
    title: "HTTP Information",
    description: "Information about HTTP tools and curl usage"
  },
  async (uri, { type }) => {
    const infoMap = {
      "tools": `Available HTTP tools:
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
      "auth": `Authentication types supported:
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
      "examples": `Authentication examples:
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
    
    return {
      contents: [{
        uri: uri.href,
        text: infoMap[type] || "Unknown info type. Available: tools, auth, examples"
      }]
    };
  }
);

// Authentication test tool
server.registerTool("auth_test",
  {
    title: "Test Authentication",
    description: "Test different authentication methods with a simple GET request",
    inputSchema: z.object({
      url: z.string().describe("The URL to test authentication against"),
      auth: authSchema.refine(val => val !== undefined, {
        message: "Authentication configuration is required for this tool"
      }),
      timeout: z.number().optional().describe("Request timeout in seconds (default: 30)"),
      insecure: z.boolean().optional().describe("Allow insecure SSL connections (default: false)")
    })
  },
  async ({ url, auth, timeout = 30, insecure = false }) => {
    try {
      const curlArgs = ['-s', '-w', '\\n\\nHTTP_CODE:%{http_code}\\nTIME_TOTAL:%{time_total}\\nAUTH_TYPE:%{auth_type}', '-v'];
      
      if (insecure) curlArgs.push('-k');
      if (timeout) curlArgs.push('--max-time', timeout.toString());
      
      // Add authentication
      addAuthToCurl(curlArgs, auth);
      
      curlArgs.push(url);
      
      const result = await executeCurl(curlArgs);
      return {
        content: [{ 
          type: "text", 
          text: `Authentication test completed with ${auth.type} authentication:\n\n${result}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Authentication test failed: ${error.message}` }]
      };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);