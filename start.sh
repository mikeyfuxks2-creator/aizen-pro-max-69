#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║        AIZEN PRO MAX 69 — Auto Setup & Start               ║
# ║        instagram.com/immortalaizen · Aizen Services         ║
# ╚══════════════════════════════════════════════════════════════╝

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
RESET='\033[0m'

clear
echo ""
echo -e "  ${MAGENTA}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  ${CYAN}${BOLD}  AIZEN PRO MAX 69${RESET}  ${YELLOW}Triple Engine${RESET}"
echo -e "  ${MAGENTA}  instagram.com/immortalaizen${RESET}"
echo -e "  ${MAGENTA}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ── Check Node.js ────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
    echo -e "  ${RED}✖ Node.js not found!${RESET}"
    echo -e "  ${YELLOW}Install: pkg install nodejs${RESET}  (Termux)"
    echo -e "  ${YELLOW}Or:      apt install nodejs npm${RESET}  (Ubuntu)"
    exit 1
fi

NODE_VER=$(node -v)
echo -e "  ${GREEN}✔ Node.js ${NODE_VER}${RESET}"

# ── Check config.js ──────────────────────────────────────────────────────────
if [ ! -f "config.js" ]; then
    echo ""
    echo -e "  ${YELLOW}${BOLD}⚙️  First time setup — enter your details:${RESET}"
    echo -e "  ${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo ""

    # ── BOT TOKEN ────────────────────────────────────────────────────────────
    while true; do
        echo -e -n "  ${CYAN}🤖 Telegram Bot Token${RESET} (from @BotFather): "
        read -r BOT_TOKEN
        BOT_TOKEN=$(echo "$BOT_TOKEN" | tr -d '[:space:]')
        if [[ "$BOT_TOKEN" =~ ^[0-9]+:AA[a-zA-Z0-9_-]{33,}$ ]]; then
            echo -e "  ${GREEN}✔ Token valid${RESET}"
            break
        else
            echo -e "  ${RED}✖ Invalid token format. Try again.${RESET}"
        fi
    done

    echo ""

    # ── OWNER ID ─────────────────────────────────────────────────────────────
    while true; do
        echo -e -n "  ${CYAN}👤 Your Telegram User ID${RESET} (from @userinfobot): "
        read -r OWNER_ID
        OWNER_ID=$(echo "$OWNER_ID" | tr -d '[:space:]')
        if [[ "$OWNER_ID" =~ ^[0-9]{5,15}$ ]]; then
            echo -e "  ${GREEN}✔ Owner ID valid${RESET}"
            break
        else
            echo -e "  ${RED}✖ Must be a number (5-15 digits). Try again.${RESET}"
        fi
    done

    echo ""
    echo -e "  ${YELLOW}💾 Saving config.js...${RESET}"

    cat > config.js << EOF
module.exports = {
    telegramBotToken: '${BOT_TOKEN}',
    ownerId: ${OWNER_ID},
};
EOF

    echo -e "  ${GREEN}✔ config.js created!${RESET}"
    echo ""
else
    echo -e "  ${GREEN}✔ config.js found — skipping setup${RESET}"
fi

# ── Install Dependencies ──────────────────────────────────────────────────────
if [ ! -d "node_modules" ]; then
    echo ""
    echo -e "  ${YELLOW}📦 Installing dependencies...${RESET}"
    npm install --no-audit --no-fund --legacy-peer-deps
    if [ $? -ne 0 ]; then
        echo -e "  ${RED}✖ npm install failed!${RESET}"
        exit 1
    fi
    echo -e "  ${GREEN}✔ Dependencies installed!${RESET}"
else
    echo -e "  ${GREEN}✔ node_modules found — skip install${RESET}"
fi

# ── Launch Bot ────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${MAGENTA}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  ${GREEN}${BOLD}🚀 Starting AIZEN PRO MAX 69...${RESET}"
echo -e "  ${MAGENTA}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

node wa-monitor-bot.js
