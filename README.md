# 🔱 AIZEN PRO MAX 69
### Triple Engine WhatsApp Presence Monitor

```
╔══════════════════════════════════════════════════════════════╗
║   AIZEN PRO MAX 69 — Triple Engine Presence Monitor         ║
║   Session 1: Detector  ·  Session 2: Verifier               ║
║   Session 3: Triple Confirm  ·  Non-contact support         ║
║   instagram.com/immortalaizen · Aizen Services              ║
╚══════════════════════════════════════════════════════════════╝
```

---

## ✨ Features

### 📡 Triple-Session Architecture
| Session | Role |
|---------|------|
| S1 | Main Detector + Telegram UI |
| S2 | Verifier (anti false-alarm) |
| S3 | Triple Confirm |

- **ONLINE**: Any 1 session detects → waits 3s → confirms → alert
- **INSTANT DUAL/TRIPLE**: 2+ sessions agree → immediate alert
- **OFFLINE**: 2 of 3 sessions must confirm → alert

### 🧠 Features
- DP Change Detection (3x retry + S2 verify)
- Bio Change Detection (line-by-line diff)
- Business Profile Monitor
- Device Detection (Android/iOS/Web)
- Multi-Device Alert
- Message Delete Alert

### 🔍 OSINT Commands
| Command | Description |
|---------|-------------|
| `/whois 91xxx` | Full profile analysis |
| `/banned 91xxx` | Ban/active check with confidence score |
| `/session 91xxx` | Today's online sessions + total time |
| `/devices 91xxx` | Device usage history |
| `/bio 91xxx` | Current bio + change history |
| `/report 91xxx` | Download full intelligence report |
| `/online` | Who's online right now |
| `/health` | Live session health check |

### ⚙️ Bot Commands
| Command | Description |
|---------|-------------|
| `/pair 91xxx` | Pair Session 1 |
| `/pair2 91xxx` | Pair Session 2 |
| `/pair3 91xxx` | Pair Session 3 |
| `/add 91xxx` | Start monitoring a number |
| `/remove 91xxx` | Stop monitoring |
| `/label 91xxx Name` | Set a nickname |
| `/restart` | Soft-restart all 3 sessions |

---

## 📋 Requirements
- **Node.js 18+** → [nodejs.org](https://nodejs.org)
- **Git** → [git-scm.com](https://git-scm.com)
- **Telegram Bot Token** → [@BotFather](https://t.me/BotFather)
- **Your Telegram User ID** → [@userinfobot](https://t.me/userinfobot)
- 3 WhatsApp accounts (for S1, S2, S3)

---

## 💻 Windows (CMD)

**Step 1** — Open CMD, go to Desktop:
```cmd
cd Desktop
```

**Step 2** — Clone the repo:
```cmd
git clone https://github.com/mikeyfuxks2-creator/aizen-pro-max-69.git
```

**Step 3** — Enter the folder **(important!)**:
```cmd
cd aizen-pro-max-69
```

**Step 4** — Install dependencies:
```cmd
npm install
```

**Step 5** — Create config:
```cmd
copy config.example.js config.js
notepad config.js
```
Notepad mein apna **Bot Token** aur **Owner ID** daalo → Save → Close

**Step 6** — Start bot:
```cmd
node wa-monitor-bot.js
```

---

## 📱 Termux (Android)

**Step 1** — Packages install karo:
```bash
pkg update && pkg install nodejs git -y
```

**Step 2** — One-line install (sab automatic):
```bash
bash <(curl -s https://raw.githubusercontent.com/mikeyfuxks2-creator/aizen-pro-max-69/main/install.sh)
```
Bot Token + Owner ID maangega → enter karo → bot start ✅

**Dobara start:**
```bash
cd aizen-pro-max-69 && bash start.sh
```

---

## 🖥️ VPS / Linux (Ubuntu/Debian)

**Step 1** — Node.js install karo:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
```

**Step 2** — One-line install:
```bash
bash <(curl -s https://raw.githubusercontent.com/mikeyfuxks2-creator/aizen-pro-max-69/main/install.sh)
```
Bot Token + Owner ID maangega → enter karo → bot start ✅

**Background mein run karna ho:**
```bash
npm install -g pm2
pm2 start wa-monitor-bot.js --name aizen
pm2 save
```

---

## 🐦 Pterodactyl Panel

Environment variables:
```
BOT_TOKEN  = your_telegram_bot_token
OWNER_ID   = your_telegram_user_id
```
Start command: `node wa-monitor-bot.js`

---

## 📲 WhatsApp Pairing

Bot start hone ke baad Telegram mein:
```
/pair 91XXXXXXXXXX    ← Session 1
/pair2 91XXXXXXXXXX   ← Session 2
/pair3 91XXXXXXXXXX   ← Session 3
```
Pairing code milega → WhatsApp → Linked Devices → Link with phone number → Code enter karo

---

## 🗂 Project Structure

```
aizen-pro-max-69/
├── wa-monitor-bot.js      ← Main bot (S1 + Telegram UI)
├── verifier.js            ← Session 2
├── verifier3.js           ← Session 3
├── config.example.js      ← Config template → copy to config.js
├── .env.example           ← ENV template
├── install.sh             ← Auto installer (Linux/Termux)
├── start.sh               ← Quick start script
├── package.json
└── README.md
```

> ⚠️ `config.js` aur `wa_auth*/` folders `.gitignore` mein hain — kabhi commit nahi honge

---

## 🛡 Security
- `config.js` kisi ko mat dena — bot token hota hai
- `wa_auth/` folders share mat karna — WhatsApp session hoti hai
- Bot sirf tumhare `OWNER_ID` ko respond karta hai

---

*Built by [@immortalaizen](https://instagram.com/immortalaizen) · Aizen Services*
