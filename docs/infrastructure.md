# Infrastructure Setup

This document describes the complete setup for the appointment booking application infrastructure.

## Architecture Overview

The application consists of three Docker containers:

1. **PostgreSQL Database** - Data persistence
2. **SvelteKit Application** - Web application (production only)
3. **Caddy Reverse Proxy** - HTTPS termination and routing (production only)

## Development Setup

Development runs only the PostgreSQL database with a public port for development tools.

### Prerequisites

- Docker and Docker Compose
- Node.js 24+
- Git

### Setup Steps

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd appointment-booking-software
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set secure values:

   ```
   POSTGRES_DB=appointment_booking
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_secure_development_password
   POSTGRES_PORT=5432
   ```

3. **Start development database**

   ```bash
   npm run docker:dev:up
   ```

4. **Verify database connection**

   ```bash
   # Check container status
   docker ps

   # Test connection
   psql -h localhost -U postgres -d appointment_booking
   ```

5. **Install SvelteKit dependencies** (when SvelteKit code is added)

   ```bash
   npm install
   ```

6. **Start SvelteKit development server** (when SvelteKit code is added)
   ```bash
   npm run dev
   ```

### Development Commands

```bash
# Database management
npm run docker:dev:up        # Start PostgreSQL
npm run docker:dev:down      # Stop PostgreSQL
npm run docker:dev:logs      # View database logs
npm run docker:dev:clean     # Remove containers and volumes

# Application (when SvelteKit is implemented)
npm run dev                  # Start development server
npm run build               # Build for production
```

## Production Setup

Production runs all three containers with security hardening and HTTPS.

### Prerequisites

- Docker and Docker Compose
- Domain name with DNS pointing to server
- Server with public IP

### Setup Steps

1. **Configure production secrets**

   Edit the secret files in the `secrets/` directory:

   ```bash
   # Database configuration
   echo "appointment_booking" > secrets/postgres_db.txt
   echo "postgres" > secrets/postgres_user.txt
   echo "$(openssl rand -base64 32)" > secrets/postgres_password.txt

   # Set proper permissions
   chmod 600 secrets/*.txt
   ```

2. **Configure domain**

   Edit `Caddyfile` and replace `your-domain.com` with your actual domain:

   ```
   yourdomain.com {
       # ... rest of configuration
   }
   ```

3. **Build and start production stack**

   ```bash
   # Build application image
   npm run docker:prod:build

   # Start all services
   npm run docker:prod:up
   ```

4. **Verify deployment**

   ```bash
   # Check all containers are running
   docker ps

   # Check application health
   npm run docker:health

   # View logs
   npm run docker:prod:logs
   ```

### Production Commands

```bash
# Stack management
npm run docker:prod:build    # Build application image
npm run docker:prod:up       # Start all services
npm run docker:prod:down     # Stop all services
npm run docker:prod:logs     # View all logs
npm run docker:prod:clean    # Remove containers and volumes
npm run docker:health        # Check container status
npm run docker:tag-and-push  # Build, tag and push the app image to GHCR (Remember to change username accordingly first)
```

## SvelteKit Application Setup

When implementing the SvelteKit application, follow these steps:

### Database Connection

Create `src/lib/database.js`:

```javascript
import { readFileSync } from "fs";
import pg from "pg";

function getDatabaseConfig() {
  if (process.env.NODE_ENV === "production") {
    // Read from Docker secrets
    const user = readFileSync("/run/secrets/postgres_user", "utf8").trim();
    const password = readFileSync("/run/secrets/postgres_password", "utf8").trim();
    const database = readFileSync("/run/secrets/postgres_db", "utf8").trim();

    return {
      host: "postgres",
      port: 5432,
      user,
      password,
      database,
    };
  } else {
    // Development configuration
    return {
      host: "localhost",
      port: process.env.POSTGRES_PORT || 5432,
      user: process.env.POSTGRES_USER || "postgres",
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB || "appointment_booking",
    };
  }
}

export const pool = new pg.Pool(getDatabaseConfig());
```

### Health Check Endpoint

Create `src/routes/health/+server.js`:

```javascript
import { json } from "@sveltejs/kit";
import { pool } from "$lib/database.js";

export async function GET() {
  try {
    await pool.query("SELECT 1");
    return json({ status: "healthy", timestamp: new Date().toISOString() });
  } catch (error) {
    return json({ status: "unhealthy", error: error.message }, { status: 500 });
  }
}
```

### SvelteKit Configuration

Update `vite.config.js`:

```javascript
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
```

## Security Features

### Container Security

- **Rootless containers**: All containers (sans caddy, which needs to access privileged ports) run as non-root users
- **Read-only filesystems**: Containers have read-only root filesystems where possible
- **No new privileges**: Containers cannot escalate privileges
- **Minimal capabilities**: Only necessary Linux capabilities are granted

### Network Security

- **Internal networks**: Database and app communicate via internal Docker network
- **No exposed ports**: Only Caddy exposes ports to the host
- **HTTPS only**: Caddy handles automatic HTTPS with Let's Encrypt

### Data Security

- **Docker secrets**: Sensitive data stored as Docker secrets
- **Encrypted connections**: Database connections use SSL/TLS
- **Security headers**: Comprehensive security headers via Caddy

## Monitoring and Logs

### Log Locations

- **Caddy logs**: Stored in `/data/access.log` inside Caddy container
- **Application logs**: Available via `docker logs`
- **Database logs**: Available via `docker logs`

### Health Checks

- **Application**: `GET /health` endpoint
- **Database**: Built-in PostgreSQL health check
- **Caddy**: HTTP response check

### Monitoring Commands

```bash
# View real-time logs
npm run docker:prod:logs

# Check container health
docker ps
npm run docker:health

# Individual container logs
docker logs appointment-booking-app
docker logs appointment-booking-postgres
docker logs appointment-booking-caddy
```

## Troubleshooting

### Common Issues

1. **Container won't start**

   ```bash
   # Check container logs
   docker logs <container-name>

   # Check resource usage
   docker stats
   ```

2. **Database connection issues**

   ```bash
   # Test database connectivity
   docker exec -it appointment-booking-postgres psql -U postgres -d appointment_booking

   # Check database logs
   docker logs appointment-booking-postgres
   ```

3. **HTTPS certificate issues**

   ```bash
   # Check Caddy logs
   docker logs appointment-booking-caddy

   # Verify domain DNS
   nslookup yourdomain.com
   ```

4. **Application not accessible**

   ```bash
   # Check if all containers are running
   docker ps

   # Test internal connectivity
   docker exec -it appointment-booking-caddy wget -q --spider http://app:3000/health
   ```

### Reset Commands

```bash
# Complete reset (destroys all data)
npm run docker:prod:clean
npm run docker:dev:clean

# Rebuild and restart
npm run docker:prod:build
npm run docker:prod:up
```

## Backup and Restore

### Database Backup

```bash
# Create backup
docker exec appointment-booking-postgres pg_dump -U postgres appointment_booking > backup.sql

# Restore backup
docker exec -i appointment-booking-postgres psql -U postgres appointment_booking < backup.sql
```

### Volume Backup

```bash
# Backup PostgreSQL data volume
docker run --rm -v appointment-booking-software_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data
```
