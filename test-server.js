#!/usr/bin/env node

// Simple test to verify the server works
import { spawn } from 'child_process';
import { readFileSync } from 'fs';

// Simple MCP client test
const testClient = () => {
  const server = spawn('node', ['index.js'], { stdio: 'pipe' });
  
  let output = '';
  
  server.stdout.on('data', (data) => {
    output += data.toString();
    console.log('Server output:', data.toString());
  });
  
  server.stderr.on('data', (data) => {
    console.log('Server stderr:', data.toString());
  });
  
  // Send initialize request
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: {
          listChanged: false
        }
      },
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  };
  
  server.stdin.write(JSON.stringify(initRequest) + '\n');
  
  // Wait for response and then request tools
  setTimeout(() => {
    const listToolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    };
    
    server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
    
    setTimeout(() => {
      server.kill();
      console.log('Test completed');
    }, 1000);
  }, 1000);
};

testClient();
