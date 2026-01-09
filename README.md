<div align="center">
  <img src="https://via.placeholder.com/200x200?text=Marz-X+Logo" alt="Marz-X Logo" width="200" height="auto">
  <br>
  <h1>Marz-X Dashboard</h1>
  <p>
    <b>A modern and efficient management dashboard for Marzban</b>
  </p>
  <p>
    <a href="#features">Features</a> •
    <a href="#installation">Installation</a> •
    <a href="#screenshots">Screenshots</a> •
    <a href="#support">Support</a>
  </p>
</div>

---

## 📖 About the Project

**Marz-X** is a complete dashboard interface designed to simplify the management of the Marzban panel. It offers an easy way to create users, manage subscriptions, monitor traffic, and configure VPN servers with automatic SSL, all through an intuitive web interface.

This project includes an **automatic installation script** that sets up Docker, Nginx, SSL (Let's Encrypt), and the Marzban panel itself in a matter of minutes.

## ✨ Features

- 🚀 **Auto Installation:** Single script to set up everything (Dashboard + Marzban + SSL).
- 👥 **User Management:** Easily create, edit, delete, and suspend users.
- 🔄 **Marzban Integration:** Full synchronization with the Marzban API.
- 🔒 **Free SSL:** Automatic HTTPS configuration via Let's Encrypt.
- 📊 **Monitoring:** Visualize data usage and user status.
- 🎨 **Custom Templates:** Support for custom subscription pages.
- 🐳 **Dockerized:** Runs entirely in containers for stability and security.

---

## 📸 Screenshots

<div align="center">
  <img src="https://via.placeholder.com/800x400?text=Dashboard+Home+Screenshot" alt="Dashboard Home" width="100%">
  <br><br>
  <img src="https://via.placeholder.com/800x400?text=User+Management+Screenshot" alt="User Management" width="100%">
</div>

---

## 🛠️ Quick Installation

To install Marz-X on an Ubuntu server (recommended 22.04+), run the following command as **root**:

```bash
apt update && apt install -y git && git clone [https://github.com/wmm-x/marz-x.git](https://github.com/wmm-x/marz-x.git) && cd marz-x && chmod +x install.sh && ./install.sh
