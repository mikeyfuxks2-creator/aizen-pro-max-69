/**
 * AIZEN PRO MAX 69 — Session 3 VERIFIER (runs as child process via fork)
 * ───────────────────────────────────────────────────────────────
 * RULES:
 *  - Completely independent WhatsApp connection
 *  - Different browser fingerprint → no clash with Session 1
 *  - Own auth folder (wa_auth_3/) → own session
 *  - Communicates with parent ONLY via IPC (process.send/on)
 *  - Handles its own reconnect (except 401/403 = wait for /pair3)
 *  - Subscribes to non-contacts via phone JID + LID JID
 */
'use strict';
const fs=require('fs'),path=require('path');

const AUTH=path.join(process.cwd(),'wa_auth_3');
const BROWSER=['Ubuntu','Firefox','120.0']; // MUST differ from Session 1
let sock=null,connected=false,isPairing=false;
let keepAliveId=null; // Module scope — survives reconnects
let pairCodeSentAt=0; // Timestamp when pairing code was sent — block reconnect for 65s
const presOf={}; // num -> last presence status

function send(type,data={}){try{process.send({type,...data});}catch{}}
function log(m){console.log(`  [S3] ${m}`);}

// ══════════════════════════════════════════════════════════════════════════════
//  CONNECT — creates a fresh Baileys socket
// ══════════════════════════════════════════════════════════════════════════════
async function connect(pairNumber){
    if(isPairing){log('Already pairing — skip');return;}
    try{
        const{default:makeWASocket,useMultiFileAuthState,fetchLatestWaWebVersion,
            fetchLatestBaileysVersion,DisconnectReason,makeCacheableSignalKeyStore
        }=require('@whiskeysockets/baileys');
        const pino=require('pino'),{Boom}=require('@hapi/boom');

        if(!fs.existsSync(AUTH)) fs.mkdirSync(AUTH,{recursive:true});
        const{state,saveCreds}=await useMultiFileAuthState(AUTH);
        const ver=await(fetchLatestWaWebVersion||fetchLatestBaileysVersion)()
            .catch(()=>({version:[2,3000,1015901307]}));

        if(sock){try{sock.end();}catch{}}
        sock=null;connected=false;

        const s=makeWASocket({
            version:ver?.version||[2,3000,1015901307],
            auth:{...state,keys:makeCacheableSignalKeyStore(state.keys,pino({level:'silent'}))},
            logger:pino({level:'silent'}),
            browser:BROWSER,
            syncFullHistory:false,
            connectTimeoutMs:60000,
            defaultQueryTimeoutMs:0,
            keepAliveIntervalMs:30000,
            retryRequestDelayMs:1000,
            shouldIgnoreJid:()=>false,
            getMessage:async()=>({conversation:''}),
        });
        sock=s;
        s.ev.on('creds.update',saveCreds);

        // ── PAIRING — only when not registered AND number provided ────────
        if(!s.authState.creds.registered&&pairNumber){
            isPairing=true;
            log(`Generating code for ${pairNumber}...`);
            setTimeout(async()=>{
                try{
                    if(!sock){isPairing=false;return;}
                    const code=await s.requestPairingCode(
                        pairNumber.replace(/[^0-9]/g,''),
                        "AIZEN693"
                    );
                    const fmt=code?.match(/.{1,4}/g)?.join('-')||code;
                    log(`✅ Code: ${fmt}`);
                    send('pair_code',{code:fmt});
                    pairCodeSentAt=Date.now(); // Block reconnect for 65s
                }catch(e){
                    log(`❌ Pair error: ${e.message}`);
                    send('pair_error',{error:e.message});
                }finally{
                    isPairing=false;
                }
            },3000); // 3s delay — socket needs time to handshake
        } else if(!s.authState.creds.registered&&!pairNumber){
            log('Not paired — waiting for /pair3');
        }

        // ── CONNECTION EVENTS ─────────────────────────────────────────────
        // Clear any leftover keepAlive from previous connection
        if(keepAliveId){clearInterval(keepAliveId);keepAliveId=null;}

        s.ev.on('connection.update',async({connection,lastDisconnect})=>{
            if(connection==='connecting') log('Connecting...');

            if(connection==='open'){
                connected=true;isPairing=false;
                log('✅ Connected!');
                send('connected',{});

                // Stay online — required for presence from others
                try{await s.sendPresenceUpdate('available');}catch{}
                if(keepAliveId) clearInterval(keepAliveId);
                keepAliveId=setInterval(async()=>{
                    if(sock&&connected) try{await sock.sendPresenceUpdate('available');}catch{}
                },25000);
            }

            if(connection==='close'){
                connected=false;
                if(keepAliveId){clearInterval(keepAliveId);keepAliveId=null;}
                const code=new Boom(lastDisconnect?.error)?.output?.statusCode;
                log(`Closed (${code})`);

                // ── PAIRING WINDOW — don't reconnect if code was just sent ──
                const inPairingWindow=pairCodeSentAt&&(Date.now()-pairCodeSentAt)<65000;

                if(code===DisconnectReason.loggedOut||code===401||code===403){
                    if(inPairingWindow){
                        // 401 during pairing is NORMAL — WA validates the code
                        // DON'T delete auth, DON'T reconnect — wait for code entry
                        log('Auth check during pairing — waiting for code entry (65s)...');
                        return;
                    }
                    // Real logout — delete and wait for /pair3
                    try{fs.rmSync(AUTH,{recursive:true,force:true});}catch{}
                    send('logged_out',{code});
                    isPairing=false;
                    pairCodeSentAt=0;
                } else if(code===DisconnectReason.connectionReplaced){
                    log('Connection replaced — waiting 30s');
                    setTimeout(()=>{
                        if(fs.existsSync(AUTH)&&!connected) connect();
                    },30000);
                } else if(inPairingWindow){
                    // 500/other error during pairing — WAIT, don't reconnect
                    log(`Error during pairing — waiting for code entry... (${Math.round((65000-(Date.now()-pairCodeSentAt))/1000)}s left)`);
                    // After pairing window expires, try reconnecting
                    const remaining=65000-(Date.now()-pairCodeSentAt);
                    setTimeout(()=>{
                        if(!connected&&fs.existsSync(AUTH)) connect();
                        else if(!connected) log('Not paired — waiting for /pair3');
                    },remaining+2000);
                } else {
                    // Normal error — reconnect
                    if(fs.existsSync(AUTH)&&!isPairing){
                        const delay=5000+Math.floor(Math.random()*3000);
                        log(`Reconnecting in ${Math.round(delay/1000)}s...`);
                        setTimeout(()=>connect(),delay);
                    } else if(!fs.existsSync(AUTH)){
                        log('Not paired — waiting for /pair3');
                    }
                }
            }
        });

        // ── PRESENCE → forward to parent ──────────────────────────────────
        s.ev.on('presence.update',({id,presences})=>{
            for(const[pjid,pres]of Object.entries(presences)){
                const st=pres.lastKnownPresence;
                let num=null;
                // Try phone JID first
                if(!id.includes('@lid')){
                    num=id.split('@')[0];
                } else {
                    // LID — send to parent for resolution
                    const lid=id.split('@')[0];
                    send('presence_lid',{lid,status:st,ts:Date.now()});
                }
                // Also try extracting from participant JID (xx.xx:xx@s.whatsapp.net)
                const rawP=pjid.replace(/\.\d+:\d+@.*/,'').replace(/@.*/,'');
                if(!num&&/^\d{7,15}$/.test(rawP)) num=rawP;

                if(num){
                    presOf[num]=st;
                    send('presence',{id:num,status:st,ts:Date.now()});
                }
                if(pres.lastSeen&&num){
                    send('presence',{id:num,status:'lastseen',ts:pres.lastSeen*1000});
                }
            }
        });

        // ── MESSAGES → online signal ──────────────────────────────────────
        s.ev.on('messages.upsert',({messages:msgs,type})=>{
            if(type!=='notify') return;
            for(const msg of msgs){
                if(msg.key?.fromMe) continue;
                const fj=msg.key?.remoteJid||'';
                const sender=fj.includes('@g.us')
                    ?(msg.key?.participant||'').split('@')[0]
                    :fj.split('@')[0];
                if(sender&&/^\d{7,15}$/.test(sender)){
                    presOf[sender]='available';
                    send('presence',{id:sender,status:'available',ts:Date.now(),src:'msg'});
                }
            }
        });

        // ── RECEIPTS → online signal ──────────────────────────────────────
        s.ev.on('message-receipt.update',updates=>{
            for(const u of(updates||[])){
                if(!u.key?.fromMe) continue;
                const num=(u.key?.remoteJid||'').split('@')[0];
                if(!num||!/^\d{7,15}$/.test(num)) continue;
                const r=u.receipt||{};
                if(r.readTimestamp||r.playedTimestamp||r.receiptTimestamp){
                    presOf[num]='available';
                    send('presence',{id:num,status:'available',ts:Date.now(),src:'receipt'});
                }
            }
        });

        // ── LID MAPPING → forward to parent ───────────────────────────────
        s.ev.on('contacts.upsert',cts=>{
            for(const ct of(cts||[])){
                if(ct.id?.includes('@s.whatsapp.net')&&ct.lid)
                    send('lid_map',{phone:ct.id.split('@')[0],lid:ct.lid.replace(/@.*/,'')});
            }
        });
        s.ev.on('contacts.update',cts=>{
            for(const ct of(cts||[])){
                if(ct.id?.includes('@s.whatsapp.net')&&ct.lid)
                    send('lid_map',{phone:ct.id.split('@')[0],lid:ct.lid.replace(/@.*/,'')});
            }
        });
        s.ev.on('messaging-history.set',({contacts})=>{
            for(const ct of(contacts||[])){
                if(ct.id?.includes('@s.whatsapp.net')&&ct.lid)
                    send('lid_map',{phone:ct.id.split('@')[0],lid:ct.lid.replace(/@.*/,'')});
            }
        });

    }catch(e){
        log(`Fatal: ${e.message}`);
        isPairing=false;
        setTimeout(()=>connect(),10000);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
//  IPC — Commands from parent
// ══════════════════════════════════════════════════════════════════════════════
process.on('message',async(msg)=>{
    if(!msg?.type) return;

    // ── PAIR — fresh connection with phone number ─────────────────────────
    if(msg.type==='pair'){
        log(`Pair requested: ${msg.number}`);
        // Reset all pairing state
        pairCodeSentAt=0;
        isPairing=false;
        connected=false;
        // Kill old connection
        if(keepAliveId){clearInterval(keepAliveId);keepAliveId=null;}
        if(sock){try{sock.ev.removeAllListeners();sock.end();}catch{}}
        sock=null;
        // Delete old auth
        try{fs.rmSync(AUTH,{recursive:true,force:true});}catch{}
        // Wait for clean state
        await new Promise(r=>setTimeout(r,2000));
        connect(msg.number);
    }

    // ── HEALTH PING — respond with pong to prove we're alive ───────────
    if(msg.type==='health_ping'){
        let alive=false;
        if(sock&&connected){
            try{
                await sock.sendPresenceUpdate('available');
                alive=true;
            }catch{alive=false;}
        }
        send('health_pong',{key:msg.key,alive});
    }

    // ── CHECK WA — verify if number is registered (cross-session) ───────
    if(msg.type==='check_wa'){
        if(!sock||!connected){send('wa_result',{number:msg.number,exists:'error',err:'not-connected'});return;}
        try{
            const res=await sock.onWhatsApp(msg.number);
            if(Array.isArray(res)&&res.length===0){
                send('wa_result',{number:msg.number,exists:false,lid:''});
            } else {
                const r=Array.isArray(res)?res[0]:res;
                send('wa_result',{
                    number:msg.number,
                    exists:!!(r&&r.exists),
                    lid:r?.lid?String(r.lid).replace(/@.*/,''):''
                });
            }
        }catch(e){
            const raw=(e.data?.attrs?.error||e.message||String(e)).toString().substring(0,60);
            send('wa_result',{number:msg.number,exists:'error',err:raw});
        }
    }

    // ── CHECK BUSINESS — verify if number is WhatsApp Business ──────────
    if(msg.type==='check_biz'){
        if(!sock||!connected){send('biz_result',{number:msg.number,isBusiness:null});return;}
        try{
            const jid=msg.number+'@s.whatsapp.net';
            const biz=await sock.getBusinessProfile(jid).catch(()=>null);
            const isBiz=!!(biz&&(biz.description||biz.category||biz.wid||biz.business_name||biz.vname));
            send('biz_result',{number:msg.number,isBusiness:isBiz});
        }catch{
            send('biz_result',{number:msg.number,isBusiness:null});
        }
    }

    // ── SUBSCRIBE single number ───────────────────────────────────────────
    if(msg.type==='subscribe'){
        if(!sock||!connected) return;
        const jid=msg.number+'@s.whatsapp.net';
        try{await sock.sendPresenceUpdate('available');}catch{}
        try{await sock.presenceSubscribe(jid);}catch{}
        try{await sock.sendPresenceUpdate('available',jid);}catch{}
        if(msg.lid){try{await sock.presenceSubscribe(msg.lid+'@lid');}catch{}}
    }

    // ── SUBSCRIBE ALL ─────────────────────────────────────────────────────
    if(msg.type==='subscribe_all'){
        if(!sock||!connected) return;
        try{await sock.sendPresenceUpdate('available');}catch{}
        for(const item of(msg.numbers||[])){
            const num=typeof item==='string'?item:item.num;
            const lid=typeof item==='string'?null:item.lid;
            try{await sock.presenceSubscribe(num+'@s.whatsapp.net');}catch{}
            try{await sock.sendPresenceUpdate('available',num+'@s.whatsapp.net');}catch{}
            if(lid){try{await sock.presenceSubscribe(lid+'@lid');}catch{}}
            await new Promise(r=>setTimeout(r,150));
        }
        log(`Subscribed ${(msg.numbers||[]).length}`);
    }

    // ── VERIFY — quick presence check ─────────────────────────────────────
    if(msg.type==='verify'){
        if(!sock||!connected){
            send('verify_result',{number:msg.number,online:false});
            return;
        }
        const jid=msg.number+'@s.whatsapp.net';
        try{await sock.sendPresenceUpdate('available');}catch{}
        try{await sock.presenceSubscribe(jid);}catch{}
        try{await sock.sendPresenceUpdate('available',jid);}catch{}
        const cur=presOf[msg.number];
        send('verify_result',{
            number:msg.number,
            online:cur==='available'||cur==='composing'||cur==='recording',
            status:cur||'unknown',ts:Date.now()
        });
    }

    // ── S2 DP verification ────────────────────────────────────────────────
    if(msg.type==='check_dp'){
        if(!sock||!connected){send('dp_result',{number:msg.number,hash:'err'});return;}
        try{
            const url=await sock.profilePictureUrl(msg.number+'@s.whatsapp.net','image').catch(()=>null);
            send('dp_result',{number:msg.number,url:url||null,has:!!url});
        }catch{send('dp_result',{number:msg.number,hash:'err'});}
    }

    // ── S2 Bio verification ───────────────────────────────────────────────
    if(msg.type==='check_bio'){
        if(!sock||!connected){send('bio_result',{number:msg.number,bio:null});return;}
        try{
            const r=await sock.fetchStatus(msg.number+'@s.whatsapp.net').catch(()=>null);
            const bio=r?.status||(Array.isArray(r)&&r[0]?.status)||null;
            send('bio_result',{number:msg.number,bio});
        }catch{send('bio_result',{number:msg.number,bio:null});}
    }
});

// ── Error handling ──────────────────────────────────────────────────────────
process.on('uncaughtException',e=>{log(`Uncaught: ${e.message}`);});
process.on('unhandledRejection',e=>{log(`Unhandled: ${e?.message||e}`);});

// ── Auto-start if previously paired ─────────────────────────────────────────
if(fs.existsSync(AUTH)){
    log('Session found — auto-connecting...');
    connect();
} else {
    log('No session — send /pair3 to pair');
}
