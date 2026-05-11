/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║   AIZEN PRO MAX 69 — Dual Engine Presence        ║
 * ║   Session 1: Detector  ·  Session 2: Verifier           ║
 * ║   Non-contact support · Anti-clash · Error-free          ║
 * ║   instagram.com/immortalaizen · Aizen Services                       ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * ARCHITECTURE:
 *   Session 1 (this process) — main detector + Telegram UI
 *     browser: Linux/Chrome/20.00.1 | auth: wa_auth/ | code: AIZEN690
 *   Session 2 (child process) — verifier + backup presence
 *     browser: Windows/Edge/22.0 | auth: wa_auth_2/ | code: AIZEN692
 *   Session 3 (child process) — triple verifier
 *     browser: Firefox/Brave/120.0 | auth: wa_auth_3/ | code: AIZEN693
 *   MERGE: Any session online→ONLINE. 2/3 offline→OFFLINE.
 *   BRAIN: DP/Bio change → 2 of 3 sessions must confirm.
 *
 * NON-CONTACT DETECTION:
 *   1. onWhatsApp(num) → check exists + get LID
 *   2. Subscribe phone JID + LID JID (covers iOS + Android)
 *   3. sendPresenceUpdate('available', targetJid) → poke WA
 *   4. Re-subscribe every 15s (presence expires on server)
 *   5. Works if target privacy = "Everyone" for online status
 */
'use strict';

// ── Auto Install ────────────────────────────────────────────────────────────
(function(){
    const{execSync}=require('child_process'),fs=require('fs'),p=require('path');
    if(!fs.existsSync(p.join(process.cwd(),'node_modules','@whiskeysockets')))
    {console.log('\n  ⏳ Installing...\n');
    try{execSync('npm install --no-audit --no-fund --legacy-peer-deps',{stdio:'inherit',cwd:process.cwd(),timeout:300000});}
    catch{process.exit(1);}}
})();

try{require('dotenv').config();}catch{}
const TelegramBot=require('node-telegram-bot-api');
const{fork}=require('child_process');
const fs=require('fs'),path=require('path');

// ── Config ──────────────────────────────────────────────────────────────────
let _cfg={};try{_cfg=require('./config.js');}catch{}
const BOT_TOKEN=process.env.BOT_TOKEN||_cfg.telegramBotToken||'';
const OWNER_ID=(parseInt(process.env.OWNER_ID||'0')||0)||(parseInt(_cfg.ownerId)||0);
const DATA_FILE=path.join(process.cwd(),'monitor_data.json');
const AUTH_1=path.join(process.cwd(),'wa_auth');
const MAX_NUMS=21;
const MENU_PIC='https://files.catbox.moe/vgqy2t.jpg';

// ── Colors ──────────────────────────────────────────────────────────────────
const R='\x1b[0m',B='\x1b[1m',D='\x1b[2m';
const X={r:'\x1b[38;5;196m',g:'\x1b[38;5;82m',y:'\x1b[38;5;220m',c:'\x1b[38;5;51m',
    m:'\x1b[38;5;207m',w:'\x1b[38;5;255m',d:'\x1b[38;5;244m',t:'\x1b[38;5;43m',o:'\x1b[38;5;214m'};
const ts=()=>new Date().toLocaleTimeString('en-IN',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
const TAG=`${D}${X.m}✦ PRO MAX 69${R}`;
const L={
    on:  m=>console.log(`${X.g}${B} ▶ ON ${R} ${X.d}${ts()}${R}  ${m}`),
    off: m=>console.log(`${X.d} ■ OFF ${X.d}${ts()}${R}  ${m}`),
    typ: m=>{},  // Silent — too spammy
    dev: m=>console.log(`${X.o} 📱    ${X.d}${ts()}${R}  ${m}`),
    ok:  m=>console.log(`${X.g} ✔     ${X.d}${ts()}${R}  ${B}${m}${R}`),
    err: m=>console.log(`${X.r} ✖     ${X.d}${ts()}${R}  ${X.r}${m}${R}`),
    sub: m=>{},  // Silent — subscribe/verify noise
    inf: m=>console.log(`${X.c} ●     ${X.d}${ts()}${R}  ${m}`),
    s2:  m=>console.log(`${X.y} [S2]  ${X.d}${ts()}${R}  ${m}`),
    mrg: m=>{},  // Silent — merge details
    sep: ()=>{}, // No separators
};

// ══════════════════════════════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════════════════════════════
let WA_NUM='',sock=null,conn1=false,isPairing1=false,isReconnecting1=false;
let keepAliveId=null,resubId=null,forceOffId=null,verifyLoopId=null,healthId=null;
const startedAt=Date.now(); // Uptime tracking

const online={};        // num → true/false (FINAL merged state)
const onlineSince={};   // num → timestamp when went ONLINE (for duration calc)
const onlineMsgId={};   // num → Telegram message_id of online alert (for device edit)
const s1State={};       // num → {status, ts}
const s2State={};       // num → {status, ts}
const lastEvent={};     // num → timestamp of any activity
const deviceOf={};      // num → 'Android'|'iOS'|'Web'
const cooldown={};      // num → timestamp (prevent alert spam)
const typingState={};   // num → {type, timer}
const offlineDebounce={}; // num → timer (2s debounce before marking offline)
const lidMap={};        // lid → phone
const phoneLid={};      // phone → lid
const nonContactFlag={}; // num → true if non-contact (no mutual save)
const s2Callbacks={};    // key → resolve function for S2 verification
let lastWsPong=0;
let missedPings=0;

// ── NEW: Advanced tracking ──────────────────────────────────────
const deviceLog={};     // num → [{device, ts}] — device usage history
const sessionLog={};    // num → [{online:ts, offline:ts, dur:ms}] — today's sessions
const multiDevice={};   // num → {devices:Set, lastAlert:ts} — multi-device tracking
const identityKeys={};  // num → key hash — for reinstall detection
const lastSeenAt={};    // num → timestamp — last time they were online
const businessInfo={};  // num → {isBusiness, name, category, description} — cached
const callLog={};       // num → [{type, status, ts}]
const reactionLog={};   // num → [{emoji, ts}]
const spyList={};       // num → {until:ts, results:[]}

// ── Memory persistence — survive restarts ──
const MEMORY_FILE=path.join(process.cwd(),'aizen_memory.json');

function saveMemory(){
    try{
        const mem={deviceOf:{...deviceOf},
            deviceLog:Object.fromEntries(Object.entries(deviceLog).map(([k,v])=>[k,(v||[]).slice(-50)])),
            lastSeenAt:{...lastSeenAt},identityKeys:{...identityKeys},
            businessInfo:{...businessInfo},savedAt:Date.now()};
        fs.writeFileSync(MEMORY_FILE,JSON.stringify(mem),'utf8');
    }catch{}
}
function loadMemory(){
    if(!fs.existsSync(MEMORY_FILE)) return;
    try{
        const mem=JSON.parse(fs.readFileSync(MEMORY_FILE,'utf8'));
        if(mem.deviceOf) Object.assign(deviceOf,mem.deviceOf);
        if(mem.deviceLog) for(const[k,v]of Object.entries(mem.deviceLog)){deviceLog[k]=v||[];}
        if(mem.lastSeenAt) Object.assign(lastSeenAt,mem.lastSeenAt);
        if(mem.identityKeys) Object.assign(identityKeys,mem.identityKeys);
        if(mem.businessInfo) Object.assign(businessInfo,mem.businessInfo);
        const age=mem.savedAt?fmtDur(Date.now()-mem.savedAt):'?';
        L.ok(`Memory loaded (${Object.keys(mem.deviceOf||{}).length} devices, ${Object.keys(mem.businessInfo||{}).length} biz, age: ${age})`);
    }catch{}
}
// Auto-save every 5 min
let memTimer=null;
function startMemSave(){if(memTimer)clearInterval(memTimer);memTimer=setInterval(saveMemory,5*60*1000);}
function stopMemSave(){if(memTimer){clearInterval(memTimer);memTimer=null;}saveMemory();}

// Ask S2 to verify DP — returns promise with timeout
function s2CheckDP(num){
    return new Promise(resolve=>{
        if(!verifier||!s2Connected){resolve(null);return;}
        const key='dp_'+num;
        const timer=setTimeout(()=>{delete s2Callbacks[key];resolve(null);},15000);
        s2Callbacks[key]=(msg)=>{clearTimeout(timer);resolve(msg);};
        verifier.send({type:'check_dp',number:num});
    });
}
// Ask S2 to verify Bio — returns promise with timeout
function s2CheckBio(num){
    return new Promise(resolve=>{
        if(!verifier||!s2Connected){resolve(null);return;}
        const key='bio_'+num;
        const timer=setTimeout(()=>{delete s2Callbacks[key];resolve(null);},15000);
        s2Callbacks[key]=(msg)=>{clearTimeout(timer);resolve(msg);};
        verifier.send({type:'check_bio',number:num});
    });
}
// Ask S2 to verify WhatsApp registration — returns {exists, lid, err}
function s2CheckWA(num){
    return new Promise(resolve=>{
        if(!verifier||!s2Connected){resolve(null);return;}
        const key='wa_'+num;
        const timer=setTimeout(()=>{delete s2Callbacks[key];resolve(null);},12000);
        s2Callbacks[key]=(msg)=>{clearTimeout(timer);resolve(msg);};
        verifier.send({type:'check_wa',number:num});
    });
}
// Ask S3 to verify WhatsApp registration — returns {exists, lid, err}
function s3CheckWA(num){
    return new Promise(resolve=>{
        if(!verifier3||!s3Connected){resolve(null);return;}
        const key='wa3_'+num;
        const timer=setTimeout(()=>{delete s3Callbacks[key];resolve(null);},12000);
        s3Callbacks[key]=(msg)=>{clearTimeout(timer);resolve(msg);};
        verifier3.send({type:'check_wa',number:num});
    });
}

const FORCE_OFF_MS=25000;  // 25s both silent → offline
const VERIFY_EVERY=5000;   // S2 verifies online nums every 5s
const RESUB_EVERY=12000;   // re-subscribe every 12s (tighter — presence expires 10s)
const KEEPALIVE_EVERY=20000;
const HEALTH_CHECK_MS=20000; // WS health check every 20s
const MAX_MISSED_PINGS=3;   // Reconnect after 3 missed

// ══════════════════════════════════════════════════════════════════════════════
//  DATA (2s disk cache)
// ══════════════════════════════════════════════════════════════════════════════
let _cache=null,_cacheTs=0;
function load(){
    try{if(_cache&&Date.now()-_cacheTs<2000) return JSON.parse(JSON.stringify(_cache));}catch{_cache=null;}
    try{if(fs.existsSync(DATA_FILE)){
        _cache=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));
        _cacheTs=Date.now();
        return JSON.parse(JSON.stringify(_cache));
    }}catch{_cache=null;}
    return{monitored:[],labels:{},wa_number:null,paired:false,lidMap:{},bioDB:{},dpHistory:{},bioHistory:{}};
}
function save(d){try{fs.writeFileSync(DATA_FILE,JSON.stringify(d,null,2));_cache=d;_cacheTs=Date.now();}catch{}}

// ══════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════════════════════
const clean=n=>n.replace(/[\+\s\-()]/g,'');
const toJid=n=>`${clean(n)}@s.whatsapp.net`;
const fromJid=j=>(j||'').split('@')[0];
const fmtTime=t=>{if(!t)return'?';const d=new Date(t);const base=d.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',
    hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});const ms=String(d.getMilliseconds()).padStart(3,'0');return `${base}.${ms}`;};
const fmtDur=ms=>{if(!ms||ms<=0)return'0s';const s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60);
    return h?`${h}h${m%60}m`:(m?`${m}m${s%60}s`:`${s}s`);};
function devIcon(n){const p=deviceOf[n];return p==='iOS'?'🍎 iOS':p==='Android'?'🤖 Android':p==='Web'?'💻 Web':'📱 Mobile';}
function bizTag(n){return businessInfo[n]?.isBusiness?' · 💼 Business':'';}

// ── Resolve JID → phone number ──────────────────────────────────────────────
function resolveNum(jid){
    if(!jid) return null;
    const raw=fromJid(jid);
    if(!jid.includes('@lid')) return/^\d{7,15}$/.test(raw)?raw:null;
    return lidMap[raw]||null;
}

// ══════════════════════════════════════════════════════════════════════════════
//  DEVICE DETECTION — Message ID Prefix (proven method)
// ══════════════════════════════════════════════════════════════════════════════
function detectDevice(msg,num){
    const id=msg.key?.id||'';if(!id||id.length<3) return;
    let plat=null;
    const prefix=id.substring(0,3).toUpperCase();
    const prefix2=id.substring(0,2).toUpperCase();

    // ═══ CONFIRMED PREFIX TABLE (verified 21 Mar 2026) ═══
    // 3-char EXACT match (highest confidence)
    if(prefix==='3EB') plat='Android';       // ✅ Verified Android
    else if(prefix==='ACA') plat='Android';  // ✅ Verified Android
    else if(prefix==='3AC') plat='iOS';      // ✅ Verified iPhone
    else if(prefix==='BAE'||prefix==='BAF') plat='Web'; // ✅ Verified Web

    // 3-char iOS variants (3A0-3AF all confirmed iOS)
    else if(prefix.startsWith('3A')&&prefix.length===3) plat='iOS'; // ✅ All 3A* = iOS

    // 2-char CONFIRMED fallback
    else if(prefix2==='3E') plat='Android';  // ✅ Confirmed
    else if(prefix2==='3A') plat='iOS';      // ✅ Confirmed
    else if(prefix2==='AC') plat='Android';  // ✅ Confirmed
    else if(prefix2==='A5') plat='Android';  // ✅ Confirmed
    else if(prefix2==='A3') plat='iOS';      // ✅ Confirmed community
    else if(prefix2==='BA') plat='Web';      // ✅ Confirmed

    // ❌ NO GUESSING — if not in table, log and skip
    if(!plat){
        if(id.length>=4) L.sub(`[DEVICE?] ${X.w}${num}${R} unknown: ${X.y}${id.substring(0,6)}${R} — report this!`);
        return;
    }

    // ── Device Log — track every device seen ──
    if(!deviceLog[num]) deviceLog[num]=[];
    deviceLog[num].push({device:plat,ts:Date.now()});
    if(deviceLog[num].length>200) deviceLog[num]=deviceLog[num].slice(-200);

    // ── Multi-device detection — phone+web at same time ──
    if(!multiDevice[num]) multiDevice[num]={devices:new Set(),lastAlert:0,window:[]};
    multiDevice[num].window.push({device:plat,ts:Date.now()});
    // Keep last 60s window
    const cutoff=Date.now()-60000;
    multiDevice[num].window=multiDevice[num].window.filter(e=>e.ts>cutoff);
    const recentDevices=new Set(multiDevice[num].window.map(e=>e.device));
    if(recentDevices.size>=2&&Date.now()-multiDevice[num].lastAlert>300000){
        // 2+ different devices in last 60s — alert (max every 5 min)
        multiDevice[num].lastAlert=Date.now();
        const devList=[...recentDevices].map(d=>d==='iOS'?'🍎 iOS':d==='Android'?'🤖 Android':'💻 Web').join(' + ');
        const d=load(),lbl=d.labels?.[num]?` (${d.labels[num]})`:'';
        L.dev(`${X.w}${num}${R} MULTI-DEVICE: ${devList}`);
        tgSend(
            `📱📱 *Multi-Device Detected!*\n${'━'.repeat(28)}\n`+
            `👤 \`${num}\`${lbl}\n`+
            `🔀 *${devList}*\n`+
            `🕐 ${fmtTime(Date.now())}\n\n`+
            `_Using ${recentDevices.size} devices simultaneously_`
        );
    }

    // ── Device change + edit online msg ──
    if(plat&&deviceOf[num]!==plat){
        const prev=deviceOf[num];deviceOf[num]=plat;
        L.dev(`${X.w}${num}${R} → ${plat} (${id.substring(0,4)})`);
        if(onlineMsgId[num]&&online[num]){
            const d=load(),lbl=d.labels?.[num]?` (${d.labels[num]})`:'';
            const nc=nonContactFlag[num]?' 👻':'';
            const dur=onlineSince[num]?fmtDur(Date.now()-onlineSince[num]):'';
            const devTxt=plat==='iOS'?'🍎 iOS':plat==='Android'?'🤖 Android':'💻 Web';
            tg.editMessageText(
                `🟢 *Online*  \`${num}\`${lbl}${nc}\n${'━'.repeat(28)}\n`+
                `📱 *${devTxt}* ✅\n`+
                `🕐 ${fmtTime(onlineSince[num]||Date.now())}\n`+
                `⏱ _${dur||'just now'}_`,
                {chat_id:OWNER_ID,message_id:onlineMsgId[num],parse_mode:'Markdown'}
            ).catch(()=>{});
        }
        if(prev&&prev!==plat){
            const d=load(),lbl=d.labels?.[num]?` (${d.labels[num]})`:'';
            tgSend(`📱 *Device Changed*\n${'─'.repeat(24)}\n👤 \`${num}\`${lbl}\n🔄 ${prev} → *${plat}*\n🕐 ${fmtTime(Date.now())}`);
        }
    }
}

// ── Session Tracker — log online/offline sessions ────────────────────────
function logSession(num,type){
    const today=new Date().toDateString();
    if(!sessionLog[num]) sessionLog[num]={date:today,sessions:[],totalMs:0};
    // Reset if new day
    if(sessionLog[num].date!==today) sessionLog[num]={date:today,sessions:[],totalMs:0};
    if(type==='online'){
        sessionLog[num].sessions.push({on:Date.now(),off:0,dur:0});
        if(spyList[num]&&Date.now()<spyList[num].until){
            spyList[num].results.push({type:'online',ts:Date.now()});
            tgSend(`🕵️ *SPY — ONLINE*\n👤 \`${num}\` · ${devIcon(num)}\n🕐 ${fmtTime(Date.now())}`);
        }
    } else if(type==='offline'){
        const last=sessionLog[num].sessions[sessionLog[num].sessions.length-1];
        if(last&&!last.off){
            last.off=Date.now();
            last.dur=last.off-last.on;
            sessionLog[num].totalMs+=last.dur;
        }
        lastSeenAt[num]=Date.now();
        saveMemory(); // Persist last seen
        if(spyList[num]&&Date.now()<spyList[num].until){
            const dur=last?.dur?fmtDur(last.dur):'?';
            spyList[num].results.push({type:'offline',dur,ts:Date.now()});
            tgSend(`🕵️ *SPY — OFFLINE*\n👤 \`${num}\` · ⏱ ${dur}\n🕐 ${fmtTime(Date.now())}`);
        }
    }
}

// ── Get today's total online time ────────────────────────────────────────
function getTodayOnline(num){
    if(!sessionLog[num]) return 0;
    const today=new Date().toDateString();
    if(sessionLog[num].date!==today) return 0;
    let total=sessionLog[num].totalMs;
    // Add current session if still online
    const last=sessionLog[num].sessions[sessionLog[num].sessions.length-1];
    if(last&&!last.off&&online[num]) total+=Date.now()-last.on;
    return total;
}

// ── Device pattern — when phone vs web ───────────────────────────────────
function getDevicePattern(num){
    if(!deviceLog[num]||!deviceLog[num].length) return 'No data';
    const today=new Date().toDateString();
    const todayLogs=deviceLog[num].filter(e=>new Date(e.ts).toDateString()===today);
    if(!todayLogs.length) return 'No activity today';
    const counts={};
    todayLogs.forEach(e=>{counts[e.device]=(counts[e.device]||0)+1;});
    const parts=Object.entries(counts).sort((a,b)=>b[1]-a[1])
        .map(([d,c])=>`${d==='iOS'?'🍎':d==='Android'?'🤖':'💻'} ${d}: ${c}x`);
    // Time ranges per device
    const ranges={};
    todayLogs.forEach(e=>{
        if(!ranges[e.device]) ranges[e.device]={first:e.ts,last:e.ts};
        else ranges[e.device].last=e.ts;
    });
    const timeInfo=Object.entries(ranges).map(([d,r])=>{
        const f=new Date(r.first),l=new Date(r.last);
        return `${d}: ${f.getHours()}:${String(f.getMinutes()).padStart(2,'0')}-${l.getHours()}:${String(l.getMinutes()).padStart(2,'0')}`;
    });
    return parts.join('\n')+(timeInfo.length?'\n'+timeInfo.join('\n'):'');
}

// ══════════════════════════════════════════════════════════════════════════════
//  MERGE LOGIC — S1 detect → 3s wait → S2 confirm → alert
// ══════════════════════════════════════════════════════════════════════════════
const pendingOnline={};  // num → setTimeout ref (3s verification window)

function merge(num){
    const d=load();if(!d.monitored.includes(num)) return;
    const now=Date.now();
    const r1=s1State[num],r2=s2State[num],r3=s3State[num];

    const isOn=st=>st==='available'||st==='composing'||st==='recording';
    const s1On=r1&&isOn(r1.status)&&(now-r1.ts)<60000;
    const s2On=r2&&isOn(r2.status)&&(now-r2.ts)<60000;
    const s3On=r3&&isOn(r3.status)&&(now-r3.ts)<60000;
    const anyOn=s1On||s2On||s3On;
    const onCount=(s1On?1:0)+(s2On?1:0)+(s3On?1:0);

    // ── ONLINE FLOW ──────────────────────────────────────────────────────
    if(anyOn&&!online[num]&&!pendingOnline[num]){
        if(cooldown[num]&&now-cooldown[num]<1500) return;
        if(offlineDebounce[num]){clearTimeout(offlineDebounce[num]);delete offlineDebounce[num];}

        const firstSrc=s1On?'S1':(s2On?'S2':'S3');
        L.sub(`${X.w}${num}${R} detected by ${firstSrc} — verifying 3s...`);

        // Ask S2 + S3 to verify
        if(verifier&&s2Connected) verifier.send({type:'verify',number:num});
        if(verifier3&&s3Connected) verifier3.send({type:'verify',number:num});

        pendingOnline[num]=setTimeout(()=>{
            delete pendingOnline[num];
            if(online[num]) return;

            const nr1=s1State[num],nr2=s2State[num],nr3=s3State[num];
            const now2=Date.now();
            const s1Still=nr1&&isOn(nr1.status)&&(now2-nr1.ts)<60000;
            const s2Still=nr2&&isOn(nr2.status)&&(now2-nr2.ts)<60000;
            const s3Still=nr3&&isOn(nr3.status)&&(now2-nr3.ts)<60000;
            const count=(s1Still?1:0)+(s2Still?1:0)+(s3Still?1:0);

            if(count===0) return; // All gone — false alarm

            online[num]=true;logSession(num,"online");
            onlineSince[num]=now;
            lastEvent[num]=now2;cooldown[num]=now2;

            const src=count>=3?'TRIPLE ✓✓✓':(count===2?'DUAL ✓✓':(s1Still?'S1':'S2'));
            const lbl=d.labels?.[num]?` (${d.labels[num]})`:'';
            const nc=nonContactFlag[num]?' 👻':'';
            L.on(`${X.w}${num}${R} [${devIcon(num)}] ${src}${nc}`);
            tg.sendMessage(OWNER_ID,
                `🟢 *Online*  \`${num}\`${lbl}${nc}\n${'━'.repeat(28)}\n`+
                `📱 ${devIcon(num)}${bizTag(num)}\n`+
                `🕐 ${fmtTime(now)}\n`+
                `🔒 *${src}*\n`+
                `⏱ _${count}/3 sessions confirmed_`,
                {parse_mode:'Markdown'}
            ).then(m=>{onlineMsgId[num]=m.message_id;}).catch(()=>{});
        },3000);
    }

    // ── Instant DUAL/TRIPLE upgrade ──
    if(pendingOnline[num]&&onCount>=2&&!online[num]){
        clearTimeout(pendingOnline[num]);delete pendingOnline[num];
        if(offlineDebounce[num]){clearTimeout(offlineDebounce[num]);delete offlineDebounce[num];}

        online[num]=true;logSession(num,"online");
        onlineSince[num]=now;
        lastEvent[num]=now;cooldown[num]=now;

        const src=onCount>=3?'TRIPLE ✓✓✓':'DUAL ✓✓';
        const lbl=d.labels?.[num]?` (${d.labels[num]})`:'';
        const nc=nonContactFlag[num]?' 👻':'';
        L.on(`${X.w}${num}${R} [${devIcon(num)}] ${src} (instant)${nc}`);
        tg.sendMessage(OWNER_ID,
            `🟢 *Online*  \`${num}\`${lbl}${nc}\n${'━'.repeat(28)}\n`+
            `📱 ${devIcon(num)}${bizTag(num)}\n`+
            `🕐 ${fmtTime(now)}\n`+
            `🔒 *${src}* _(${onCount}/3 instant)_`,
            {parse_mode:'Markdown'}
        ).then(m=>{onlineMsgId[num]=m.message_id;}).catch(()=>{});
    }

    // ── KEEP ALIVE ───────────────────────────────────────────────────────
    if(anyOn){
        lastEvent[num]=now;
        if(offlineDebounce[num]){clearTimeout(offlineDebounce[num]);delete offlineDebounce[num];}
    }

    // ── OFFLINE FLOW — 2 of 3 must confirm ───────────────────────────────
    if(online[num]){
        const s1HasUnavail=r1&&r1.status==='unavailable';
        const s2HasUnavail=r2&&r2.status==='unavailable';
        const s3HasUnavail=r3&&r3.status==='unavailable';
        const s1Timeout=!r1||(now-(r1?.ts||0))>FORCE_OFF_MS;
        const s2Timeout=!r2||(now-(r2?.ts||0))>FORCE_OFF_MS;
        const s3Timeout=!r3||(now-(r3?.ts||0))>FORCE_OFF_MS;
        // Offline evidence: unavailable OR timeout
        const s1Off=s1HasUnavail||s1Timeout;
        const s2Off=s2HasUnavail||s2Timeout;
        const s3Off=s3HasUnavail||s3Timeout;
        const offCount=(s1Off?1:0)+(s2Off?1:0)+(s3Off?1:0);
        // Need 2 of 3 sessions to confirm offline
        const shouldOffline=offCount>=2;

        if(shouldOffline&&!offlineDebounce[num]){
            offlineDebounce[num]=setTimeout(()=>{
                delete offlineDebounce[num];
                if(!online[num]) return;

                // Final check — ask all sessions
                if(verifier&&s2Connected) verifier.send({type:'verify',number:num});
                if(verifier3&&s3Connected) verifier3.send({type:'verify',number:num});

                // 500ms — final decision
                setTimeout(()=>{
                    if(!online[num]) return;
                    const fr1=s1State[num],fr2=s2State[num],fr3=s3State[num];
                    const fn=Date.now();
                    const s1StillOn=fr1&&isOn(fr1.status)&&(fn-fr1.ts)<8000;
                    const s2StillOn=fr2&&isOn(fr2.status)&&(fn-fr2.ts)<8000;
                    const s3StillOn=fr3&&isOn(fr3.status)&&(fn-fr3.ts)<8000;
                    if(s1StillOn||s2StillOn||s3StillOn){
                        lastEvent[num]=fn;return; // Any session still on — cancel
                    }

                    online[num]=false;logSession(num,"offline");delete cooldown[num];
                    lastSeenAt[num]=Date.now(); // Record last seen
                    if(typingState[num]){clearTimeout(typingState[num].timer);delete typingState[num];}
                    const dur=onlineSince[num]?fmtDur(fn-onlineSince[num]):'?';
                    delete onlineSince[num];delete onlineMsgId[num];
                    const lbl=d.labels?.[num]?` (${d.labels[num]})`:'';
                    L.off(`${X.w}${num}${R} [${dur}] TRIPLE ✓✓✓`);
                    tgSend(
                        `⚫ *Offline*  \`${num}\`${lbl}\n${'━'.repeat(28)}\n`+
                        `📱 ${devIcon(num)}${businessInfo[num]?.isBusiness?' · 💼 Business':''}\n`+
                        `🕐 ${fmtTime(fn)}\n`+
                        `⏱ *Session: ${dur}*\n`+
                        `📊 Today total: ${fmtDur(getTodayOnline(num))}\n`+
                        `🔒 *TRIPLE CONFIRMED*`
                    );
                },500);
            },500);
        }
    }
}

// ── Typing handler — with duration tracking ─────────────────────────────────
function handleTyping(num,type){
    const now=Date.now();
    lastEvent[num]=now;
    if(offlineDebounce[num]){clearTimeout(offlineDebounce[num]);delete offlineDebounce[num];}
    if(!online[num]){s1State[num]={status:type,ts:now};merge(num);}
    if(typingState[num]?.type===type) return;
    // If previous typing — show duration of that burst
    if(typingState[num]){
        clearTimeout(typingState[num].timer);
        const typDur=fmtDur(now-typingState[num].since);
        L.typ(`${X.w}${num}${R} stopped ${typingState[num].type} (${typDur})`);
    }
    typingState[num]={type,since:now,timer:setTimeout(()=>{
        // Typing stopped — show duration
        const dur=fmtDur(Date.now()-typingState[num].since);
        L.typ(`${X.w}${num}${R} stopped ${type} (${dur})`);
        delete typingState[num];
    },30000)};
    const d=load(),lbl=d.labels?.[num]?` (${d.labels[num]})`:'';
    const isRec=type==='recording';
    L.typ(`${X.w}${num}${R} → ${type}`);
    tgSend(`${isRec?'🎙':'✍️'} *${isRec?'Recording...':'Typing...'}*\n${'─'.repeat(24)}\n👤 \`${num}\`${lbl}\n🕐 ${fmtTime(now)}`);
    if(spyList[num]&&Date.now()<spyList[num].until) spyList[num].results.push({type:isRec?'recording':'typing',ts:now});
}

// ══════════════════════════════════════════════════════════════════════════════
//  SESSION 2 — Child Process Management
// ══════════════════════════════════════════════════════════════════════════════
let verifier=null,s2Connected=false;

function startVerifier(){
    const vPath=path.join(__dirname,'verifier.js');
    if(!fs.existsSync(vPath)){L.err('verifier.js not found!');return;}
    if(verifier){try{verifier.kill();}catch{}}
    verifier=fork(vPath,{silent:false});
    L.s2('Process started');

    verifier.on('message',msg=>{
        if(!msg?.type) return;

        if(msg.type==='connected'){
            s2Connected=true;L.s2('Connected ✅');
            // Subscribe all monitored numbers (with LID info) — small delay for stability
            setTimeout(()=>{
                const d=load();
                if(!d.monitored.length){L.s2('No numbers to subscribe yet');return;}
                const nums=d.monitored.map(n=>({num:n,lid:phoneLid[n]||null}));
                L.s2(`Subscribing ${nums.length} numbers...`);
                verifier.send({type:'subscribe_all',numbers:nums});
            },2000);
        }
        if(msg.type==='logged_out'){
            s2Connected=false;L.s2('Logged out');
            tgSend('⚠️ *Session 2 logged out*\nSend `/pair2` to reconnect');
        }
        if(msg.type==='pair_code'){
            L.ok(`[S2] Code: ${msg.code}`);
            tgSend(`🔗 *SESSION 2 CODE*\n${'━'.repeat(24)}\n\`${msg.code}\`\n${'━'.repeat(24)}\n\n📱 Enter in WhatsApp\n⏰ *60s!*`);
        }
        if(msg.type==='pair_error'){
            tgSend(`❌ *S2 Pair Failed:* ${msg.error}\nRetry: \`/pair2\``);
        }
        if(msg.type==='log') L.s2(msg.msg);

        // Presence from Session 2
        if(msg.type==='presence'){
            const d=load();
            if(d.monitored.includes(msg.id)){
                s2State[msg.id]={status:msg.status,ts:msg.ts};
                merge(msg.id);
            }
        }
        // LID presence — resolve and merge
        if(msg.type==='presence_lid'){
            const phone=lidMap[msg.lid];
            if(phone){
                s2State[phone]={status:msg.status,ts:msg.ts};
                
                merge(phone);
            }
        }
        // Verify result — only update if state CHANGED
        if(msg.type==='verify_result'){
            // IGNORE 'unknown' — S2 has no data, don't use as evidence
            if(msg.status==='unknown') return;
            const prev=s2State[msg.number];
            const newSt=msg.online?'available':'unavailable';
            if(!prev||prev.status!==newSt){
                s2State[msg.number]={status:newSt,ts:msg.ts};
                merge(msg.number);
            }
        }
        // LID mapping from S2 — silent save, only log monitored numbers
        if(msg.type==='lid_map'){
            if(msg.phone&&msg.lid&&!lidMap[msg.lid]){
                lidMap[msg.lid]=msg.phone;phoneLid[msg.phone]=msg.lid;
                const d=load();
                if(d.monitored.includes(msg.phone)){
                    L.sub(`[S2] LID: ${msg.phone} ↔ ${msg.lid.substring(0,8)}...`);
                }
            }
        }
        // S2 DP/Bio verification results
        if(msg.type==='dp_result'){
            const key='dp_'+msg.number;
            if(s2Callbacks[key]){s2Callbacks[key](msg);delete s2Callbacks[key];}
        }
        if(msg.type==='bio_result'){
            const key='bio_'+msg.number;
            if(s2Callbacks[key]){s2Callbacks[key](msg);delete s2Callbacks[key];}
        }
        // Health pong from S2
        if(msg.type==='health_pong'){
            for(const k of Object.keys(s2Callbacks)){
                if(k.startsWith('health_s2_')){s2Callbacks[k](msg.alive);delete s2Callbacks[k];break;}
            }
        }
        // Business check result from S2
        if(msg.type==='biz_result'){
            const key='biz_'+msg.number;
            if(s2Callbacks[key]){s2Callbacks[key](msg.isBusiness);delete s2Callbacks[key];}
        }
        // WhatsApp registration check from S2
        if(msg.type==='wa_result'){
            const key='wa_'+msg.number;
            if(s2Callbacks[key]){s2Callbacks[key](msg);delete s2Callbacks[key];}
        }
    });

    verifier.on('exit',code=>{
        s2Connected=false;
        L.s2(`Exited (${code}) — restart in 5s`);
        setTimeout(startVerifier,5000);
    });
    verifier.on('error',e=>L.s2(`Error: ${e.message}`));
}

// ══════════════════════════════════════════════════════════════════════════════
//  SESSION 3 — Child Process Management (Triple Engine)
// ══════════════════════════════════════════════════════════════════════════════
let verifier3=null,s3Connected=false;
let s3ManualKill=false; // Prevent exit handler restart when /pair3 kills deliberately
const s3State={};
const s3Callbacks={};

function startVerifier3(){
    const vPath=path.join(__dirname,'verifier3.js');
    if(!fs.existsSync(vPath)){
        L.err('❌ verifier3.js NOT FOUND — S3 disabled');
        tgSend('❌ `verifier3.js` file missing — Session 3 disabled.\nUpload the file and restart.');
        return;
    }
    if(verifier3){try{verifier3.kill();}catch{}}
    verifier3=fork(vPath,{silent:false});
    L.inf('[S3] Process started (PID:'+verifier3.pid+')');

    // Log S3 errors
    verifier3.on('error',e=>L.err(`[S3] Error: ${e.message}`));

    verifier3.on('message',msg=>{
        if(!msg?.type) return;

        if(msg.type==='connected'){
            s3Connected=true;L.inf('[S3] Connected ✅');
            setTimeout(()=>{
                const d=load();
                if(!d.monitored.length) return;
                const nums=d.monitored.map(n=>({num:n,lid:phoneLid[n]||null}));
                L.inf(`[S3] Subscribing ${nums.length} numbers...`);
                verifier3.send({type:'subscribe_all',numbers:nums});
            },2000);
        }
        if(msg.type==='logged_out'){
            s3Connected=false;L.inf('[S3] Logged out');
            tgSend('⚠️ *Session 3 logged out*\nSend `/pair3` to reconnect');
        }
        if(msg.type==='pair_code'){
            L.ok(`[S3] Code: ${msg.code}`);
            tgSend(`🔗 *SESSION 3 CODE*\n${'━'.repeat(24)}\n\`${msg.code}\`\n${'━'.repeat(24)}\n\n📱 Enter in WhatsApp\n⏰ *60s!*`);
        }
        if(msg.type==='pair_error'){
            tgSend(`❌ *S3 Pair Failed:* ${msg.error}\nRetry: \`/pair3\``);
        }
        if(msg.type==='log') L.inf(`[S3] ${msg.msg}`);

        // Presence from S3
        if(msg.type==='presence'){
            const d=load();
            if(d.monitored.includes(msg.id)){
                s3State[msg.id]={status:msg.status,ts:msg.ts};
                merge(msg.id);
            }
        }
        if(msg.type==='presence_lid'){
            const phone=lidMap[msg.lid];
            if(phone){
                s3State[phone]={status:msg.status,ts:msg.ts};
                merge(phone);
            }
        }
        if(msg.type==='verify_result'){
            if(msg.status==='unknown') return;
            const newSt=msg.online?'available':'unavailable';
            const prev=s3State[msg.number];
            if(!prev||prev.status!==newSt){
                s3State[msg.number]={status:newSt,ts:msg.ts};
                merge(msg.number);
            }
        }
        if(msg.type==='lid_map'){
            if(msg.phone&&msg.lid&&!lidMap[msg.lid]){
                lidMap[msg.lid]=msg.phone;phoneLid[msg.phone]=msg.lid;
            }
        }
        // S3 DP/Bio verification
        if(msg.type==='dp_result'){
            const key='dp3_'+msg.number;
            if(s3Callbacks[key]){s3Callbacks[key](msg);delete s3Callbacks[key];}
        }
        if(msg.type==='bio_result'){
            const key='bio3_'+msg.number;
            if(s3Callbacks[key]){s3Callbacks[key](msg);delete s3Callbacks[key];}
        }
        // Health pong from S3
        if(msg.type==='health_pong'){
            for(const k of Object.keys(s3Callbacks)){
                if(k.startsWith('health_s3_')){s3Callbacks[k](msg.alive);delete s3Callbacks[k];break;}
            }
        }
        // Business check result from S3
        if(msg.type==='biz_result'){
            const key='biz3_'+msg.number;
            if(s3Callbacks[key]){s3Callbacks[key](msg.isBusiness);delete s3Callbacks[key];}
        }
        // WhatsApp registration check from S3
        if(msg.type==='wa_result'){
            const key='wa3_'+msg.number;
            if(s3Callbacks[key]){s3Callbacks[key](msg);delete s3Callbacks[key];}
        }
    });

    verifier3.on('exit',code=>{
        s3Connected=false;
        if(s3ManualKill){
            s3ManualKill=false;
            L.inf(`[S3] Killed for re-pair — no auto-restart`);
            return;
        }
        if(code===null||code===1){
            L.inf(`[S3] Crashed — restart in 15s`);
            setTimeout(startVerifier3,15000);
        } else {
            L.inf(`[S3] Exited (${code}) — restart in 5s`);
            setTimeout(startVerifier3,5000);
        }
    });
}

// ── Helper: request DP/Bio from S3 ──
function s3RequestDP(num){
    return new Promise(resolve=>{
        if(!verifier3||!s3Connected){resolve(null);return;}
        const key='dp3_'+num;
        s3Callbacks[key]=resolve;
        verifier3.send({type:'check_dp',number:num});
        setTimeout(()=>{if(s3Callbacks[key]){delete s3Callbacks[key];resolve(null);}},8000);
    });
}
function s3RequestBio(num){
    return new Promise(resolve=>{
        if(!verifier3||!s3Connected){resolve(null);return;}
        const key='bio3_'+num;
        s3Callbacks[key]=resolve;
        verifier3.send({type:'check_bio',number:num});
        setTimeout(()=>{if(s3Callbacks[key]){delete s3Callbacks[key];resolve(null);}},8000);
    });
}

// ══════════════════════════════════════════════════════════════════════════════
//  TELEGRAM
// ══════════════════════════════════════════════════════════════════════════════
const tg=new TelegramBot(BOT_TOKEN,{polling:true});
tg.on('polling_error',e=>L.err(`TG: ${e.code||e.message}`));
const tgSend=t=>tg.sendMessage(OWNER_ID,t,{parse_mode:'Markdown'}).catch(()=>{});

function menuKb(d){
    const s1i=conn1?'🟢':'🔴',s2i=s2Connected?'🟢':'🔴',s3i=s3Connected?'🟢':'🔴';
    return{inline_keyboard:[
        [{text:`👁 List (${d.monitored.length})`,callback_data:'list'},{text:'➕ Add',callback_data:'add'}],
        [{text:`📡 S1:${s1i} S2:${s2i} S3:${s3i}`,callback_data:'status'},{text:'🗑 Remove',callback_data:'rm'}],
        [{text:'⚙️ Help',callback_data:'help'}],
    ]};
}

// ── /start ──
tg.onText(/\/start/,msg=>{
    if(msg.from.id!==OWNER_ID) return;
    const d=load();
    tg.sendPhoto(msg.chat.id,MENU_PIC,{
        caption:`👑 *AIZEN PRO MAX 69*\n${'━'.repeat(28)}\n\n📡 S1: ${conn1?'🟢':'🔴'}  S2: ${s2Connected?'🟢':'🔴'}  S3: ${s3Connected?'🟢':'🔴'}\n👁 *${d.monitored.length}/${MAX_NUMS}*\n\n_Triple Engine ·_ [@immortalaizen](https://instagram.com/immortalaizen)`,
        parse_mode:'Markdown',reply_markup:menuKb(d)
    }).catch(()=>{});
});

// ── /pair — Session 1 ──
tg.onText(/\/pair(?:\s+(.+))?$/,async(msg,match)=>{
    if(msg.from.id!==OWNER_ID) return;
    if(msg.text.startsWith('/pair2')||msg.text.startsWith('/pair3')) return; // Don't catch /pair2 or /pair3
    const d=load();
    if(match?.[1]){const n=clean(match[1]);if(!/^\d{10,15}$/.test(n))return tgSend('❌ Invalid number');WA_NUM=n;d.wa_number=n;save(d);}
    else if(d.wa_number) WA_NUM=d.wa_number;
    else return tgSend('❌ `/pair 919876543210`');
    tgSend(`📱 Connecting Session 1: \`${WA_NUM}\`...`);
    // Fresh pair — stop timers, close old connection, delete auth
    stopTimers();
    if(sock){try{sock.end();}catch{}}sock=null;conn1=false;isPairing1=false;
    try{fs.rmSync(AUTH_1,{recursive:true,force:true});}catch{}
    await new Promise(r=>setTimeout(r,1500));
    connectS1();
});

// ── /pair2 — Session 2 ──
tg.onText(/\/pair2(?:\s+(.+))?/,(msg,match)=>{
    if(msg.from.id!==OWNER_ID) return;
    let num=WA_NUM;
    if(match?.[1]) num=clean(match[1]);
    const d=load();if(!num&&d.wa_number) num=d.wa_number;
    if(!num) return tgSend('❌ `/pair2 919876543210`');
    tgSend(`📱 Pairing Session 2: \`${num}\`...`);
    if(!verifier) startVerifier();
    // Small delay to ensure verifier process is ready
    setTimeout(()=>{
        if(verifier&&!verifier.killed) verifier.send({type:'pair',number:num});
        else{startVerifier();setTimeout(()=>{if(verifier)verifier.send({type:'pair',number:num});},3000);}
    },1000);
});

// ── /pair3 — Session 3 ──
tg.onText(/\/pair3(?:\s+(.+))?/,(msg,match)=>{
    if(msg.from.id!==OWNER_ID) return;
    let num=WA_NUM;
    if(match?.[1]) num=clean(match[1]);
    const d=load();if(!num&&d.wa_number) num=d.wa_number;
    if(!num) return tgSend('❌ `/pair3 919876543210`');
    tgSend(`📱 Pairing Session 3: \`${num}\`...`);
    
    // Kill old S3 — set flag to prevent exit handler restart
    s3ManualKill=true;
    if(verifier3){try{verifier3.removeAllListeners();verifier3.kill();}catch{}}
    verifier3=null;s3Connected=false;
    
    // Wait for old process to fully die
    setTimeout(()=>{
        s3ManualKill=false;
        startVerifier3();
        
        // Wait for new process to be ready, then send pair
        setTimeout(()=>{
            if(verifier3&&!verifier3.killed){
                L.inf(`[S3] Sending pair: ${num}`);
                verifier3.send({type:'pair',number:num});
            } else {
                tgSend('❌ *S3 failed* — check `verifier3.js` exists');
            }
        },3000);
    },2000);
});

// ── /spy — 2-min intensive scan ──────────────────────────────────────────
tg.onText(/\/spy (.+)/,async(msg,match)=>{
    if(msg.from.id!==OWNER_ID) return;
    const num=clean(match[1]);
    if(!/^\d{10,15}$/.test(num)) return tgSend('❌ Invalid number');
    const d=load(),lbl=d.labels?.[num]?` (${d.labels[num]})`:'';
    spyList[num]={until:Date.now()+120000,results:[],startedAt:Date.now()};
    tgSend(`🕵️ *SPY MODE — 2 min*\n${'━'.repeat(28)}\n👤 \`${num}\`${lbl}\n_All 3 sessions targeting..._`);
    let spyRound=0;
    const spyTimer=setInterval(async()=>{
        if(!spyList[num]||Date.now()>spyList[num].until){
            clearInterval(spyTimer);
            const results=spyList[num]?.results||[];
            let summary=`🕵️ *SPY COMPLETE*\n${'━'.repeat(28)}\n👤 \`${num}\`${lbl}\n`;
            if(!results.length) summary+=`❌ No activity detected`;
            else{
                const types={};results.forEach(r=>{types[r.type]=(types[r.type]||0)+1;});
                summary+=`✅ *${results.length} events:*\n`;
                for(const[t,c]of Object.entries(types)) summary+=`  ${t}: ${c}x\n`;
            }
            summary+=`\n*Now:* ${online[num]?'🟢 ONLINE':'⚫ Offline'}`;
            if(deviceOf[num]) summary+=` · ${devIcon(num)}`;
            if(lastSeenAt[num]) summary+=`\n🕐 Last seen: ${fmtTime(lastSeenAt[num])}`;
            tgSend(summary);delete spyList[num];return;
        }
        spyRound++;const turn=spyRound%3;const jid=toJid(num);
        try{
            if(turn===0&&sock&&conn1){
                await sock.sendPresenceUpdate('available');
                await sock.presenceSubscribe(jid);
                if(phoneLid[num])await sock.presenceSubscribe(`${phoneLid[num]}@lid`);
            }else if(turn===1&&verifier&&s2Connected){
                verifier.send({type:'verify',number:num});
            }else if(turn===2&&verifier3&&s3Connected){
                verifier3.send({type:'verify',number:num});
            }
        }catch{}
    },3000);
});

// ── /health — Live session health check ─────────────────────────────────
let healthInterval=null;
const AUTO_HEALTH_MS=3600000; // 1 hour

async function runHealthCheck(sendResult=true){
    const results={s1:false,s2:false,s3:false};
    const d=load();
    // Pick a test number — use first monitored or bot's own number
    const testNum=d.monitored[0]||WA_NUM;
    if(!testNum){
        if(sendResult) tgSend('❌ No number to test — add a number first');
        return results;
    }
    const testJid=testNum+'@s.whatsapp.net';

    // ── S1: Try sendPresenceUpdate ──
    if(sock&&conn1){
        try{
            await sock.sendPresenceUpdate('available');
            await sock.presenceSubscribe(testJid);
            results.s1=true;
        }catch{results.s1=false;}
    }

    // ── S2: Send ping via IPC, wait for pong ──
    if(verifier&&s2Connected){
        try{
            const s2ok=await new Promise(resolve=>{
                const key='health_s2_'+Date.now();
                s2Callbacks[key]=()=>resolve(true);
                verifier.send({type:'health_ping',key});
                setTimeout(()=>{if(s2Callbacks[key]){delete s2Callbacks[key];resolve(false);}},5000);
            });
            results.s2=s2ok;
        }catch{results.s2=false;}
    }

    // ── S3: Send ping via IPC, wait for pong ──
    if(verifier3&&s3Connected){
        try{
            const s3ok=await new Promise(resolve=>{
                const key='health_s3_'+Date.now();
                s3Callbacks[key]=()=>resolve(true);
                verifier3.send({type:'health_ping',key});
                setTimeout(()=>{if(s3Callbacks[key]){delete s3Callbacks[key];resolve(false);}},5000);
            });
            results.s3=s3ok;
        }catch{results.s3=false;}
    }

    const total=(results.s1?1:0)+(results.s2?1:0)+(results.s3?1:0);
    const overall=total===3?'🟢 ALL HEALTHY':total>=2?'🟡 PARTIAL':total>=1?'🟠 DEGRADED':'🔴 ALL DOWN';

    if(sendResult){
        tgSend(
            `🏥 *Health Check*\n${'━'.repeat(28)}\n\n`+
            `S1 (Chrome):  ${results.s1?'✅ Live':'❌ Down'}\n`+
            `S2 (Edge):    ${results.s2?'✅ Live':'❌ Down'}\n`+
            `S3 (Firefox): ${results.s3?'✅ Live':'❌ Down'}\n\n`+
            `*${overall}* (${total}/3)\n`+
            `🕐 ${fmtTime(Date.now())}\n\n`+
            `_Auto-check: every 1 hour_`
        );
    }

    // Alert only if something is down
    if(total<3&&!sendResult){
        const down=[];
        if(!results.s1) down.push('S1');
        if(!results.s2) down.push('S2');
        if(!results.s3) down.push('S3');
        tgSend(
            `⚠️ *Health Alert*\n${'━'.repeat(28)}\n\n`+
            `${down.join(', ')} DOWN!\n\n`+
            `S1: ${results.s1?'✅':'❌'}  S2: ${results.s2?'✅':'❌'}  S3: ${results.s3?'✅':'❌'}\n\n`+
            `🕐 ${fmtTime(Date.now())}\n`+
            `_Use /pair, /pair2, /pair3 to reconnect_`
        );
    }

    return results;
}

// Start auto health check
function startHealthCheck(){
    if(healthInterval) clearInterval(healthInterval);
    healthInterval=setInterval(()=>runHealthCheck(false).catch(()=>{}),AUTO_HEALTH_MS);
    L.inf('Health check: every 1 hour');
}

tg.onText(/\/health/,async(msg)=>{
    if(msg.from.id!==OWNER_ID) return;
    tgSend('🏥 Running health check...');
    await runHealthCheck(true);
});

// ── /restart — Soft restart all 3 sessions (keeps bot+Telegram alive) ───
let isRestarting=false;
tg.onText(/\/restart$/,async(msg)=>{
    if(msg.from.id!==OWNER_ID) return;
    if(isRestarting) return tgSend('⏳ Restart already in progress...');
    isRestarting=true;

    const startMsg=await tg.sendMessage(msg.chat.id,
        `🔄 *Restarting Triple Engine*\n${'━'.repeat(28)}\n\n⏳ Stopping S1, S2, S3...`,
        {parse_mode:'Markdown'}
    ).catch(()=>null);

    // 1. Save state to disk
    try{saveMemory();}catch{}

    // 2. Stop all timers (keepalive, resub, verify, health, DP/bio monitor)
    stopTimers();

    // 3. Close Session 1 cleanly
    if(sock){try{sock.end();}catch{}}
    sock=null;conn1=false;isPairing1=false;isReconnecting1=false;

    // 4. Kill Session 2 (remove listeners → prevents auto-restart-in-5s)
    if(verifier){try{verifier.removeAllListeners();verifier.kill();}catch{}}
    verifier=null;s2Connected=false;

    // 5. Kill Session 3 (manual flag prevents auto-restart from exit handler)
    s3ManualKill=true;
    if(verifier3){try{verifier3.removeAllListeners();verifier3.kill();}catch{}}
    verifier3=null;s3Connected=false;

    // 6. Clear transient per-session state (rebuilt on reconnect)
    for(const k of Object.keys(s1State)) delete s1State[k];
    for(const k of Object.keys(s2State)) delete s2State[k];
    for(const k of Object.keys(s3State)) delete s3State[k];

    // 7. Wait for child processes to fully exit
    await new Promise(r=>setTimeout(r,3000));

    if(startMsg) tg.editMessageText(
        `🔄 *Restarting Triple Engine*\n${'━'.repeat(28)}\n\n✅ Stopped cleanly\n⏳ Reconnecting all sessions...`,
        {chat_id:msg.chat.id,message_id:startMsg.message_id,parse_mode:'Markdown'}
    ).catch(()=>{});

    // 8. Restart all three
    s3ManualKill=false;
    startVerifier();
    startVerifier3();
    if(fs.existsSync(AUTH_1)) connectS1();
    else L.inf('No S1 auth — skip reconnect');

    // 9. Final status after sessions stabilize
    setTimeout(()=>{
        isRestarting=false;
        const s1i=conn1?'🟢':'🔴',s2i=s2Connected?'🟢':'🔴',s3i=s3Connected?'🟢':'🔴';
        const total=(conn1?1:0)+(s2Connected?1:0)+(s3Connected?1:0);
        const verdict=total===3?'✅ ALL ONLINE':total>=2?'🟡 PARTIAL':total>=1?'🟠 DEGRADED':'🔴 ALL DOWN';
        tgSend(
            `🔄 *Restart Complete*\n${'━'.repeat(28)}\n\n`+
            `S1 (Chrome):  ${s1i}\nS2 (Edge):    ${s2i}\nS3 (Firefox): ${s3i}\n\n`+
            `*${verdict}* (${total}/3)\n\n`+
            `_Use /pair, /pair2, /pair3 if any are 🔴_`
        );
    },10000);
});

// ── /add ──
tg.onText(/\/add (.+)/,async(msg,match)=>{
    if(msg.from.id!==OWNER_ID) return;
    const num=clean(match[1]);
    if(!/^\d{10,15}$/.test(num)) return tgSend('❌ Invalid');
    const d=load();
    if(d.monitored.length>=MAX_NUMS) return tgSend(`❌ Max ${MAX_NUMS}`);
    if(d.monitored.includes(num)) return tgSend('⚠️ Already added');
    d.monitored.push(num);save(d);
    // Subscribe on all 3 sessions
    if(sock&&conn1){try{await subNum(num);}catch(e){L.err(`Sub ${num}: ${e.message}`);}}
    if(verifier&&s2Connected) verifier.send({type:'subscribe',number:num,lid:phoneLid[num]||null});
    if(verifier3&&s3Connected) verifier3.send({type:'subscribe',number:num,lid:phoneLid[num]||null});
    const nc=nonContactFlag[num]?' 👻 Non-contact':'';
    // Check business status
    let bizStr='';
    if(sock&&conn1){
        try{
            const biz=await sock.getBusinessProfile(toJid(num)).catch(()=>null);
            if(biz&&(biz.description||biz.category||biz.wid)){
                businessInfo[num]={isBusiness:true,name:biz.business_name||biz.vname||'',category:biz.category||'',description:biz.description||''};
                bizStr=`\n💼 *WhatsApp Business* — ${biz.category||biz.business_name||'Business'}`;
            } else {
                businessInfo[num]={isBusiness:false};
            }
        }catch{}
    }
    tgSend(`✅ \`${num}\` added *(${d.monitored.length}/${MAX_NUMS})*${nc}${bizStr}\nTip: \`/label ${num} Name\``);
});

// ── /remove ──
tg.onText(/\/remove (.+)/,(msg,match)=>{
    if(msg.from.id!==OWNER_ID) return;
    const num=clean(match[1]),d=load(),i=d.monitored.indexOf(num);
    if(i===-1) return tgSend('❌ Not found');
    d.monitored.splice(i,1);save(d);
    delete online[num];delete onlineSince[num];delete onlineMsgId[num];delete onlineMsgId[num];delete s1State[num];delete s2State[num];delete deviceOf[num];if(pendingOnline[num]){clearTimeout(pendingOnline[num]);delete pendingOnline[num];}
    tgSend(`🗑 \`${num}\` removed`);
});

// ── /label ──
tg.onText(/\/label (.+)/,(msg,match)=>{
    if(msg.from.id!==OWNER_ID) return;
    const p=match[1].trim().split(' '),num=clean(p[0]),name=p.slice(1).join(' ');
    if(!num||!name) return;
    const d=load();d.labels=d.labels||{};d.labels[num]=name;save(d);
    tgSend(`🏷 \`${num}\` → *${name}*`);
});

// ── /history — full brain dump ──
tg.onText(/\/history (.+)/,(msg,match)=>{
    if(msg.from.id!==OWNER_ID) return;
    const num=clean(match[1]),d=load(),lbl=d.labels?.[num]?` (${d.labels[num]})`:'';
    let t=`🧠 *Brain — ${num}*${lbl}\n${'━'.repeat(28)}\n\n`;
    const curBio=d.bioDB?.[num]||savedBio[num];
    if(curBio) t+=`📝 *Bio:* _"${curBio}"_\n\n`;
    const bh=(d.bioHistory||{})[num]||[];
    t+=`📝 *Bio Log (${bh.length}):*\n`;
    if(bh.length){
        for(const e of bh.slice(-5)){
            const icon=e.type==='cleared'?'🗑':e.type==='set'?'✏️':'📝';
            t+=`${icon} ${fmtTime(e.ts)} — *${e.type}*\n`;
            if(e.diff)for(const dd of e.diff){
                if(dd.t==='changed') t+=`  🔄 _"${(dd.f||'').substring(0,25)}"_ → *"${(dd.to||'').substring(0,25)}"*\n`;
                else if(dd.t==='added') t+=`  ➕ *"${(dd.x||'').substring(0,25)}"*\n`;
                else if(dd.t==='removed') t+=`  ➖ _"${(dd.x||'').substring(0,25)}"_\n`;
            }
        }
    } else t+=`  _None_\n`;
    const dh=(d.dpHistory||{})[num]||[];
    t+=`\n🖼 *DP Log (${dh.length}):*\n`;
    if(dh.length){
        for(const e of dh.slice(-5)){
            const icon=e.type==='removed'?'❌':e.type==='restored'?'🔄':'🖼';
            t+=`${icon} ${fmtTime(e.ts)} — *${e.type}*\n`;
        }
    } else t+=`  _None_\n`;
    t+=`\n📄 Full report: \`/report ${num}\``;
    tg.sendMessage(msg.chat.id,t,{parse_mode:'Markdown'}).catch(()=>{});
});

// ── /bio — current + last 5 ──
tg.onText(/\/bio (.+)/,async(msg,match)=>{
    if(msg.from.id!==OWNER_ID) return;
    const num=clean(match[1]),d=load(),lbl=d.labels?.[num]?` (${d.labels[num]})`:'';
    let bio=d.bioDB?.[num]||savedBio[num];
    try{if(sock&&conn1){const live=await fetchBio(num);if(live!==null)bio=live;}}catch{}
    let t=`📝 *Bio — ${num}*${lbl}\n${'━'.repeat(28)}\n\n`;
    t+=bio?`*Current:* _"${bio}"_\n\n`:`_No bio_\n\n`;
    const bh=(d.bioHistory||{})[num]||[];
    if(bh.length){
        t+=`*Last ${Math.min(5,bh.length)} changes:*\n`;
        for(const e of bh.slice(-5)){
            t+=`🕐 ${fmtTime(e.ts)} — ${e.type}\n`;
            if(e.to) t+=`  _"${e.to.substring(0,40)}"_\n`;
        }
    }
    tg.sendMessage(msg.chat.id,t,{parse_mode:'Markdown'}).catch(()=>{});
});

// ── /report — generate full report file & send as document ──
tg.onText(/\/report (.+)/,async(msg,match)=>{
    if(msg.from.id!==OWNER_ID) return;
    const num=clean(match[1]);
    tgSend(`⏳ Generating report for \`${num}\`...`);
    try{
        const filePath=await generateReport(num);
        if(fs.existsSync(filePath)){
            await tg.sendDocument(msg.chat.id,filePath,{caption:`📄 Intelligence Report — ${num}`});
            try{fs.unlinkSync(filePath);}catch{} // Cleanup
        } else tgSend('❌ Report generation failed');
    }catch(e){tgSend(`❌ Error: ${e.message}`);}
});

// ── /whois — Full number analysis ────────────────────────────────────────
tg.onText(/\/whois (.+)/,async(msg,match)=>{
    if(msg.from.id!==OWNER_ID) return;
    const num=clean(match[1]);
    if(!/^\d{10,15}$/.test(num)) return tgSend('❌ Invalid number');
    tgSend(`🔍 Analyzing \`${num}\`...`);

    const d=load(),lbl=d.labels?.[num]?` (${d.labels[num]})`:'';
    let t=`🔍 *WHOIS — ${num}*${lbl}\n${'━'.repeat(28)}\n\n`;

    // 1. WhatsApp registered?
    let exists=false,lid='';
    if(sock&&conn1){
        try{
            const res=await sock.onWhatsApp(num).catch(()=>null);
            const r=Array.isArray(res)?res[0]:res;
            if(r?.exists){exists=true;if(r.lid)lid=r.lid.replace(/@.*/,'');}
        }catch{}
    }
    t+=`📱 *WhatsApp:* ${exists?'✅ Registered':'❌ Not found'}\n`;
    if(lid) t+=`🆔 *LID:* \`${lid.substring(0,10)}...\`\n`;

    // 2. Business or Personal
    if(sock&&conn1){
        try{
            const biz=await sock.getBusinessProfile(toJid(num)).catch(()=>null);
            if(biz&&(biz.description||biz.category||biz.wid)){
                businessInfo[num]={isBusiness:true,
                    name:biz.business_name||biz.vname||'',
                    category:biz.category||'',
                    description:biz.description||'',
                    website:biz.website?.[0]||'',
                    email:biz.email||'',
                    address:biz.address||''};
                t+=`💼 *Type:* WhatsApp Business ✅\n`;
                if(biz.business_name||biz.vname) t+=`🏢 *Name:* ${biz.business_name||biz.vname}\n`;
                if(biz.category) t+=`📂 *Category:* ${biz.category}\n`;
                if(biz.description) t+=`📝 *About:* _"${biz.description.substring(0,60)}"_\n`;
                if(biz.website?.[0]) t+=`🌐 *Website:* ${biz.website[0]}\n`;
                if(biz.email) t+=`📧 *Email:* ${biz.email}\n`;
                if(biz.address) t+=`📍 *Address:* ${biz.address.substring(0,50)}\n`;
            } else {
                businessInfo[num]={isBusiness:false};
                t+=`💼 *Type:* Personal WhatsApp\n`;
            }
        }catch{
            t+=`💼 *Type:* ${businessInfo[num]?.isBusiness?'WhatsApp Business':'Unknown'}\n`;
        }
    }

    // 3. Device
    t+=`\n📱 *Device:* ${deviceOf[num]?devIcon(num):'Unknown'}\n`;

    // 4. Online status + Last seen
    t+=`🟢 *Status:* ${online[num]?'ONLINE':'Offline'}\n`;
    if(online[num]&&onlineSince[num]){
        t+=`⏱ *Online since:* ${fmtTime(onlineSince[num])} (${fmtDur(Date.now()-onlineSince[num])})\n`;
    }
    if(!online[num]&&lastSeenAt[num]){
        t+=`🕐 *Last seen:* ${fmtTime(lastSeenAt[num])} (${fmtDur(Date.now()-lastSeenAt[num])} ago)\n`;
    }

    // 5. Today's session time
    const todayMs=getTodayOnline(num);
    t+=`📊 *Today online:* ${todayMs>0?fmtDur(todayMs):'0s'}\n`;

    // 6. DP
    if(sock&&conn1){
        try{
            const dpUrl=await sock.profilePictureUrl(toJid(num),'image').catch(()=>null);
            t+=`🖼 *DP:* ${dpUrl?'✅ Has DP':'❌ No DP / hidden'}\n`;
        }catch{}
    }

    // 7. Bio (live + history)
    let bioText=null;
    if(sock&&conn1){
        try{
            const bio=await sock.fetchStatus(toJid(num)).catch(()=>null);
            bioText=bio?.status||(Array.isArray(bio)&&bio[0]?.status)||null;
        }catch{}
    }
    const savedBioText=d.bioDB?.[num]||null;
    const displayBio=bioText||savedBioText;
    t+=`📝 *Bio:* ${displayBio?`_"${displayBio.substring(0,60)}"_`:'Hidden / empty'}\n`;

    // Bio change history
    const bh=(d.bioHistory||{})[num]||[];
    if(bh.length>0){
        t+=`📜 *Bio history (last ${Math.min(bh.length,3)}):*\n`;
        for(const entry of bh.slice(-3)){
            t+=`  ${fmtTime(entry.ts)} → _"${(entry.to||'').substring(0,30)}"_\n`;
        }
    }

    // 8. Device pattern
    const pattern=getDevicePattern(num);
    if(pattern!=='No data') t+=`\n📱 *Device pattern:*\n${pattern}\n`;

    // 9. Multi-device
    if(multiDevice[num]&&multiDevice[num].lastAlert>0)
        t+=`\n⚠️ *Multi-device:* Last ${fmtTime(multiDevice[num].lastAlert)}\n`;

    // 10. Contact type + last event
    t+=`\n👻 ${nonContactFlag[num]?'Non-contact':'Contact'}\n`;
    t+=`🕐 *Last activity:* ${lastEvent[num]?fmtDur(Date.now()-lastEvent[num])+' ago':'Never'}\n`;

    tg.sendMessage(msg.chat.id,t,{parse_mode:'Markdown'}).catch(()=>{});
});

// ── /online — Real-time list of currently online monitored numbers ────────
tg.onText(/\/online$/,async(msg)=>{
    if(msg.from.id!==OWNER_ID) return;
    const d=load();
    if(!d.monitored.length) return tgSend('📭 No monitored numbers');

    const onlineNums=d.monitored.filter(n=>online[n]);
    if(!onlineNums.length) return tgSend('⚫ Nobody online right now');

    let t=`🟢 *CURRENTLY ONLINE*\n${'━'.repeat(28)}\n\n`;
    for(const num of onlineNums){
        const lbl=d.labels?.[num]?` _(${d.labels[num]})_`:'';
        const dev=deviceOf[num]?(deviceOf[num]==='iOS'?'🍎':deviceOf[num]==='Android'?'🤖':'💻'):'📱';
        const dur=onlineSince[num]?fmtDur(Date.now()-onlineSince[num]):'?';
        const nc=nonContactFlag[num]?'👻':'';
        const biz=businessInfo[num]?.isBusiness?'💼':'';
        t+=`🟢 ${dev} \`${num}\`${lbl} ${nc}${biz}\n  ⏱ ${dur}\n\n`;
    }
    t+=`*Total:* ${onlineNums.length}/${d.monitored.length}\n`;
    t+=`🕐 _${new Date().toLocaleTimeString('en-IN',{hour12:false,hour:'2-digit',minute:'2-digit'})}_`;
    tg.sendMessage(msg.chat.id,t,{parse_mode:'Markdown'}).catch(()=>{});
});

// ── /banned — Triple-session multi-signal ban verification ──────────────
// Extract Baileys error type (item-not-found / not-authorized / forbidden / etc.)
function _errCode(e){
    if(!e) return '';
    const raw=e.data?.attrs?.error||e.data?.attrs?.type||e.output?.payload?.message||e.message||String(e);
    const s=String(raw).toLowerCase();
    if(s.includes('item-not-found')||s.includes('not found')||s.includes('404')) return 'not-found';
    if(s.includes('not-authorized')||s.includes('forbidden')||s.includes('401')||s.includes('403')) return 'forbidden';
    if(s.includes('rate-overlimit')||s.includes('429')) return 'rate-limit';
    if(s.includes('timeout')||s.includes('timed out')) return 'timeout';
    return s.substring(0,40);
}

// S1 WA check with retry on rate-limit / timeout
async function s1CheckWA(num,retries=1){
    for(let attempt=0;attempt<=retries;attempt++){
        try{
            const res=await sock.onWhatsApp(num);
            if(Array.isArray(res)&&res.length===0) return {exists:false,lid:''};
            const r=Array.isArray(res)?res[0]:res;
            if(r&&typeof r.exists==='boolean'){
                return {exists:r.exists,lid:r.lid?String(r.lid).replace(/@.*/,''):''};
            }
            return {exists:false,lid:''};
        }catch(e){
            const code=_errCode(e);
            if((code==='rate-limit'||code==='timeout')&&attempt<retries){
                await new Promise(r=>setTimeout(r,2000));
                continue;
            }
            return {exists:'error',err:code,lid:''};
        }
    }
}

tg.onText(/\/banned (.+)/,async(msg,match)=>{
    if(msg.from.id!==OWNER_ID) return;
    const num=clean(match[1]);
    if(!/^\d{10,15}$/.test(num)) return tgSend('❌ Invalid number');
    if(!sock||!conn1) return tgSend('❌ Session 1 offline — `/pair` first');

    const d=load(),lbl=d.labels?.[num]?` (${d.labels[num]})`:'';
    const sessActive=(conn1?1:0)+(s2Connected?1:0)+(s3Connected?1:0);
    const wait=await tg.sendMessage(msg.chat.id,
        `🔍 *Deep Verification* — \`${num}\`${lbl}\n${'━'.repeat(28)}\n\n⏳ Querying ${sessActive} session${sessActive===1?'':'s'} in parallel...`,
        {parse_mode:'Markdown'}
    ).catch(()=>null);

    // ═══ PARALLEL: Triple-session WA check + DP + Status + Business + Blocklist ═══
    const jid=toJid(num);
    const [s1WA,s2WA,s3WA,dpRes,statusRes,bizRes,blockRes]=await Promise.all([
        s1CheckWA(num,1),
        s2CheckWA(num),
        s3CheckWA(num),
        sock.profilePictureUrl(jid,'image').then(v=>({ok:!!v,url:v})).catch(e=>({ok:'error',err:_errCode(e)})),
        sock.fetchStatus(jid).then(v=>{
            const r=Array.isArray(v)?v[0]:v;
            return {ok:!!(r&&(r.status!==undefined||r.setAt!==undefined)),bio:r?.status||null,setAt:r?.setAt||null};
        }).catch(e=>({ok:'error',err:_errCode(e)})),
        sock.getBusinessProfile(jid).then(v=>({ok:!!(v&&(v.description||v.category||v.wid||v.business_name)),name:v?.business_name||v?.vname||'',cat:v?.category||''})).catch(e=>({ok:'error',err:_errCode(e)})),
        sock.fetchBlocklist().then(list=>({list:list||[]})).catch(()=>({list:null})),
    ]);

    // ═══ Build per-session signal table ═══
    const sessions=[
        {name:'S1 (Chrome)', up:conn1,           wa:s1WA?.exists??null,           lid:s1WA?.lid||'', err:s1WA?.err||''},
        {name:'S2 (Edge)',   up:s2Connected,     wa:s2WA?.exists??null,           lid:s2WA?.lid||'', err:s2WA?.err||''},
        {name:'S3 (Firefox)',up:s3Connected,     wa:s3WA?.exists??null,           lid:s3WA?.lid||'', err:s3WA?.err||''},
    ];

    // Count session votes
    let votesTrue=0,votesFalse=0,votesError=0,sessionsAsked=0;
    for(const s of sessions){
        if(!s.up||s.wa===null) continue;
        sessionsAsked++;
        if(s.wa===true) votesTrue++;
        else if(s.wa===false) votesFalse++;
        else if(s.wa==='error') votesError++;
    }

    // ═══ Local evidence ═══
    const hadHistory=!!(
        d.bioDB?.[num] || d.bioHistory?.[num]?.length || d.dpHistory?.[num]?.length ||
        lastSeenAt[num] || phoneLid[num] || deviceLog[num]?.length ||
        sessionLog[num]?.sessions?.length || onlineSince[num]
    );
    const liveNow=!!(online[num]||s1State[num]?.status==='available'||s2State[num]?.status==='available'||s3State[num]?.status==='available');
    const blockedByMe=Array.isArray(blockRes.list)&&blockRes.list.some(x=>String(x).startsWith(num));
    // Forbidden errors across DP+status often mean: user blocked us
    const blockedByThem=(dpRes.ok==='error'&&dpRes.err==='forbidden')&&(statusRes.ok==='error'&&statusRes.err==='forbidden');

    // ═══ VERDICT — multi-session voting + signal weighting ═══
    let status,icon,confidence,confScore,explain;

    if(liveNow){
        status='ACTIVE'; icon='🟢'; confidence='Certain'; confScore=100;
        explain='Currently ONLINE on WhatsApp right now';
    } else if(votesTrue>=2){
        // 2+ sessions agree: registered
        if(blockedByThem){
            status='ACTIVE (BLOCKED YOU)'; icon='🚷'; confidence='Very High'; confScore=92;
            explain=`${votesTrue}/${sessionsAsked} sessions confirm registered. DP+Bio both forbidden — they blocked you`;
        } else if(dpRes.ok===false&&statusRes.ok===false){
            status='ACTIVE'; icon='✅'; confidence='High'; confScore=85;
            explain=`${votesTrue}/${sessionsAsked} sessions confirm registered. Profile is private`;
        } else {
            status='ACTIVE'; icon='✅'; confidence='Very High'; confScore=95;
            explain=`${votesTrue}/${sessionsAsked} sessions confirm registration on WhatsApp`;
        }
    } else if(votesFalse>=2){
        // 2+ sessions agree: not on WhatsApp
        if(hadHistory){
            status='BANNED / DELETED'; icon='🚫'; confidence='Very High'; confScore=95;
            explain=`${votesFalse}/${sessionsAsked} sessions confirm not registered. We have prior tracking data → ban or self-delete`;
        } else if(dpRes.ok===true||statusRes.ok===true||bizRes.ok===true){
            status='CONFLICTING SIGNALS'; icon='🟡'; confidence='Low'; confScore=40;
            explain=`Sessions agree not-registered, but profile data leaked. Possible cache anomaly — retry`;
        } else {
            status='NOT REGISTERED'; icon='⚪'; confidence='Very High'; confScore=92;
            explain=`${votesFalse}/${sessionsAsked} sessions confirm not on WhatsApp. No historical data`;
        }
    } else if(votesTrue===1&&votesFalse===0){
        status='LIKELY ACTIVE'; icon='✅'; confidence='Medium'; confScore=65;
        explain=`Only 1 session confirmed registered (others offline/errored). Probably active`;
    } else if(votesFalse===1&&votesTrue===0){
        if(hadHistory){
            status='LIKELY BANNED'; icon='🚫'; confidence='Medium'; confScore=70;
            explain='1 session says not-registered + we have history → likely banned';
        } else {
            status='LIKELY NOT REGISTERED'; icon='⚪'; confidence='Medium'; confScore=60;
            explain='1 session says not-registered. No history';
        }
    } else if(votesTrue>=1&&votesFalse>=1){
        status='SESSION DISAGREEMENT'; icon='⚠️'; confidence='Low'; confScore=35;
        explain=`Sessions disagree (${votesTrue} say active, ${votesFalse} say not). Possible regional routing or temp issue — retry`;
    } else if(votesError>0&&sessionsAsked>0){
        if(dpRes.ok===true||statusRes.ok===true){
            status='LIKELY ACTIVE'; icon='🟡'; confidence='Low'; confScore=50;
            explain='All sessions errored on registry, but profile data fetched → probably active';
        } else {
            status='UNKNOWN — RETRY'; icon='❓'; confidence='Low'; confScore=20;
            explain=`All ${votesError} sessions errored. WhatsApp may be rate-limiting — retry in 1 min`;
        }
    } else {
        status='UNKNOWN'; icon='❓'; confidence='Low'; confScore=10;
        explain='No usable session data. Try /pair, /pair2, /pair3 first';
    }

    // ═══ Format output ═══
    const ico=(v,err)=>v===true?'✅':v===false?'❌':v==='error'?`⚠️ ${err||'err'}`:'—';
    const bar=Math.round(confScore/10);
    const meter=`[${'█'.repeat(bar)}${'░'.repeat(10-bar)}] ${confScore}%`;

    let t=`🛡 *BAN CHECK — ${num}*${lbl}\n${'━'.repeat(28)}\n\n`+
        `${icon} *Verdict:* *${status}*\n`+
        `🎯 *Confidence:* ${confidence}\n`+
        `${meter}\n`+
        `💬 _${explain}_\n\n`+
        `*🛰 Multi-Session Registry Vote:*\n`;
    for(const s of sessions){
        if(!s.up) t+=`• ${s.name}:  🔴 _offline_\n`;
        else if(s.wa===null) t+=`• ${s.name}:  — _no response_\n`;
        else if(s.wa===true) t+=`• ${s.name}:  ✅ registered\n`;
        else if(s.wa===false) t+=`• ${s.name}:  ❌ not on WhatsApp\n`;
        else if(s.wa==='error') t+=`• ${s.name}:  ⚠️ ${s.err||'error'}\n`;
    }
    t+=`📊 *Vote:* ${votesTrue}✅ / ${votesFalse}❌ / ${votesError}⚠️  (asked ${sessionsAsked})\n\n`;

    t+=`*🔬 Profile Probes (S1):*\n`+
        `• Profile Picture: ${ico(dpRes.ok,dpRes.err)}\n`+
        `• Bio / Status:    ${ico(statusRes.ok,statusRes.err)}\n`;
    if(statusRes.bio) t+=`  └ _"${String(statusRes.bio).substring(0,50)}"_\n`;
    t+=`• Business:        ${bizRes.ok===true?`💼 yes${bizRes.cat?' · '+bizRes.cat:''}`:bizRes.ok===false?'👤 personal':bizRes.ok==='error'?`⚠️ ${bizRes.err||'err'}`:'—'}\n\n`;

    t+=`*📚 Context:*\n`+
        `• Currently online: ${liveNow?'🟢 YES':'⚫ no'}\n`+
        `• Historical data:  ${hadHistory?'✅ present':'⚪ none'}\n`;
    if(lastSeenAt[num]) t+=`• Last alive:       ${fmtTime(lastSeenAt[num])} (${fmtDur(Date.now()-lastSeenAt[num])} ago)\n`;
    if(blockedByMe) t+=`• 🛑 *YOU blocked them* (in your blocklist)\n`;
    if(blockedByThem) t+=`• 🚷 *They blocked YOU* (DP+Bio forbidden)\n`;
    const winLid=s1WA?.lid||s2WA?.lid||s3WA?.lid;
    if(winLid) t+=`• LID: \`${winLid.substring(0,12)}...\`\n`;

    // Smart recommendation
    t+=`\n*💡 Next:*\n`;
    if(confScore<50) t+=`• Retry \`/banned ${num}\` in 30s — low confidence\n`;
    if(status.includes('BANNED')) t+=`• Check \`/history ${num}\` for last activity\n`;
    if(status.includes('NOT REGISTERED')) t+=`• Verify number format (country code correct?)\n`;
    if(status.includes('DISAGREEMENT')) t+=`• One session may be on a different region/route\n`;
    if(status==='ACTIVE'||status==='LIKELY ACTIVE') t+=`• Add with \`/add ${num}\` to track\n`;

    if(wait){
        tg.editMessageText(t,{chat_id:msg.chat.id,message_id:wait.message_id,parse_mode:'Markdown'}).catch(()=>{
            tg.sendMessage(msg.chat.id,t,{parse_mode:'Markdown'}).catch(()=>{});
        });
    } else tg.sendMessage(msg.chat.id,t,{parse_mode:'Markdown'}).catch(()=>{});
});

// ── /session — Today's online sessions ──────────────────────────────────
tg.onText(/\/session (.+)/,(msg,match)=>{
    if(msg.from.id!==OWNER_ID) return;
    const num=clean(match[1]);
    const d=load(),lbl=d.labels?.[num]?` (${d.labels[num]})`:'';
    const todayMs=getTodayOnline(num);
    const sl=sessionLog[num];

    let t=`⏱ *Session — ${num}*${lbl}\n${'━'.repeat(28)}\n\n`;
    t+=`📊 *Total today:* ${todayMs>0?fmtDur(todayMs):'0s'}\n`;
    t+=`🟢 *Now:* ${online[num]?'ONLINE':'Offline'}\n\n`;

    if(sl&&sl.sessions.length>0){
        t+=`📋 *Sessions (${sl.sessions.length}):*\n`;
        for(const s of sl.sessions.slice(-10)){
            const onTime=fmtTime(s.on);
            const dur=s.off?fmtDur(s.dur):(online[num]?fmtDur(Date.now()-s.on)+' _(live)_':'?');
            t+=`  🕐 ${onTime} → ${dur}\n`;
        }
    } else t+=`_No sessions today_\n`;

    const pattern=getDevicePattern(num);
    if(pattern!=='No data'&&pattern!=='No activity today')
        t+=`\n📱 *Devices:*\n${pattern}\n`;

    tg.sendMessage(msg.chat.id,t,{parse_mode:'Markdown'}).catch(()=>{});
});

// ── /devices — Device history ───────────────────────────────────────────
tg.onText(/\/devices (.+)/,(msg,match)=>{
    if(msg.from.id!==OWNER_ID) return;
    const num=clean(match[1]);
    const d=load(),lbl=d.labels?.[num]?` (${d.labels[num]})`:'';
    const logs=deviceLog[num];

    let t=`📱 *Devices — ${num}*${lbl}\n${'━'.repeat(28)}\n\n`;
    t+=`*Current:* ${deviceOf[num]?devIcon(num):'Unknown'}\n\n`;

    if(logs&&logs.length>0){
        const hours={};
        logs.forEach(e=>{const h=new Date(e.ts).getHours();if(!hours[h])hours[h]={};hours[h][e.device]=(hours[h][e.device]||0)+1;});
        t+=`*Hourly pattern:*\n`;
        for(const[h,devs]of Object.entries(hours).sort((a,b)=>a[0]-b[0])){
            const parts=Object.entries(devs).map(([dd,c])=>`${dd}(${c})`).join(' ');
            t+=`  ${String(h).padStart(2,'0')}:00 → ${parts}\n`;
        }
        if(multiDevice[num]&&multiDevice[num].lastAlert>0)
            t+=`\n⚠️ *Multi-device:* ${fmtTime(multiDevice[num].lastAlert)}\n`;
    } else t+=`_No device data yet_\n`;

    tg.sendMessage(msg.chat.id,t,{parse_mode:'Markdown'}).catch(()=>{});
});

// ── Callbacks ──
tg.on('callback_query',async q=>{
    if(q.from.id!==OWNER_ID) return;
    await tg.answerCallbackQuery(q.id).catch(()=>{});
    const cid=q.message.chat.id,d=load();

    if(q.data==='list'){
        if(!d.monitored.length) return tg.sendMessage(cid,'📭 Empty — /add').catch(()=>{});
        const lines=d.monitored.map((n,i)=>{
            const icon=online[n]?'🟢':'⚫';
            const dev=deviceOf[n]?(deviceOf[n]==='iOS'?'🍎':deviceOf[n]==='Android'?'🤖':'💻'):'📱';
            const lbl=d.labels?.[n]?` _(${d.labels[n]})_`:'';
            const nc=nonContactFlag[n]?'👻':'';
            const biz=businessInfo[n]?.isBusiness?'💼':'';
            const ls=!online[n]&&lastSeenAt[n]?` _(${fmtDur(Date.now()-lastSeenAt[n])} ago)_`:'';
            return `${i+1}. ${icon}${dev} \`${n}\`${lbl} ${nc}${biz}${ls}`;
        }).join('\n');
        tg.sendMessage(cid,`👁 *Monitoring:*\n\n${lines}`,{parse_mode:'Markdown',reply_markup:menuKb(d)}).catch(()=>{});
    }
    if(q.data==='add') tg.sendMessage(cid,'`/add 919876543210`',{parse_mode:'Markdown'}).catch(()=>{});
    if(q.data==='rm') tg.sendMessage(cid,'`/remove 919876543210`',{parse_mode:'Markdown'}).catch(()=>{});
    if(q.data==='status'){
        let t=`📡 *Triple Engine Status*\n${'━'.repeat(28)}\n\nS1: ${conn1?'🟢 Connected':'🔴 Offline'}\nS2: ${s2Connected?'🟢 Connected':'🔴 Offline'}\nS3: ${s3Connected?'🟢 Connected':'🔴 Offline'}\n\n`;
        for(const n of d.monitored){
            const s1=s1State[n]?.status||'—';const s2=s2State[n]?.status||'—';
            const ago=lastEvent[n]?fmtDur(Date.now()-lastEvent[n])+' ago':'never';
            const lbl=d.labels?.[n]?` (${d.labels[n]})`:'';
            const nc=nonContactFlag[n]?'👻':'';
            t+=`${online[n]?'🟢':'⚫'} \`${n}\`${lbl} ${nc}\n  ${devIcon(n)} · S1:${s1} S2:${s2} S3:${s3State[n]?.status||'—'}\n  Last: ${ago}\n\n`;
        }
        tg.sendMessage(cid,t,{parse_mode:'Markdown',reply_markup:menuKb(d)}).catch(()=>{});
    }
    if(q.data==='help'){
        tg.sendMessage(cid,
            `⚙️ *AIZEN PRO MAX 69*\n${'━'.repeat(28)}\n\n`+
            `*📡 Setup:*\n`+
            `\`/pair 91xxx\` — Session 1\n\`/pair2 91xxx\` — Session 2\n\`/pair3 91xxx\` — Session 3\n\n`+
            `*👁 Monitor:*\n`+
            `\`/add 91xxx\` — monitor\n\`/remove 91xxx\` — stop\n`+
            `\`/label 91xxx Name\` — nick\n\n`+
            `*🔍 Analysis:*\n`+
            `\`/online\` — currently online list\n`+
            `\`/whois 91xxx\` — full analysis\n`+
            `\`/banned 91xxx\` — ban/active check\n`+
            `\`/session 91xxx\` — today online time\n`+
            `\`/devices 91xxx\` — device history\n`+
            `\`/spy 91xxx\` — 2min intensive scan\n`+
            `\`/health\` — check all sessions\n`+
            `\`/restart\` — restart all 3 sessions\n\n`+
            `*🧠 Brain:*\n`+
            `\`/history 91xxx\` — DP/Bio log\n`+
            `\`/bio 91xxx\` — current bio\n`+
            `\`/report 91xxx\` — full report file\n\n`+
            `*🔔 Auto Alerts:*\n`+
            `📱 Multi-device detect\n`+
            `🔄 Reinstall/number change\n`+
            `🗑 Message delete detect\n`+
            `🧠 DP + Bio changes\n\n`+
            `[@immortalaizen](https://instagram.com/immortalaizen) _· Aizen Services_`,
            {parse_mode:'Markdown'}
        ).catch(()=>{});
    }
});

// ══════════════════════════════════════════════════════════════════════════════
//  SUBSCRIBE — Non-contact aware
// ══════════════════════════════════════════════════════════════════════════════
async function subNum(num){
    if(!sock||!conn1) return;
    const jid=toJid(num);

    // Step 1: Stay online (required for receiving presence)
    try{await sock.sendPresenceUpdate('available');}catch{}
    await new Promise(r=>setTimeout(r,100));

    // Step 2: Check if number on WhatsApp + get LID
    if(!phoneLid[num]){
        try{
            const res=await sock.onWhatsApp(num).catch(()=>null);
            const r=Array.isArray(res)?res[0]:res;
            if(r?.exists){
                // Number is on WhatsApp
                if(r.lid){
                    const lid=r.lid.replace(/@.*/,'');
                    lidMap[lid]=num;phoneLid[num]=lid;
                    const d=load();d.lidMap=d.lidMap||{};d.lidMap[lid]=num;save(d);
                    L.sub(`LID: ${X.w}${num}${R} ↔ ${lid.substring(0,8)}...`);
                }
            } else {
                L.sub(`${X.w}${num}${R} — not on WhatsApp?`);
            }
        }catch(e){
            L.sub(`onWhatsApp error for ${num}: ${e.message}`);
        }
    }

    // Step 3: Check if contact or non-contact
    // Non-contact flag — if we haven't chatted before, presence may be limited
    // Baileys has no getContacts() — flag as non-contact by default
    // Detection still works if target privacy = "Everyone"
    if(!nonContactFlag[num]) nonContactFlag[num]=true;

    // Step 4: Subscribe phone JID (works for Android + some iOS)
    try{await sock.presenceSubscribe(jid);}catch{}

    // Step 5: Subscribe LID JID (works for iOS specifically)
    if(phoneLid[num]){
        try{await sock.presenceSubscribe(`${phoneLid[num]}@lid`);}catch{}
    }

    // Step 6: Poke — tell WA we want presence for this contact
    try{await sock.sendPresenceUpdate('available',jid);}catch{}

    const nc=nonContactFlag[num]?' 👻':'';
    L.sub(`✓ ${X.w}${num}${R}${phoneLid[num]?' [+LID]':''}${nc}`);
}

async function subAll(){
    if(!sock||!conn1) return;
    const d=load();
    L.sub(`Subscribing ${d.monitored.length} numbers...`);
    for(const n of d.monitored){
        try{await subNum(n);}catch(e){L.err(`Sub ${n}: ${e.message}`);}
        await new Promise(r=>setTimeout(r,300));
    }
    // Also subscribe on Session 2
    if(verifier&&s2Connected){
        const nums=d.monitored.map(n=>({num:n,lid:phoneLid[n]||null}));
        verifier.send({type:'subscribe_all',numbers:nums});
    }
    L.ok(`Subscribed all (${d.monitored.length})`);
}


// ══════════════════════════════════════════════════════════════════════════════
//  BRAIN — Smart DP & Bio Monitor (3x retry, CDN filter, type detection)
// ══════════════════════════════════════════════════════════════════════════════
const savedDP={};
const savedBio={};
let dpBioTimerId=null;
const DP_BIO_INTERVAL=20*60*1000; // 20 min brain cycle

async function dpHash(url){
    if(!url) return 'none';
    try{
        const mod=url.startsWith('https')?require('https'):require('http');
        return new Promise(res=>{
            const req=mod.get(url,{timeout:10000},resp=>{
                if(resp.statusCode!==200){res('err');return;}
                let len=0,sample='';
                resp.on('data',ch=>{len+=ch.length;if(sample.length<200)sample+=ch.toString('hex').substring(0,50);});
                resp.on('end',()=>res(`${len}_${sample.substring(0,40)}`));
                resp.on('error',()=>res('err'));
            });
            req.on('error',()=>res('err'));
            req.setTimeout(10000,()=>{req.destroy();res('err');});
        });
    }catch{return 'err';}
}

async function fetchBio(num){
    if(!sock||!conn1) return null;
    try{
        const r=await sock.fetchStatus(toJid(num)).catch(()=>null);
        if(r?.status) return r.status;
        if(Array.isArray(r)&&r[0]?.status) return r[0].status;
        return null;
    }catch{return null;}
}

// 3x Retry — returns value only if 3/3 agree (CDN rotation filter)
async function retryCheck(fn,delayMs=5000){
    try{
        const results=[];
        for(let i=0;i<3;i++){
            const val=await fn().catch(()=>null);
            results.push(val);
            L.sub(`  🧠 Check ${i+1}/3: ${val?String(val).substring(0,20)+'...':'null'}`);
            if(i<2) await new Promise(r=>setTimeout(r,delayMs));
        }
        if(results[0]===results[1]&&results[1]===results[2]) return{ok:true,val:results[0]};
        L.sub(`  🧠 Mixed results — skip (false alarm)`);
        return{ok:false};
    }catch{return{ok:false};}
}

async function dpBioSnapshot(){
    if(!sock||!conn1) return;
    const d=load();
    L.inf('🧠 Brain snapshot...');
    for(const num of d.monitored){
        try{
            const url=await sock.profilePictureUrl(toJid(num),'image').catch(()=>null);
            if(!savedDP[num]) savedDP[num]=await dpHash(url);
            if(!savedBio[num]){
                const disk=(d.bioDB||{})[num];
                if(disk) savedBio[num]=disk;
                else{const bio=await fetchBio(num);if(bio){savedBio[num]=bio;d.bioDB=d.bioDB||{};d.bioDB[num]=bio;save(d);}else savedBio[num]='';}
            }
            // Load saved business info from disk
            if(!businessInfo[num]){
                const diskBiz=(d.businessDB||{})[num];
                if(diskBiz) businessInfo[num]=diskBiz;
                else{
                    // First time — fetch business status
                    try{
                        const biz=await sock.getBusinessProfile(toJid(num)).catch(()=>null);
                        if(biz&&(biz.description||biz.category||biz.wid||biz.business_name||biz.vname)){
                            businessInfo[num]={isBusiness:true,name:biz.business_name||biz.vname||'',
                                category:biz.category||'',description:biz.description||'',
                                website:biz.website?.[0]||'',email:biz.email||'',address:biz.address||'',ts:Date.now()};
                        } else {
                            businessInfo[num]={isBusiness:false};
                        }
                        d.businessDB=d.businessDB||{};d.businessDB[num]=businessInfo[num];save(d);
                    }catch{}
                }
            }
            await new Promise(r=>setTimeout(r,1500));
        }catch(e){L.err(`Snapshot ${num}: ${e.message}`);}
    }
    L.ok(`🧠 Snapshot done (${d.monitored.length})`);
}

async function dpBioCheck(){
    if(!sock||!conn1) return;
    const d=load();
    for(const num of d.monitored){
      try{
        // ═══ DP — S1 checks 3x (10s gap) → S2 verifies → DUAL ═══
        L.sub(`🧠 DP check: ${X.w}${num}${R}`);
        const oldHash=savedDP[num]||'none';
        const r=await retryCheck(async()=>{
            const url=await sock.profilePictureUrl(toJid(num),'image').catch(()=>null);
            return await dpHash(url);
        },5000); // 5s between checks

        if(r.ok&&r.val!=='err'){
            const nw=r.val;
            if(oldHash!=='none'&&nw!==oldHash){
                // S1 says changed — ask S2 to verify
                let s2Agrees=false;
                const s2r=await s2CheckDP(num);
                if(s2r){
                    // S2 also checked — compare
                    const s2HasDP=s2r.has;
                    if(nw==='none'&&!s2HasDP) s2Agrees=true; // Both say removed
                    else if(nw!=='none'&&s2HasDP) s2Agrees=true; // Both say exists
                    else s2Agrees=false;
                }

                let type='changed';
                if(nw==='none') type='removed';
                else if(oldHash==='none') type='restored';
                savedDP[num]=nw;
                d.dpHistory=d.dpHistory||{};d.dpHistory[num]=d.dpHistory[num]||[];
                const src=s2Agrees?'DUAL ✓✓':'S1 (3/3)';
                d.dpHistory[num].push({ts:Date.now(),type,hash:nw.substring(0,16),prev:oldHash.substring(0,16),src});
                if(d.dpHistory[num].length>100) d.dpHistory[num]=d.dpHistory[num].slice(-100);
                save(d);
                const cnt=d.dpHistory[num].length,lbl=d.labels?.[num]?` (${d.labels[num]})`:'';
                const icon=type==='removed'?'❌':type==='restored'?'🔄':'🖼';
                const txt=type==='removed'?'DP Removed':type==='restored'?'DP Restored':'DP Changed';
                L.dev(`${X.w}${num}${R} ${txt} #${cnt} [${src}]`);
                tgSend(`${icon} *${txt}!*\n${'─'.repeat(24)}\n👤 \`${num}\`${lbl}\n🕐 ${fmtTime(Date.now())}\n📊 #${cnt}\n🔒 *${src}*`);
                s1State[num]={status:'available',ts:Date.now()};merge(num);
            } else if(nw!=='err') savedDP[num]=nw;
        }

        await new Promise(r=>setTimeout(r,2000));

        // ═══ BIO — S1 checks 3x (10s gap) → S2 verifies → DUAL ═══
        L.sub(`🧠 Bio check: ${X.w}${num}${R}`);
        const oldBio=savedBio[num]||'';
        const rb=await retryCheck(()=>fetchBio(num),5000); // 5s between checks

        if(rb.ok&&rb.val!==null){
            const nw=rb.val;
            if(oldBio!==''&&nw!==oldBio){
                // S1 says changed — ask S2 to verify
                let s2Agrees=false;
                const s2r=await s2CheckBio(num);
                if(s2r?.bio!==null&&s2r?.bio!==undefined){
                    s2Agrees=(s2r.bio===nw); // S2 got same new bio
                }

                let type='changed';
                if((!nw||nw==='')&&oldBio) type='cleared';
                else if((!oldBio||oldBio==='')&&nw) type='set';
                const oldL=(oldBio||'').split('\n'),newL=(nw||'').split('\n'),diff=[];
                for(let i=0;i<Math.max(oldL.length,newL.length);i++){
                    const o=oldL[i]||'',n=newL[i]||'';
                    if(o!==n){
                        if(o&&n) diff.push({t:'changed',f:o,to:n});
                        else if(!o&&n) diff.push({t:'added',x:n});
                        else if(o&&!n) diff.push({t:'removed',x:o});
                    }
                }
                savedBio[num]=nw;d.bioDB=d.bioDB||{};d.bioDB[num]=nw;
                d.bioHistory=d.bioHistory||{};d.bioHistory[num]=d.bioHistory[num]||[];
                const src=s2Agrees?'DUAL ✓✓':'S1 (3/3)';
                d.bioHistory[num].push({ts:Date.now(),type,from:oldBio,to:nw,diff,src});
                if(d.bioHistory[num].length>100) d.bioHistory[num]=d.bioHistory[num].slice(-100);
                save(d);
                const cnt=d.bioHistory[num].length,lbl=d.labels?.[num]?` (${d.labels[num]})`:'';
                const icon=type==='cleared'?'🗑':type==='set'?'✏️':'📝';
                const txt=type==='cleared'?'Bio Cleared':type==='set'?'Bio Set':'Bio Changed';
                let dt='';
                for(const dd of diff){
                    if(dd.t==='changed') dt+=`🔄 _"${dd.f.substring(0,30)}"_ → *"${dd.to.substring(0,30)}"*\n`;
                    else if(dd.t==='added') dt+=`➕ *"${dd.x.substring(0,30)}"*\n`;
                    else if(dd.t==='removed') dt+=`➖ _"${dd.x.substring(0,30)}"_\n`;
                }
                if(!dt) dt='_Changed_';
                L.dev(`${X.w}${num}${R} ${txt} #${cnt} [${src}]`);
                tgSend(`${icon} *${txt}!*\n${'─'.repeat(24)}\n👤 \`${num}\`${lbl}\n🕐 ${fmtTime(Date.now())}\n📊 #${cnt}\n\n${dt}\n🔒 *${src}*`);
                s1State[num]={status:'available',ts:Date.now()};merge(num);
            } else if(nw!==null) savedBio[num]=nw;
        }

        await new Promise(r=>setTimeout(r,2000));

        // ═══ BUSINESS — TRIPLE VERIFY (S1+S2+S3, 2/3 consensus) ═══
        try{
            const prevBiz=businessInfo[num]||d.businessDB?.[num]||{isBusiness:false};
            const lbl=d.labels?.[num]?` (${d.labels[num]})`:'';

            // S1 check
            const s1Biz=await sock.getBusinessProfile(toJid(num)).catch(()=>null);
            const s1IsBiz=!!(s1Biz&&(s1Biz.description||s1Biz.category||s1Biz.wid||s1Biz.business_name||s1Biz.vname));
            await new Promise(r=>setTimeout(r,2000));

            // S2 check via IPC
            let s2Vote=null;
            if(verifier&&s2Connected){
                try{
                    s2Vote=await new Promise(resolve=>{
                        const key='biz_'+num;
                        s2Callbacks[key]=resolve;
                        verifier.send({type:'check_biz',number:num});
                        setTimeout(()=>{if(s2Callbacks[key]){delete s2Callbacks[key];resolve(null);}},8000);
                    });
                }catch{}
            }
            await new Promise(r=>setTimeout(r,2000));

            // S3 check via IPC
            let s3Vote=null;
            if(verifier3&&s3Connected){
                try{
                    s3Vote=await new Promise(resolve=>{
                        const key='biz3_'+num;
                        s3Callbacks[key]=resolve;
                        verifier3.send({type:'check_biz',number:num});
                        setTimeout(()=>{if(s3Callbacks[key]){delete s3Callbacks[key];resolve(null);}},8000);
                    });
                }catch{}
            }

            // ── Vote count ──
            const votes=[];
            votes.push(s1IsBiz);
            if(s2Vote!==null) votes.push(s2Vote===true||(s2Vote&&s2Vote.isBusiness===true));
            if(s3Vote!==null) votes.push(s3Vote===true||(s3Vote&&s3Vote.isBusiness===true));
            const bizYes=votes.filter(v=>v).length;
            const total=votes.length;
            const confirmed=bizYes>=2||(total===1&&bizYes===1);
            const conf=total>=3?'TRIPLE ✓✓✓':(total>=2?'DUAL ✓✓':'S1');

            // Build details from S1
            let newBiz={isBusiness:false,ts:Date.now()};
            if(confirmed&&s1Biz){
                newBiz={isBusiness:true,name:s1Biz.business_name||s1Biz.vname||'',
                    category:s1Biz.category||'',description:s1Biz.description||'',
                    website:s1Biz.website?.[0]||'',email:s1Biz.email||'',
                    address:s1Biz.address||'',ts:Date.now()};
            }

            // ── Alerts only on CHANGE ──
            if(confirmed&&!prevBiz.isBusiness){
                let t=`💼 *Switched to WhatsApp Business!*\n${'━'.repeat(28)}\n`;
                t+=`👤 \`${num}\`${lbl}\n🕐 ${fmtTime(Date.now())}\n🔒 *${conf}*\n\n`;
                if(newBiz.name) t+=`🏢 *Name:* ${newBiz.name}\n`;
                if(newBiz.category) t+=`📂 *Category:* ${newBiz.category}\n`;
                if(newBiz.description) t+=`📝 *About:* _"${newBiz.description.substring(0,60)}"_\n`;
                if(newBiz.website) t+=`🌐 *Website:* ${newBiz.website}\n`;
                if(newBiz.email) t+=`📧 *Email:* ${newBiz.email}\n`;
                if(newBiz.address) t+=`📍 *Address:* ${newBiz.address.substring(0,50)}\n`;
                tgSend(t);
            } else if(!confirmed&&prevBiz.isBusiness){
                tgSend(`📱 *Switched to Personal WhatsApp!*\n${'─'.repeat(24)}\n👤 \`${num}\`${lbl}\n🕐 ${fmtTime(Date.now())}\n🔒 *${conf}*\n\n_Was: 💼 ${prevBiz.name||''} (${prevBiz.category||''})\nNow: Personal_`);
            } else if(confirmed&&prevBiz.isBusiness){
                const ch=[];
                if(prevBiz.name&&newBiz.name&&prevBiz.name!==newBiz.name) ch.push(`🏢 _"${prevBiz.name}"_ → *"${newBiz.name}"*`);
                if(prevBiz.category&&newBiz.category&&prevBiz.category!==newBiz.category) ch.push(`📂 _"${prevBiz.category}"_ → *"${newBiz.category}"*`);
                if(prevBiz.description&&newBiz.description&&prevBiz.description!==newBiz.description) ch.push(`📝 About changed`);
                if(prevBiz.website!==undefined&&newBiz.website&&prevBiz.website!==newBiz.website) ch.push(`🌐 ${prevBiz.website||'none'} → *${newBiz.website}*`);
                if(prevBiz.email!==undefined&&newBiz.email&&prevBiz.email!==newBiz.email) ch.push(`📧 ${prevBiz.email||'none'} → *${newBiz.email}*`);
                if(ch.length) tgSend(`💼 *Business Details Changed!*\n${'─'.repeat(24)}\n👤 \`${num}\`${lbl}\n🕐 ${fmtTime(Date.now())}\n🔒 *${conf}*\n\n${ch.join('\n')}`);
            }

            businessInfo[num]=confirmed?newBiz:{isBusiness:false,ts:Date.now()};
            d.businessDB=d.businessDB||{};d.businessDB[num]=businessInfo[num];save(d);
        }catch(e){L.err(`Biz ${num}: ${e.message}`);}

        // ═══ DEVICE REFRESH — log current device state ═══
        if(deviceOf[num]){
            if(!deviceLog[num]) deviceLog[num]=[];
            deviceLog[num].push({device:deviceOf[num],ts:Date.now(),src:'brain'});
            if(deviceLog[num].length>200) deviceLog[num]=deviceLog[num].slice(-200);
        }

        await new Promise(r=>setTimeout(r,2000));
      }catch(e){L.err(`Brain ${num}: ${e.message}`);}
    }
}

// Report generator — full intelligence file
async function generateReport(num){
    const d=load();
    const lbl=d.labels?.[num]||num;
    const dpH=(d.dpHistory||{})[num]||[];
    const bioH=(d.bioHistory||{})[num]||[];
    const curBio=d.bioDB?.[num]||savedBio[num]||'N/A';
    const dev=deviceOf[num]||'Unknown';
    const filePath=path.join(process.cwd(),`report_${num}.txt`);
    let r='';
    r+=`${'═'.repeat(50)}\n`;
    r+=`  AIZEN PRO MAX 69 — INTELLIGENCE REPORT\n`;
    r+=`  instagram.com/immortalaizen · Aizen Services\n`;
    r+=`${'═'.repeat(50)}\n\n`;
    const biz=businessInfo[num]||d.businessDB?.[num]||{};
    r+=`Target:  ${num}\nLabel:   ${lbl}\nDevice:  ${dev}\nBio:     "${curBio}"\nType:    ${biz.isBusiness?'WhatsApp Business':'Personal'}\n`;
    if(biz.isBusiness){
        if(biz.name) r+=`Business: ${biz.name}\n`;
        if(biz.category) r+=`Category: ${biz.category}\n`;
        if(biz.description) r+=`About:    "${biz.description}"\n`;
        if(biz.website) r+=`Website:  ${biz.website}\n`;
        if(biz.email) r+=`Email:    ${biz.email}\n`;
        if(biz.address) r+=`Address:  ${biz.address}\n`;
    }
    r+=`Status:  ${online[num]?'ONLINE':'OFFLINE'}\n`;
    if(lastSeenAt[num]) r+=`Last seen: ${fmtTime(lastSeenAt[num])}\n`;
    r+=`Generated: ${fmtTime(Date.now())}\n`;
    r+=`\n${'─'.repeat(50)}\n\n`;
    r+=`DP CHANGES (${dpH.length} total)\n${'─'.repeat(50)}\n`;
    if(dpH.length) for(const e of dpH){r+=`  ${fmtTime(e.ts)} | ${(e.type||'?').toUpperCase()} | hash:${e.hash||'?'}\n`;}
    else r+=`  No records\n`;
    r+=`\n${'─'.repeat(50)}\n\n`;
    r+=`BIO CHANGES (${bioH.length} total)\n${'─'.repeat(50)}\n`;
    if(bioH.length) for(const e of bioH){
        r+=`  ${fmtTime(e.ts)} | ${(e.type||'?').toUpperCase()}\n`;
        if(e.from) r+=`    From: "${e.from}"\n`;
        if(e.to) r+=`    To:   "${e.to}"\n`;
        if(e.diff)for(const dd of e.diff){
            if(dd.t==='changed') r+=`    🔄 "${dd.f}" → "${dd.to}"\n`;
            else if(dd.t==='added') r+=`    ➕ "${dd.x}"\n`;
            else if(dd.t==='removed') r+=`    ➖ "${dd.x}"\n`;
        }
        r+=`\n`;
    } else r+=`  No records\n`;
    r+=`\n${'═'.repeat(50)}\n  End of Report · AIZEN PRO MAX 69\n${'═'.repeat(50)}\n`;
    try{fs.writeFileSync(filePath,r,'utf8');}catch{}
    return filePath;
}

function startDPBioMonitor(){
    if(dpBioTimerId){clearInterval(dpBioTimerId);dpBioTimerId=null;}
    setTimeout(()=>dpBioSnapshot().catch(()=>{}),5000);
    dpBioTimerId=setInterval(()=>dpBioCheck().catch(()=>{}),DP_BIO_INTERVAL);
    L.inf('🧠 Brain started (10min, 3x retry)');
}
function stopDPBioMonitor(){
    if(dpBioTimerId){clearInterval(dpBioTimerId);dpBioTimerId=null;}
}

// ══════════════════════════════════════════════════════════════════════════════
//  TIMERS
// ══════════════════════════════════════════════════════════════════════════════
function stopTimers(){
    if(keepAliveId){clearInterval(keepAliveId);keepAliveId=null;}
    if(resubId){clearInterval(resubId);resubId=null;}
    if(forceOffId){clearInterval(forceOffId);forceOffId=null;}
    if(verifyLoopId){clearInterval(verifyLoopId);verifyLoopId=null;}
    if(healthId){clearInterval(healthId);healthId=null;}
    stopDPBioMonitor();
    // Clear all offline debounces
    for(const num of Object.keys(offlineDebounce)){clearTimeout(offlineDebounce[num]);delete offlineDebounce[num];}
}

function startTimers(){
    stopTimers();

    // Keep alive — stay online for presence
    keepAliveId=setInterval(async()=>{
        if(!sock||!conn1) return;
        try{await sock.sendPresenceUpdate('available');lastWsPong=Date.now();missedPings=0;}
        catch{missedPings++;}
    },KEEPALIVE_EVERY);

    // Re-subscribe every 12s — DOUBLE POKE pattern
    resubId=setInterval(async()=>{
        if(!sock||!conn1) return;
        try{await sock.sendPresenceUpdate('available');}catch{}
        const d=load();
        for(const num of d.monitored){
            // First subscribe
            try{await sock.presenceSubscribe(toJid(num));}catch{}
            if(phoneLid[num])try{await sock.presenceSubscribe(`${phoneLid[num]}@lid`);}catch{}
            try{await sock.sendPresenceUpdate('available',toJid(num));}catch{}
            await new Promise(r=>setTimeout(r,80));
            // Double poke — 500ms later, subscribe again (catches missed first attempt)
            setTimeout(async()=>{
                if(!sock||!conn1) return;
                try{await sock.presenceSubscribe(toJid(num));}catch{}
                if(phoneLid[num])try{await sock.presenceSubscribe(`${phoneLid[num]}@lid`);}catch{}
            },500);
        }
    },RESUB_EVERY);

    // Force offline check — run merge for all nums every 10s
    forceOffId=setInterval(()=>{
        const d=load();
        for(const num of d.monitored) merge(num);
    },8000); // Check every 8s

    // Session 2 verify loop — verify ALL numbers equally (not just online)
    verifyLoopId=setInterval(()=>{
        if(!verifier||!s2Connected) return;
        const d=load();
        for(const num of d.monitored){
            verifier.send({type:'verify',number:num});
        }
    },VERIFY_EVERY);

    // Health check — is WebSocket actually alive?
    healthId=setInterval(async()=>{
        if(!sock||!conn1) return;
        if(missedPings>=MAX_MISSED_PINGS){
            L.err(`Health: ${missedPings} missed pings — reconnecting`);
            missedPings=0;
            if(!isReconnecting1){
                isReconnecting1=true;
                stopTimers();
                if(sock){try{sock.end();}catch{}}sock=null;conn1=false;
                setTimeout(()=>{isReconnecting1=false;connectS1();},3000);
            }
            return;
        }
        // Check connection health via presence ping
        try{
            await sock.sendPresenceUpdate('available');
            lastWsPong=Date.now();missedPings=0;
        }catch{
            missedPings++;
            if(missedPings>=2) L.err(`Health: ${missedPings} failed pings`);
        }
    },HEALTH_CHECK_MS);
}

// ══════════════════════════════════════════════════════════════════════════════
//  SESSION 1 — WhatsApp Connection
// ══════════════════════════════════════════════════════════════════════════════
async function connectS1(){
    // Reconnect guard — prevent multiple simultaneous connections
    if(isReconnecting1){L.inf('Already reconnecting — skip');return;}
    isReconnecting1=true;
    try{
        const{default:makeWASocket,useMultiFileAuthState,fetchLatestWaWebVersion,
            fetchLatestBaileysVersion,DisconnectReason,makeCacheableSignalKeyStore
        }=require('@whiskeysockets/baileys');
        const pino=require('pino'),{Boom}=require('@hapi/boom');

        if(!fs.existsSync(AUTH_1)) fs.mkdirSync(AUTH_1,{recursive:true});
        const{state,saveCreds}=await useMultiFileAuthState(AUTH_1);
        const ver=await(fetchLatestWaWebVersion||fetchLatestBaileysVersion)()
            .catch(()=>({version:[2,3000,1015901307]}));
        const waVer=ver?.version||[2,3000,1015901307];
        L.inf(`WA v${waVer.join('.')}`);

        if(sock){try{sock.end();}catch{}}
        const s=makeWASocket({
            version:waVer,
            auth:{...state,keys:makeCacheableSignalKeyStore(state.keys,pino({level:'silent'}))},
            logger:pino({level:'silent'}),
            browser:['Linux','Chrome','20.00.1'],
            syncFullHistory:false,
            connectTimeoutMs:60000,
            defaultQueryTimeoutMs:0,
            keepAliveIntervalMs:30000,
            retryRequestDelayMs:1000,
            shouldIgnoreJid:()=>false,
            getMessage:async()=>({conversation:''}),
        });
        sock=s;s.ev.on('creds.update',saveCreds);

        // ── Pairing ───────────────────────────────────────────────────────
        if(!s.authState.creds.registered){
            if(!WA_NUM){L.err('No number');tgSend('❌ `/pair 91xxx`');return;}
            isPairing1=true;
            L.inf('Generating pairing code...');
            setTimeout(async()=>{
                try{
                    if(!sock){isPairing1=false;return;}
                    const code=await s.requestPairingCode(WA_NUM.replace(/[^0-9]/g,''),"AIZEN690");
                    const fmt=code?.match(/.{1,4}/g)?.join('-')||code;
                    L.ok(`S1 Code: ${fmt}`);
                    tgSend(`🔗 *SESSION 1 CODE*\n${'━'.repeat(24)}\n\`${fmt}\`\n${'━'.repeat(24)}\n\n📱 \`${WA_NUM}\`\n⏰ *60s!*`);
                }catch(e){
                    L.err(`Pair: ${e.message}`);
                    tgSend(`❌ *S1 Pair Failed:* \`${e.message}\`\nRetry: \`/pair\``);
                }finally{isPairing1=false;}
            },3000);
        }

        // ── Connection ────────────────────────────────────────────────────
        s.ev.on('connection.update',async({connection,lastDisconnect})=>{
            if(connection==='connecting') L.inf('S1 Connecting...');

            if(connection==='open'){
                conn1=true;isPairing1=false;isReconnecting1=false;
                const d=load();d.paired=true;save(d);
                L.ok('Session 1 Connected!');L.sep();
                tgSend('✅ *Session 1 Connected!*');
                // Reset online states
                for(const n of d.monitored){online[n]=false;delete s1State[n];delete onlineSince[n];delete onlineMsgId[n];if(pendingOnline[n]){clearTimeout(pendingOnline[n]);delete pendingOnline[n];}}
                // Load persisted LID map
                if(d.lidMap) for(const[lid,ph]of Object.entries(d.lidMap)){lidMap[lid]=ph;phoneLid[ph]=lid;}
                // Go online and subscribe
                try{await s.sendPresenceUpdate('available');}catch{}
                await new Promise(r=>setTimeout(r,800));
                await subAll();
                startTimers();
                startDPBioMonitor();
                // Warmup subs
                for(const delay of [3000,8000,15000]){
                    setTimeout(async()=>{
                        if(sock&&conn1){try{await s.sendPresenceUpdate('available');}catch{}await subAll();}
                    },delay);
                }
            }

            if(connection==='close'){
                conn1=false;stopTimers();
                const code=new Boom(lastDisconnect?.error)?.output?.statusCode;
                L.err(`S1 Closed (${code})`);

                if(code===DisconnectReason.loggedOut||code===401||code===403){
                    const d=load();d.paired=false;save(d);
                    try{fs.rmSync(AUTH_1,{recursive:true,force:true});}catch{}
                    tgSend('🚪 *Session 1 Ended* — `/pair` to reconnect');
                    isPairing1=false;isReconnecting1=false;
                } else if(code===DisconnectReason.connectionReplaced){
                    L.inf('S1 replaced — wait 30s');
                    isReconnecting1=false;
                    setTimeout(()=>{if(fs.existsSync(AUTH_1)&&!conn1&&!isPairing1){isReconnecting1=false;connectS1();}},30000);
                } else if(fs.existsSync(AUTH_1)&&!isPairing1){
                    const delay=5000+Math.floor(Math.random()*3000);
                    L.inf(`S1 reconnecting in ${Math.round(delay/1000)}s...`);
                    isReconnecting1=false;
                    setTimeout(()=>{isReconnecting1=false;connectS1();},delay);
                } else {isReconnecting1=false;}
            }
        });

        // ── PRESENCE ──────────────────────────────────────────────────────
        s.ev.on('presence.update',({id,presences})=>{
            let num=resolveNum(id);
            if(!num){
                for(const pj of Object.keys(presences)){
                    const r=resolveNum(pj);if(r){num=r;break;}
                    const raw=pj.replace(/\.\d+:\d+@.*/,'').replace(/@.*/,'');
                    if(/^\d{7,15}$/.test(raw)){const d=load();if(d.monitored.includes(raw)){num=raw;break;}}
                }
            }
            // Log all S1 presence events for debugging
            const st0=Object.values(presences)[0]?.lastKnownPresence||'?';
            if(num){
                L.sub(`[S1] ${X.w}${num}${R} → ${st0}`);
                
                
            } else {
                // Unresolved — might be LID we don't have mapping for
                const rawId=fromJid(id);
                if(id.includes('@lid')) L.sub(`[S1] LID:${rawId.substring(0,8)}... → ${st0} (unresolved)`);
                return;
            }
            const d=load();if(!d.monitored.includes(num)) return;
            lastEvent[num]=Date.now();

            for(const[,pres]of Object.entries(presences)){
                const st=pres.lastKnownPresence;
                if(st==='composing'||st==='recording') handleTyping(num,st);
                else if(st==='paused'){
                    if(typingState[num]){clearTimeout(typingState[num].timer);delete typingState[num];}
                } else {
                    s1State[num]={status:st,ts:Date.now()};
                    merge(num);
                }
            }
        });

        // ── Messages — online + device ────────────────────────────────────
        s.ev.on('messages.upsert',({messages:msgs,type})=>{
            if(type!=='notify') return;
            for(const msg of msgs){
                if(msg.key?.fromMe) continue;
                const fj=msg.key?.remoteJid||'';
                const sender=fj.includes('@g.us')
                    ?(resolveNum(msg.key?.participant||'')||fromJid(msg.key?.participant||''))
                    :(resolveNum(fj)||fromJid(fj));
                if(!sender||!/^\d{7,15}$/.test(sender)) continue;
                const d=load();if(!d.monitored.includes(sender)) continue;
                detectDevice(msg,sender);
                s1State[sender]={status:'available',ts:Date.now()};
                merge(sender);
            }
        });

        // ── Receipts ──────────────────────────────────────────────────────
        s.ev.on('message-receipt.update',updates=>{
            for(const u of(updates||[])){
                if(!u.key?.fromMe) continue;
                const num=resolveNum(u.key?.remoteJid||'')||fromJid(u.key?.remoteJid||'');
                if(!num||!/^\d{7,15}$/.test(num)) continue;
                const d=load();if(!d.monitored.includes(num)) continue;
                if(u.receipt?.readTimestamp||u.receipt?.playedTimestamp||u.receipt?.receiptTimestamp){
                    s1State[num]={status:'available',ts:Date.now()};merge(num);
                }
            }
        });

        // ── Reactions ─────────────────────────────────────────────────────
        s.ev.on('messages.reaction',reactions=>{
            for(const r of(reactions||[])){
                const num=resolveNum(r.key?.participant||r.key?.remoteJid||'')||
                    fromJid(r.key?.participant||r.key?.remoteJid||'');
                if(!num||!/^\d{7,15}$/.test(num)) continue;
                const d=load();if(!d.monitored.includes(num)) continue;
                const emoji=r.reaction?.text||'';
                if(emoji){
                    if(!reactionLog[num]) reactionLog[num]=[];
                    reactionLog[num].push({emoji,ts:Date.now()});
                    if(reactionLog[num].length>50) reactionLog[num]=reactionLog[num].slice(-50);
                }
                if(spyList[num]&&Date.now()<spyList[num].until) spyList[num].results.push({type:'reaction',emoji,ts:Date.now()});
                s1State[num]={status:'available',ts:Date.now()};merge(num);
            }
        });

        // ── Calls ─────────────────────────────────────────────────────────
        s.ev.on('call',calls=>{
            for(const call of(calls||[])){
                const num=resolveNum(call.from||'')||fromJid(call.from||'');
                if(!num||!/^\d{7,15}$/.test(num)) continue;
                const d=load();if(!d.monitored.includes(num)) continue;
                const lbl=d.labels?.[num]?` (${d.labels[num]})`:'';
                const isVideo=call.isVideo;
                const st=call.status||'unknown';
                const stTxt=st==='offer'?'Incoming':st==='accept'?'Answered':st==='timeout'?'Missed':st==='reject'?'Declined':st;
                if(!callLog[num]) callLog[num]=[];
                callLog[num].push({type:isVideo?'video':'voice',status:st,ts:Date.now()});
                if(callLog[num].length>50) callLog[num]=callLog[num].slice(-50);
                tgSend(`${isVideo?'📹':'📞'} *${isVideo?'Video':'Voice'} Call — ${stTxt}*\n${'─'.repeat(24)}\n👤 \`${num}\`${lbl}\n🕐 ${fmtTime(Date.now())}`);
                if(spyList[num]&&Date.now()<spyList[num].until) spyList[num].results.push({type:'call',sub:stTxt,ts:Date.now()});
                s1State[num]={status:'available',ts:Date.now()};merge(num);
            }
        });

        // ── LID Mapping (4 sources) ───────────────────────────────────────
        s.ev.on('contacts.upsert',cts=>{
            for(const ct of(cts||[])){
                if(ct.id?.includes('@s.whatsapp.net')&&ct.lid){
                    const ph=fromJid(ct.id),lid=ct.lid.replace(/@.*/,'');
                    if(!lidMap[lid]){lidMap[lid]=ph;phoneLid[ph]=lid;
                        const d=load();d.lidMap=d.lidMap||{};d.lidMap[lid]=ph;save(d);
                    }
                }
            }
        });
        s.ev.on('contacts.update',cts=>{
            for(const ct of(cts||[])){
                if(ct.id?.includes('@s.whatsapp.net')&&ct.lid){
                    const ph=fromJid(ct.id),lid=ct.lid.replace(/@.*/,'');
                    lidMap[lid]=ph;phoneLid[ph]=lid;
                }
                // lastSeen = recent activity
                const num=resolveNum(ct.id||'')||fromJid(ct.id||'');
                if(!num) continue;const d=load();if(!d.monitored.includes(num)) continue;
                if(ct.lastSeen&&ct.lastSeen*1000>(Date.now()-60000)){
                    s1State[num]={status:'available',ts:Date.now()};merge(num);
                }
            }
        });
        s.ev.on('messaging-history.set',({contacts})=>{
            let n=0;for(const ct of(contacts||[])){
                if(ct.id?.includes('@s.whatsapp.net')&&ct.lid){
                    const ph=fromJid(ct.id),lid=ct.lid.replace(/@.*/,'');
                    lidMap[lid]=ph;phoneLid[ph]=lid;n++;
                }
            }
            if(n){L.ok(`LID: ${n} mappings loaded`);
                const d=load();d.lidMap=d.lidMap||{};
                for(const[lid,ph]of Object.entries(lidMap))d.lidMap[lid]=ph;save(d);
            }
        });

        // ── Reinstall Detect — identity key change = new installation ────
        s.ev.on('creds.update',()=>{
            // Track when keys change — might indicate reinstall for monitored contacts
        });

        // ── Message update — edit/delete detection ──────────────────────
        s.ev.on('messages.update',updates=>{
            for(const u of(updates||[])){
                const num=resolveNum(u.key?.remoteJid||'')||fromJid(u.key?.remoteJid||'');
                if(!num||!/^\d{7,15}$/.test(num)) continue;
                const d=load();if(!d.monitored.includes(num)) continue;
                const lbl=d.labels?.[num]?` (${d.labels[num]})`:'';
                const stubType=u.update?.messageStubType;

                // Message revoked = delete detected
                if(stubType===1||u.update?.message===null){
                    L.sub(`${X.w}${num}${R} deleted a message`);
                    tgSend(`🗑 *Message Deleted*\n${'─'.repeat(24)}\n👤 \`${num}\`${lbl}\n🕐 ${fmtTime(Date.now())}\n_Target deleted a message_`);
                    s1State[num]={status:'available',ts:Date.now()};merge(num);
                }

                // ═══ SECURITY CODE CHANGED (type 39 = E2E_IDENTITY_CHANGED) ═══
                // This fires when contact reinstalls WA, changes phone, or transfers account
                // WhatsApp shows "Security code changed" in chat
                if(stubType===39){
                    L.sub(`${X.w}${num}${R} 🔐 SECURITY CODE CHANGED!`);
                    tgSend(
                        `🔐 *Security Code Changed!*\n${'━'.repeat(28)}\n`+
                        `👤 \`${num}\`${lbl}\n`+
                        `🕐 ${fmtTime(Date.now())}\n\n`+
                        `_WhatsApp encryption key changed.\n`+
                        `Confirmed reasons:\n`+
                        `• WhatsApp reinstalled\n`+
                        `• New phone setup\n`+
                        `• Account transferred\n`+
                        `• New device linked_`
                    );
                    s1State[num]={status:'available',ts:Date.now()};merge(num);
                }

                // Type 78 = PHONE_NUMBER_CHANGED
                if(stubType===78){
                    const params=u.update?.messageStubParameters||[];
                    L.sub(`${X.w}${num}${R} 📱 NUMBER CHANGED!`);
                    tgSend(
                        `📱 *Number Changed!*\n${'━'.repeat(28)}\n`+
                        `👤 \`${num}\`${lbl}\n`+
                        `🕐 ${fmtTime(Date.now())}\n`+
                        (params.length?`\n🔄 New: \`${params[0]?.replace('@s.whatsapp.net','')}\`\n`:'')+
                        `\n_Contact changed their WhatsApp number_`
                    );
                }
            }
        });

        // ── Reinstall + Identity key change detect ──────────────────────
        s.ev.on('messages.upsert',({messages:nmsgs})=>{
            for(const m of(nmsgs||[])){
                // senderKeyDistributionMessage — new encryption session = reinstall/new device
                if(m.message?.senderKeyDistributionMessage){
                    const jid=m.key?.remoteJid||'';
                    const num=resolveNum(jid)||fromJid(jid);
                    if(!num) continue;
                    const d=load();if(!d.monitored.includes(num)) continue;
                    const newKey=m.message.senderKeyDistributionMessage.axolotlSenderKeyDistributionMessage;
                    if(newKey){
                        const keyHash=require('crypto').createHash('md5').update(Buffer.from(newKey)).digest('hex').substring(0,16);
                        if(identityKeys[num]&&identityKeys[num]!==keyHash){
                            const lbl=d.labels?.[num]?` (${d.labels[num]})`:'';
                            L.sub(`${X.w}${num}${R} 🔄 NEW IDENTITY KEY`);
                            tgSend(
                                `🔄 *Identity Key Changed!*\n${'━'.repeat(28)}\n`+
                                `👤 \`${num}\`${lbl}\n`+
                                `🕐 ${fmtTime(Date.now())}\n\n`+
                                `_Encryption key changed — confirmed:\n• WhatsApp reinstalled\n• Or new phone setup\n• Or number transferred_`
                            );
                        }
                        identityKeys[num]=keyHash;
                    }
                }

                // ProtocolMessage type 5 = SECURITY_NOTIFICATION (identity change notification)
                const proto=m.message?.protocolMessage;
                if(proto&&proto.type===5){
                    const jid=m.key?.remoteJid||'';
                    const num=resolveNum(jid)||fromJid(jid);
                    if(!num) continue;
                    const d=load();if(!d.monitored.includes(num)) continue;
                    const lbl=d.labels?.[num]?` (${d.labels[num]})`:'';
                    L.sub(`${X.w}${num}${R} 🔐 SECURITY NOTIFICATION`);
                    tgSend(
                        `🔐 *Security Notification*\n${'━'.repeat(28)}\n`+
                        `👤 \`${num}\`${lbl}\n`+
                        `🕐 ${fmtTime(Date.now())}\n\n`+
                        `_WhatsApp sent a security notification\nfor this contact — key was re-verified_`
                    );
                }
            }
        });

    }catch(e){L.err(`S1 connect: ${e.message}`);isReconnecting1=false;setTimeout(()=>{isReconnecting1=false;connectS1();},10000);}
}

// ══════════════════════════════════════════════════════════════════════════════
//  BANNER
// ══════════════════════════════════════════════════════════════════════════════
function banner(){
    console.clear();
    console.log('');
    console.log(`  ${X.m}${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}`);
    console.log(`  ${X.c}${B}  AIZEN PRO MAX 69${R}  ${X.d}Triple Engine${R}`);
    console.log(`  ${X.d}  instagram.com/immortalaizen${R}`);
    console.log(`  ${X.m}${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}`);
    console.log(`  ${X.g}S1${R} Chrome  ${X.y}S2${R} Edge  ${X.c}S3${R} Firefox`);
    console.log(`  ${X.d}Owner: ${OWNER_ID||'NOT SET'}  WA: ${WA_NUM||'/pair'}  Max: ${MAX_NUMS}${R}`);
    console.log(`  ${X.m}${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}`);
    console.log('');
}

// ══════════════════════════════════════════════════════════════════════════════
//  START
// ══════════════════════════════════════════════════════════════════════════════
process.on('uncaughtException',e=>L.err(`Uncaught: ${e.message}`));
process.on('SIGINT',()=>{L.inf('Shutting down...');saveMemory();process.exit(0);});
process.on('SIGTERM',()=>{L.inf('Terminated...');saveMemory();process.exit(0);});
process.on('unhandledRejection',e=>L.err(`Unhandled: ${e?.message||e}`));
['SIGTERM','SIGINT'].forEach(sig=>process.on(sig,()=>{
    L.inf(sig);stopTimers();
    if(verifier)try{verifier.kill();}catch{}
    process.exit(0);
}));

banner();
loadMemory(); // Restore device/business/lastSeen from disk
startMemSave(); // Auto-save every 5 min
const _d=load();
if(!WA_NUM&&_d.wa_number){WA_NUM=_d.wa_number;L.inf(`WA: ${WA_NUM}`);}
// Start Session 2 + Session 3 verifier processes
startVerifier();
startVerifier3();
// Connect Session 1 if previously paired
if(fs.existsSync(AUTH_1)){connectS1();}
else{L.inf('No S1 session — /pair');if(OWNER_ID)tgSend('📱 *Bot Started*\n`/pair 91xxx` — Session 1\n`/pair2 91xxx` — Session 2\n`/pair3 91xxx` — Session 3');}

// Start auto health check (every 30 min)
setTimeout(()=>startHealthCheck(),10000); // 10s delay for sessions to connect first
