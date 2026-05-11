# 🔱 AIZEN PRO MAX 69
### Dual-Engine WhatsApp Presence Monitor — Triple Session Architecture

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
| Session | Browser | Auth Folder | Role |
|---------|---------|------------|------|
| S1 | Chrome/Linux | `wa_auth/` | Main Detector + Telegram UI |
| S2 | Edge/Windows | `wa_auth_2/` | Verifier (anti false-alarm) |
| S3 | Firefox/Ubuntu | `wa_auth_3/` | Triple Confirm |

- **ONLINE**: Any 1 session detects → waits 3s → confirms → alert
- **INSTANT DUAL/TRIPLE**: 2+ sessions agree → immediate alert (no wait)
- **OFFLINE**: 2 of 3 sessions must confirm before firing alert

### 🧠 Brain Features
- **DP Change Detection** — 3x retry (CDN filter) + S2 dual-verify
- **Bio Change Detection** — line-by-line diff, shows exactly what changed
- **Business Profile Monitor** — triple-session vote, alerts on any change
- **Device Detection** — Android/iOS/Web via message ID prefix (proven table)
- **Multi-Device Alert** — detects when someone uses phone + web simultaneously
- **Reinstall/Key Change** — identity key & security code change alerts
- **Number Change Detect** — stubType 78 alerts
- **Message Delete Alert** — real-time detection

### 🔍 OSINT Commands
| Command | Description |
|---------|-------------|
| `/whois 91xxx` | Full profile analysis |
| `/banned 91xxx` | Triple-session ban/active check with confidence score |
| `/session 91xxx` | Today's online sessions + total time |
| `/devices 91xxx` | Device usage history + hourly pattern |
| `/bio 91xxx` | Current bio + change history |
| `/history 91xxx` | Full DP + bio log |
| `/report 91xxx` | Download full intelligence report |
| `/spy 91xxx` | 2-minute intensive scan (all 3 sessions) |
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

## 🚀 Setup

### Requirements
- Node.js 18+ (20+ recommended)
- A Telegram Bot Token ([@BotFather](https://t.me/BotFather))
- Your Telegram User ID ([@userinfobot](https://t.me/userinfobot))
- 3 WhatsApp accounts for pairing

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/aizen-pro-max-69.git
cd aizen-pro-max-69

# 2. Install dependencies
npm install

# 3. Setup config
cp config.example.js config.js
# Edit config.js with your BOT_TOKEN and OWNER_ID

# 4. Start
node wa-monitor-bot.js
```

### Using .env instead of config.js
```bash
cp .env.example .env
# Edit .env with your values
node wa-monitor-bot.js
```

### Pairing WhatsApp Sessions
Once the bot starts, in Telegram:
```
/pair 91XXXXXXXXXX    ← Session 1 (main)
/pair2 91XXXXXXXXXX   ← Session 2 (verifier)
/pair3 91XXXXXXXXXX   ← Session 3 (triple confirm)
```
Each gives a pairing code — enter it in WhatsApp → Linked Devices.

---

## 🗂 Project Structure

```
aizen-pro-max-69/
├── wa-monitor-bot.js      ← Main bot (Session 1 + Telegram UI)
├── verifier.js            ← Session 2 child process
├── verifier3.js           ← Session 3 child process
├── config.example.js      ← Config template (copy → config.js)
├── .env.example           ← ENV template (copy → .env)
├── package.json
├── README.md
│
├── wa_auth/               ← [AUTO CREATED] S1 session files
├── wa_auth_2/             ← [AUTO CREATED] S2 session files
├── wa_auth_3/             ← [AUTO CREATED] S3 session files
├── monitor_data.json      ← [AUTO CREATED] Runtime data
└── aizen_memory.json      ← [AUTO CREATED] Persistent memory
```

> ⚠️ `wa_auth*/`, `monitor_data.json`, `aizen_memory.json`, and `config.js` are in `.gitignore` — never committed.

---

## 🐦 Pterodactyl Deployment

Use environment variables in your egg:
```
BOT_TOKEN  = your_telegram_bot_token
OWNER_ID   = your_telegram_user_id
```

Start command: `node wa-monitor-bot.js`

> Dependencies auto-install on first run if `node_modules` is missing.

---

## 📊 How Detection Works

```
Target comes online
       │
S1 detects presence ──────────────────────────────────────────┐
       │                                                       │
       ├─ Asks S2 + S3 to verify                              │
       │                                                       │
Wait 3s ────────────────────────────────┐                     │
       │                               │                      │
1 session confirms     ←──── OR ────→  2-3 sessions confirm   │
(Careful alert)                        (INSTANT DUAL/TRIPLE)  │
       │                                                       │
       └──────────────→ 🔔 Telegram Alert ←────────────────────┘

Target goes offline → 2 of 3 must agree → final check → 🔔 Alert
```

---

## 🛡 Security Notes

- **Never commit** `config.js`, `.env`, or `wa_auth*/` folders
- Use different WhatsApp accounts for each session (S1/S2/S3)
- Bot only responds to your `OWNER_ID` — all other users ignored
- Session auth is stored locally only

---

## 📄 License

Private project — All rights reserved  
© [Aizen Services](https://instagram.com/immortalaizen)

---

*Built with ❤️ by [@immortalaizen](https://instagram.com/immortalaizen)*
