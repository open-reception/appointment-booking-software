# Deploy OpenReception to a single server

This guide will lead you through setting up OpenReception on linux a server of your choice.

> Too complicated? Managed Hosting is available at [open-reception.com](https://open-reception.com).

## Requirements

This setup requires

- shell access to a root server
- docker with docker compose installed
- a small server with 2 cores and 2gb of ram should get you started

## Recommendations/ Considerations

- Update your operating system on a regular basis. Use automatic security updates like `unattended-upgrades` for the very short term issues.
- Encrypt the drive where your database is stored to prevent data theft by just pulling the hard drive. You can use `luks`.
- Protect access with `fail2ban`, `ufw`, `crowdsec`, proper user permissions and other best-practices.
- Make regular backups of your database and test them regularly. You can use `restic`.
- Monitor your server loads and logs over time to detect peak usages (with insufficient ram or cpu power) and malicious activities.

## Setup

1. Use our [production docker-compose example](../docker-compose.prod.yml)
1. Use our [Caddyfile example](../Caddyfile)
1. Adjust the settings in these two files above to your needs.
1. Run `docker-compose up -d` or `docker compose up -d` depending on your docker installation.
1. Proceed to secure your instance by opening your admin domain in a browser.
