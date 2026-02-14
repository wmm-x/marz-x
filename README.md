<div align="center">
  <br><br>
  <h1>🚀 Marz-X</h1>
  <p><b>A Modern, Efficient & Feature-Rich Management Dashboard for Marzban</b></p>
  <p>
    <a href="#-overview">Overview</a> •
    <a href="#-key-features">Features</a> •
    <a href="#-quick-installation">Installation</a> •
    <a href="#-screenshots">Screenshots</a> •
    <a href="#-acknowledgements">Credits</a>
  </p>
  <br>
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/Platform-Ubuntu%2022.04%2B-orange.svg?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/Version-1.0-green.svg?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/Docker-Ready-blue.svg?style=flat-square" alt="Docker">
</div>

---

## 📋 Overview

**Marz-X** is a comprehensive, professional-grade dashboard designed to revolutionize **Marzban** management. It delivers an elegant, intuitive web interface for seamlessly managing users, subscriptions, traffic, and configuring VPN servers with automatic SSL certification.

Featuring an automated installation script that deploys Docker, Nginx, Let's Encrypt SSL, and the complete Marzban ecosystem in minutes, Marz-X eliminates complex configuration hassles.

---

## ✨ Key Features

### 🔧 System Management
- **One-Click Auto Installation** — Deploy Dashboard, Docker, SSL certificates, and Marzban VPN node with a single command
- **Fully Dockerized Architecture** — Secure, isolated containerized environment with easy updates and maintenance
- **Automated Server Optimization** — Real-time monitoring and resource tuning for peak VPN performance on connected Marzban servers

### 👥 User & Subscription Management
- **Advanced User Management** — Create, edit, suspend, and reset user traffic with precise control over expiry dates
- **Subscription Management** — Manage customizable plans, data limits, and branded subscription links
- **Multi-Server Support** — Control multiple Marzban nodes from a single, unified interface

### 📊 Analytics & Monitoring
- **Usage Analysis & Bandwidth Monitoring** — View comprehensive historical server bandwidth data with upload/download traffic insights
- **Real-Time Dashboard** — Live system status and performance metrics at a glance
- **Native Marzban Integration** — Seamless real-time synchronization of users, traffic, and system status via official API

### ⚙️ Configuration & Control
- **Visual Xray Configuration** — Manage Xray Core via intuitive GUI—configure Inbounds, Outbounds, and Routing rules without JSON editing
- **Interactive Swagger API Documentation** — Explore and test all API endpoints with comprehensive OpenAPI/Swagger UI interface
- **Backup & Restore** — Ensure data safety with automatic backup and easy recovery functionality

---

## 🚀 Quick Installation

### System Requirements
| Requirement | Details |
|-------------|---------|
| **Operating System** | Ubuntu 22.04+ (Recommended) |
| **Access Level** | Root/sudo privileges |
| **Network** | Valid domain name pointed to your server IP |
| **Resources** | Minimum 1GB RAM, 1GB free disk space |

### Installation Command

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/wmm-x/marz-x/main/install.sh)"
```

The installer will automatically:
- ✅ Install and configure Docker
- ✅ Set up Nginx reverse proxy
- ✅ Provision SSL certificates via Let's Encrypt
- ✅ Deploy Marzban with complete dashboard
- ✅ Initialize database and configurations

---

## 🎨 Screenshots

### Dashboard & Analytics
<p align="center">
  <img src="https://raw.githubusercontent.com/wmm-x/marz-x/96f522445b691d9bb890d6d4ba4dc14e165212a3/screenshots/dark/dashboard-dark.png" width="48%" alt="Dark Dashboard" />
  <img src="https://raw.githubusercontent.com/wmm-x/marz-x/96f522445b691d9bb890d6d4ba4dc14e165212a3/screenshots/light/db-light.png" width="48%" alt="Light Dashboard" />
</p>

### Traffic Analytics
<p align="center">
   <img src="https://raw.githubusercontent.com/wmm-x/marz-x/96f522445b691d9bb890d6d4ba4dc14e165212a3/screenshots/dark/Analytics-dark.png" width="48%" alt="Dark Analytics" />
  <img src="https://raw.githubusercontent.com/wmm-x/marz-x/96f522445b691d9bb890d6d4ba4dc14e165212a3/screenshots/light/Analytics-light.png" width="48%" alt="Light Analytics" />
</p>

---

## 🔐 Technology Stack

- **Backend**: Node.js + Express
- **Database**: Prisma ORM with SQLite
- **Frontend**: React with modern responsive UI
- **API Documentation**: Swagger/OpenAPI UI
- **Containerization**: Docker & Docker Compose
- **Web Server**: Nginx with SSL/TLS
- **VPN Core**: Xray Protocol

---


## 🙏 Acknowledgements

Marz-X is an advanced, feature-rich customization built upon the official **Marzban** project.

**Special Recognition:**
- 🙌 **[Gozargah Team](https://github.com/Gozargah/Marzban)** — For creating and maintaining Marzban, the powerful core engine powering this dashboard
- 💝 Community contributors and testers worldwide

> **Disclaimer**: Marz-X is a community-driven project and is not officially affiliated with or endorsed by the Marzban core development team.

---

## 📜 License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) file for complete details.

---

<div align="center">
  <br>
  <sub>🔗 <a href="https://github.com/wmm-x">Follow on GitHub</a> • 💬 <a href="https://github.com/wmm-x/marz-x/discussions">Join Discussions</a></sub>
  <br><br>
  <sub>Developed with ❤️ by <a href="https://github.com/wmm-x">wmm-x</a></sub>
  <br><br>
</div>
