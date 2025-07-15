# Curl MCP Server

Un server MCP (Model Context Protocol) che fornisce strumenti HTTP/HTTPS completi utilizzando curl. Questo server consente di eseguire richieste HTTP con supporto per vari metodi di autenticazione, upload di file, download e comandi curl personalizzati.

## Caratteristiche

- **Richieste HTTP complete**: GET, POST, PUT, DELETE, HEAD
- **Autenticazione multipla**: Bearer Token, Basic Auth, Digest Auth, OAuth2, API Key, Custom Headers
- **Upload e Download di file**: Caricamento e scaricamento di file tramite HTTP
- **Comandi curl personalizzati**: Esecuzione di comandi curl con controllo completo
- **Test di autenticazione**: Verifica delle credenziali di accesso
- **Configurazione avanzata**: Timeout, redirect, SSL/TLS, headers personalizzati

## Installazione

1. Clona o scarica il progetto

2. Installa le dipendenze:

```bash
npm install
```

## Strumenti Disponibili

### 1. http_get

Esegue richieste HTTP GET

- **Parametri**: url, headers, auth, timeout, followRedirects, insecure

### 2. http_post

Esegue richieste HTTP POST

- **Parametri**: url, data, headers, auth, contentType, timeout, followRedirects, insecure

### 3. http_put

Esegue richieste HTTP PUT

- **Parametri**: url, data, headers, auth, contentType, timeout, followRedirects, insecure

### 4. http_delete

Esegue richieste HTTP DELETE

- **Parametri**: url, headers, auth, timeout, followRedirects, insecure

### 5. http_head

Esegue richieste HTTP HEAD

- **Parametri**: url, headers, auth, timeout, followRedirects, insecure

### 6. curl_custom

Esegue comandi curl personalizzati

- **Parametri**: args (array di argomenti curl)

### 7. http_upload

Carica file tramite HTTP POST

- **Parametri**: url, filePath, fieldName, headers, auth, timeout, insecure

### 8. http_download

Scarica file tramite HTTP GET

- **Parametri**: url, outputPath, headers, auth, timeout, followRedirects, insecure

### 9. auth_test

Testa i metodi di autenticazione

- **Parametri**: url, auth, timeout, insecure

## Metodi di Autenticazione Supportati

### Bearer Token

```json
{
  "type": "bearer",
  "token": "your-jwt-token"
}
```

### Basic Authentication

```json
{
  "type": "basic",
  "username": "user",
  "password": "password"
}
```

### Digest Authentication

```json
{
  "type": "digest",
  "username": "user",
  "password": "password"
}
```

### OAuth2 Token

```json
{
  "type": "oauth2",
  "token": "your-oauth2-token"
}
```

### API Key in Header

```json
{
  "type": "api_key",
  "key": "X-API-Key",
  "value": "your-api-key"
}
```

### Custom Authorization

```json
{
  "type": "custom",
  "header": "Authorization: Custom token123"
}
```

## Configurazione per Client MCP

### Per Claude Desktop

Aggiungi questa configurazione al file di configurazione di Claude Desktop:

```json
{
  "mcpServers": {
    "curl-mcp": {
      "command": "node",
      "args": ["e:\\MCP_servers\\curl-mcp\\index.js"],
      "env": {}
    }
  }
}
```

### Per altri client MCP

Usa la configurazione seguente:

```json
{
  "name": "curl-mcp-server",
  "version": "1.0.0",
  "command": "node",
  "args": ["percorso/assoluto/al/index.js"],
  "transport": "stdio"
}
```

## Esempi di Utilizzo

### Richiesta GET semplice

```javascript
// Attraverso il client MCP
{
  "tool": "http_get",
  "arguments": {
    "url": "https://api.example.com/data"
  }
}
```

### Richiesta POST con autenticazione Bearer

```javascript
{
  "tool": "http_post",
  "arguments": {
    "url": "https://api.example.com/data",
    "data": "{\"name\": \"test\"}",
    "auth": {
      "type": "bearer",
      "token": "your-jwt-token"
    },
    "headers": {
      "Content-Type": "application/json"
    }
  }
}
```

### Upload di file

```javascript
{
  "tool": "http_upload",
  "arguments": {
    "url": "https://api.example.com/upload",
    "filePath": "/path/to/file.jpg",
    "fieldName": "image",
    "auth": {
      "type": "api_key",
      "key": "X-API-Key",
      "value": "your-api-key"
    }
  }
}
```

### Comando curl personalizzato

```javascript
{
  "tool": "curl_custom",
  "arguments": {
    "args": ["-X", "PATCH", "-H", "Content-Type: application/json", "-d", "{\"status\": \"active\"}", "https://api.example.com/users/123"]
  }
}
```

## Risorse Disponibili

Il server fornisce risorse informative accessibili tramite:

- `http://info/tools` - Lista degli strumenti disponibili
- `http://info/auth` - Tipi di autenticazione supportati
- `http://info/examples` - Esempi di utilizzo dell'autenticazione

## Avvio del Server

### Modalità normale

```bash
npm start
```

### Modalità sviluppo (con watch)

```bash
npm run dev
```

## Requisiti di Sistema

- Node.js 18 o superiore
- curl installato e disponibile nel PATH del sistema
- Accesso di rete per le richieste HTTP/HTTPS

## Sicurezza

- Tutti i comandi curl sono eseguiti in modo sicuro utilizzando spawn
- Supporto per SSL/TLS con opzione per connessioni insicure quando necessario
- Validazione degli input tramite schema Zod
- Gestione degli errori per prevenire crash del server

## Troubleshooting

### Errore "curl: command not found"

Assicurati che curl sia installato e disponibile nel PATH:

- Windows: Installa curl o usa Windows Subsystem for Linux
- macOS: curl è preinstallato
- Linux: `sudo apt-get install curl` (Ubuntu/Debian) o equivalente

### Timeout delle richieste

Aumenta il valore del timeout nei parametri degli strumenti se necessario (default: 30 secondi per la maggior parte delle operazioni, 60 per upload, 300 per download).

### Problemi SSL/TLS

Usa il parametro `insecure: true` per bypassare la verifica dei certificati SSL (solo per testing).

## Licenza

MIT License - Vedi il file LICENSE per i dettagli.
