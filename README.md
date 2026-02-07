<div align="center">
  <a href="https://github.com/wmm-x/marz-x">
    <img src="https://raw.githubusercontent.com/wmm-x/marz-x/6349a7f2403c733b169bd2c8e7a834b8458d7045/template/logo.png" 
      alt="Marz-X Logo">
  </a>
  <br><br>
  <h1>Marz-X</h1>
  <p><b>A modern and efficient management dashboard for Marzban</b></p>
  <p>
    <a href="#features"> Features</a> •
    <a href="#installation">Installation</a> •
    <a href="#screenshots">Screenshots</a> 
  </p>
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/platform-Ubuntu%2022.04%2B-orange.svg" alt="Platform">
</div>

---

## About the Project

**Marz-X** is a complete dashboard interface designed to simplify the management of the **Marzban** panel. It provides an intuitive web interface to manage users, subscriptions, traffic, and configure VPN servers with automatic SSL.

This project includes an automatic installation script that sets up Docker, Nginx, SSL (Let's Encrypt), and the Marzban panel itself in minutes.

---

## Features

- **One-Click Auto Installation:** A single command to set up the Dashboard, Docker, SSL certificates, and the Marzban VPN node.
- **Visual Xray Configuration:** Manage Xray Core directly via GUI-configure Inbounds, Outbounds, and Routing rules without editing JSON files.
- **Automated Marzban Server Optimization:** Automatically monitors and tunes system resources on connected Marzban servers to ensure peak VPN performance.
- **Native Marzban Integration:** Seamless real-time sync of users, traffic, and system status via the official API.
- **Advanced User Management:** Create, edit, suspend, and reset user traffic with precise control over expiry dates.
- **Subscription Management:** Easily manage plans, data limits, and custom subscription links.
- **Usage Analysis & Bandwidth Monitoring** View historical server bandwidth usage, including upload/download traffic
- **Multi-Server Support:** Manage multiple Marzban nodes from a single centralized interface.
- **Backup and restore feature** Added backup and restore functionality to ensure data safety and easy recovery
- **Fully Dockerized:** Runs in a secure, isolated environment for easy updates and maintenance.



---
## Installation

### Requirements
- **OS:** Ubuntu 22.04+ (Recommended)
- **Access:** Root access
- **Network:** A valid domain name pointed to your server IP

### Quick Install
Run the following commands:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/wmm-x/marz-x/main/install.sh)"
```

## Acknowledgements

This project is an advanced, customizable UI built on top of the official **Marzban** project.
Special thanks to **Gozargah** for creating and maintaining Marzban, the core that makes this dashboard possible: <a href="https://github.com/Gozargah/Marzban">Marzban GitHub</a>

Disclaimer: Marz-X is community-driven and is not affiliated with or endorsed by the Marzban core team.

---
## Screenshots

<p align="center">
  <img src="https://raw.githubusercontent.com/wmm-x/marz-x/96f522445b691d9bb890d6d4ba4dc14e165212a3/screenshots/dark/dashboard-dark.png" width="45%" />
  <img src="https://raw.githubusercontent.com/wmm-x/marz-x/96f522445b691d9bb890d6d4ba4dc14e165212a3/screenshots/light/db-light.png" width="45%" />
</p>
<p align="center">
   <img src="https://raw.githubusercontent.com/wmm-x/marz-x/96f522445b691d9bb890d6d4ba4dc14e165212a3/screenshots/dark/Analytics-dark.png" width="45%" />
  <img src="https://raw.githubusercontent.com/wmm-x/marz-x/96f522445b691d9bb890d6d4ba4dc14e165212a3/screenshots/light/Analytics-light.png" width="45%" />
</p>


---
## License
This project is licensed under the MIT License.

<h3><div align="center"> <sub>Developed by <a href="https://github.com/wmm-x">wmm-x</a></sub> </div> </h3>
