# Esempi di Autenticazione - Curl MCP Server

## Tipi di Autenticazione Supportati

### 1. Bearer Token Authentication
```json
{
  "type": "bearer",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 2. Basic Authentication
```json
{
  "type": "basic",
  "username": "admin",
  "password": "secret123"
}
```

### 3. Digest Authentication
```json
{
  "type": "digest",
  "username": "user",
  "password": "password123"
}
```

### 4. OAuth2 Token
```json
{
  "type": "oauth2",
  "token": "ya29.a0ARrdaM-oauth2-token-here"
}
```

### 5. API Key in Header
```json
{
  "type": "api_key",
  "key": "X-API-Key",
  "value": "abc123def456"
}
```

### 6. Custom Authorization Header
```json
{
  "type": "custom",
  "header": "Authorization: Custom token123"
}
```

## Esempi di Utilizzo

### GET Request con Bearer Token
```javascript
// Tool: http_get
{
  "url": "https://api.example.com/protected",
  "auth": {
    "type": "bearer",
    "token": "your-jwt-token-here"
  }
}
```

### POST Request con Basic Auth
```javascript
// Tool: http_post
{
  "url": "https://api.example.com/login",
  "data": "{\"action\": \"login\"}",
  "auth": {
    "type": "basic",
    "username": "user",
    "password": "pass"
  }
}
```

### Upload File con API Key
```javascript
// Tool: http_upload
{
  "url": "https://api.example.com/upload",
  "filePath": "/path/to/file.jpg",
  "auth": {
    "type": "api_key",
    "key": "X-API-Key",
    "value": "your-api-key"
  }
}
```

### Test Authentication
```javascript
// Tool: auth_test
{
  "url": "https://httpbin.org/bearer",
  "auth": {
    "type": "bearer",
    "token": "test-token"
  }
}
```

## Curl Commands Generati

Il server genera automaticamente i comandi curl appropriati:

- **Bearer**: `-H "Authorization: Bearer token"`
- **Basic**: `-u "username:password"`
- **Digest**: `--digest -u "username:password"`
- **OAuth2**: `-H "Authorization: Bearer token"`
- **API Key**: `-H "Custom-Header: value"`
- **Custom**: `-H "Custom authorization header"`

## Sicurezza

- Le credenziali sono passate direttamente a curl senza essere salvate
- Supporto per connessioni SSL/TLS sicure
- Opzione `insecure` per testing con certificati self-signed
- Timeout configurabile per evitare richieste infinite
