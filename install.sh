#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║    AIZEN PRO MAX 69 — One-Line GitHub Installer            ║
# ║    bash <(curl -s URL_YAHAN) se run hoga                   ║
# ╚══════════════════════════════════════════════════════════════╝
# Usage:
#   bash <(curl -s https://raw.githubusercontent.com/mikeyfuxks2-creator/aizen-pro-max-69/main/install.sh)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
RESET='\033[0m'

REPO="https://github.com/mikeyfuxks2-creator/aizen-pro-max-69"
REPO_RAW="https://raw.githubusercontent.com/mikeyfuxks2-creator/aizen-pro-max-69/main"

clear
echo ""
echo -e "  ${MAGENTA}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  ${CYAN}${BOLD}  AIZEN PRO MAX 69 — Installer${RESET}"
echo -e "  ${MAGENTA}  instagram.com/immortalaizen${RESET}"
echo -e "  ${MAGENTA}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ── Check tools ───────────────────────────────────────────────────────────────
for cmd in node npm curl git; do
    if ! command -v $cmd &>/dev/null; then
        echo -e "  ${RED}✖ '$cmd' not found!${RESET}"
        if [ "$cmd" = "node" ] || [ "$cmd" = "npm" ]; then
            echo -e "  ${YELLOW}Termux:  pkg install nodejs${RESET}"
            echo -e "  ${YELLOW}Ubuntu:  apt install nodejs npm${RESET}"
        elif [ "$cmd" = "git" ]; then
            echo -e "  ${YELLOW}Termux:  pkg install git${RESET}"
            echo -e "  ${YELLOW}Ubuntu:  apt install git${RESET}"
        fi
        exit 1
    fi
done
echo -e "  ${GREEN}✔ Node $(node -v) · npm $(npm -v) · git ready${RESET}"

# ── Clone or update ───────────────────────────────────────────────────────────
FOLDER="aizen-pro-max-69"

if [ -d "$FOLDER/.git" ]; then
    echo -e "  ${YELLOW}📥 Repo exists — pulling latest...${RESET}"
    cd "$FOLDER" && git pull origin main
else
    echo -e "  ${YELLOW}📥 Cloning repo...${RESET}"
    git clone "$REPO" "$FOLDER"
    if [ $? -ne 0 ]; then
        echo -e "  ${RED}✖ Clone failed! Check repo URL in install.sh${RESET}"
        exit 1
    fi
    cd "$FOLDER"
fi

echo -e "  ${GREEN}✔ Code ready!${RESET}"

# ── Config setup ─────────────────────────────────────────────────────────────
if [ ! -f "config.js" ]; then
    echo ""
    echo -e "  ${YELLOW}${BOLD}⚙️  Setup — enter your details:${RESET}"
    echo -e "  ${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo ""

    while true; do
        echo -e -n "  ${CYAN}🤖 Telegram Bot Token${RESET} (from @BotFather): "
        read -r BOT_TOKEN
        BOT_TOKEN=$(echo "$BOT_TOKEN" | tr -d '[:space:]')
        if [[ "$BOT_TOKEN" =~ ^[0-9]+:AA[a-zA-Z0-9_-]{33,}$ ]]; then
            echo -e "  ${GREEN}✔ Token valid${RESET}"; break
        else
            echo -e "  ${RED}✖ Invalid. Try again.${RESET}"
        fi
    done

    echo ""

    while true; do
        echo -e -n "  ${CYAN}👤 Your Telegram User ID${RESET} (from @userinfobot): "
        read -r OWNER_ID
        OWNER_ID=$(echo "$OWNER_ID" | tr -d '[:space:]')
        if [[ "$OWNER_ID" =~ ^[0-9]{5,15}$ ]]; then
            echo -e "  ${GREEN}✔ Owner ID valid${RESET}"; break
        else
            echo -e "  ${RED}✖ Must be a number. Try again.${RESET}"
        fi
    done

    cat > config.js << EOF
module.exports = {
    telegramBotToken: '${BOT_TOKEN}',
    ownerId: ${OWNER_ID},
};
EOF
    echo -e "  ${GREEN}✔ config.js created!${RESET}"
fi

# ── Install deps ──────────────────────────────────────────────────────────────
echo ""
echo -e "  ${YELLOW}📦 Installing dependencies...${RESET}"
npm install --no-audit --no-fund --legacy-peer-deps
if [ $? -ne 0 ]; then
    echo -e "  ${RED}✖ npm install failed!${RESET}"
    exit 1
fi
echo -e "  ${GREEN}✔ Done!${RESET}"

# ── Start ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${MAGENTA}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  ${GREEN}${BOLD}🚀 Starting AIZEN PRO MAX 69...${RESET}"
echo -e "  ${YELLOW}  (Next time: cd $FOLDER && bash start.sh)${RESET}"
echo -e "  ${MAGENTA}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

node wa-monitor-bot.js
