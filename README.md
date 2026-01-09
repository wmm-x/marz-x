<div align="center">
  <a href="https://github.com/wmm-x/marz-x">
    <img src="https://raw.githubusercontent.com/wmm-x/marz-x/6349a7f2403c733b169bd2c8e7a834b8458d7045/template/logo.png" alt="Marz-X Logo" width="500">
  </a>
  <br><br>
  <h1>Marz-X Dashboard</h1>
  <p><b>A modern and efficient management dashboard for Marzban</b></p>
  <p>
    <a href="#features">Features</a> •
    <a href="#installation">Installation</a> •
    <a href="#screenshots">Screenshots</a> •
    <a href="#support">Support</a>
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

### Core Features
- **One-Click Auto Installation:** Sets up Dashboard + Marzban + Docker + Nginx + SSL automatically.
- **Native Marzban API Integration:** Real-time sync of users, traffic, and system status.
- **Advanced User Management:** Create, edit, suspend, reset traffic, and manage expiry dates.
- **Analytics:** Detailed traffic and usage analytics.
- **Fully Dockerized:** Secure and isolated environment.
- **Subscription Management:** Manage plans, expiry dates, and traffic limits easily.
- **Custom Subscription Pages:** Brandable templates for user-facing pages.
- **Multi-Server Support:** Manage multiple nodes from one interface.
- **Template Presets:** Ready-to-use presets for common VPN configurations.
- **Fast SPA Dashboard:** Responsive and mobile-friendly design.
- **Theme Support:** Built-in Dark / Light Mode switch.
- **Search & Filters:** Quickly find users and plans.

---

## Screenshots

<div align="center">
  <img src="https://raw.githubusercontent.com/wmm-x/marz-x/efc8cb99b3192b7173f6d3054f3b05eff899f5d9/template/dashboard.png" alt="Dashboard Home" width="100%">
</div>

---

## Installation

### Requirements
- **OS:** Ubuntu 22.04+ (Recommended)
- **Access:** Root access
- **Network:** A valid domain name pointed to your server IP

### Quick Install
Run the following commands:

```bash
apt update && apt install -y git && rm -rf marz-x && git clone https://github.com/wmm-x/marz-x.git && cd marz-x && chmod +x install.sh && ./install.sh
```
## Acknowledgements

This project is an advanced, customizable UI built on top of the official **Marzban** project.
Special thanks to **Gozargah** for creating and maintaining Marzban, the core that makes this dashboard possible: <a href="https://github.com/wmm-x">Marzban GitHub</a>

Disclaimer: Marz-X is community-driven and is not affiliated with or endorsed by the Marzban core team.

## License
This project is licensed under the MIT License.

<h3><div align="center"> <sub>Developed by <a href="https://github.com/wmm-x">wmm-x</a></sub> </div> </h3>
