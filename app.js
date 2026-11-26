(() => {
const $ = id => document.getElementById(id);
const config = window.SIEGE_CONFIG || {};
const configured = config.supabaseUrl && config.supabaseAnonKey &&
  !config.supabaseUrl.includes("YOUR_") && !config.supabaseAnonKey.includes("YOUR_");
const sb = configured && window.supabase ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
let user = null, profile = null, authMode = "login", page = "home", roomChannel = null;
let demo = false, currentRoom = null, friends = [], roomPlayers = [];
const state = {coins:0,level:1,username:"Guest",attack:"Scout",defense:"Gorilla",primary:"P90",secondary:"SCAR",friends:[]};

function toast(msg){$("toast").textContent=msg;$("toast").classList.remove("hidden");setTimeout(()=>$("toast").classList.add("hidden"),2600)}
function showAuth(){ $("auth-screen").classList.remove("hidden");$("game-shell").classList.add("hidden");$("match-screen").classList.add("hidden");}
function showGame(){ $("auth-screen").classList.add("hidden");$("game-shell").classList.remove("hidden");$("match-screen").classList.add("hidden");renderProfile();goHome();}
function renderProfile(){
 const n=profile?.username||state.username; const level=profile?.level||state.level; const coins=profile?.coins??state.coins;
 ["nav-username","hero-username"].forEach(id=>$(id).textContent=n);
 ["nav-level","hero-level"].forEach(id=>$(id).textContent=level);
 ["avatar","hero-avatar"].forEach(id=>$(id).textContent=(n[0]||"Y").toUpperCase());
 $("coin-balance").textContent=coins;
}
function goHome(){page="home";$("main-menu").classList.remove("hidden");$("subpage").classList.add("hidden");$("side-panel").classList.add("hidden");}
function renderPage(title,eyebrow,html){page=title.toLowerCase();$("main-menu").classList.add("hidden");$("subpage").classList.remove("hidden");$("page-title").textContent=title;$("page-eyebrow").textContent=eyebrow;$("page-content").innerHTML=html;$("side-panel").classList.add("hidden");}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

document.querySelectorAll("[data-auth]").forEach(b=>b.onclick=()=>{authMode=b.dataset.auth;document.querySelectorAll("[data-auth]").forEach(x=>x.classList.toggle("active",x===b));$("email-label").classList.toggle("hidden",authMode!=="signup");$("username-label").firstChild.textContent=authMode==="signup"?"USERNAME":"EMAIL";$("auth-username").placeholder=authMode==="signup"?"Your callsign":"you@example.com";$("auth-submit").textContent=authMode==="signup"?"CREATE ACCOUNT":"ENTER THE GAME";});
$("auth-form").onsubmit=async e=>{
 e.preventDefault();const username=$("auth-username").value.trim();const password=$("auth-password").value;const email=$("auth-email").value.trim();
 if(!sb){toast("Supabase isn't connected yet. Use local demo or configure config.js.");return}
 try{
  if(authMode==="signup"){
   if(!email){toast("Enter an email address.");return}
   const {data,error}=await sb.auth.signUp({email,password,options:{data:{username}}});if(error)throw error;
   if(data.session){user=data.user;await loadProfile();showGame();toast("Account created.")}else{toast("Account created. Check your email to confirm, then log in.")}
  }else{
   const {data,error}=await sb.auth.signInWithPassword({email:username,password});if(error)throw error;
   user=data.user;await loadProfile();
  }
  if(user)showGame();
 }catch(err){toast(err.message||"Account error")}
};
$("demo-button").onclick=()=>{demo=true;state.username=$("auth-username").value.trim()||"Guest";profile={username:state.username,level:1,coins:0};showGame();toast("Local demo mode. Online features need Supabase setup.")};
async function loadProfile(){if(!sb||!user)return;let {data}=await sb.from("profiles").select("*").eq("id",user.id).maybeSingle();if(!data){data={id:user.id,username:user.user_metadata?.username||user.email?.split("@")[0]||"Operator",level:1,coins:0};await sb.from("profiles").upsert(data)}profile=data;state.username=data.username}
if(sb){sb.auth.getSession().then(async({data})=>{if(data.session){user=data.session.user;await loadProfile();showGame()}});sb.auth.onAuthStateChange(async(_event,session)=>{if(session){user=session.user;await loadProfile();showGame()}else if(!demo){user=null;profile=null;showAuth()}})}

$("open-game").onclick=()=>renderPage("GAME","DEPLOYMENT",`
 <div class="cards">
  <article class="feature-card"><div class="eyebrow">ONLINE 5V5</div><h3>PUBLIC MATCH</h3><p>Join a public waiting lobby. The target is ten players, with bots filling empty slots when the countdown ends.</p><button class="primary" id="find-match">FIND PUBLIC MATCH</button></article>
  <article class="feature-card"><div class="eyebrow">TRAINING</div><h3>PRACTICE</h3><p>Train your aim in the gun range or test your skills against bot opponents.</p><button class="secondary" id="open-practice">CHOOSE PRACTICE</button></article>
 </div>
 <div class="section-title">MATCH RULES</div><div class="data-card"><b>5 VS 5 · FIRST TO 3 ROUNDS</b><p>Two rounds on each side before teams switch between attack and defense. Each round has 45 seconds of preparation and 3 minutes of action.</p></div>`);
$("open-locker").onclick=()=>renderPage("LOCKER","LOADOUT",`
 <div class="cards">
  <article class="feature-card"><h3>ATTACK LOADOUT</h3><p>Operator: <b>${state.attack}</b></p><button class="secondary" id="choose-attack">CHANGE ATTACKER</button><p>Primary: <b>${state.primary}</b></p><button class="secondary" id="choose-primary">CHANGE PRIMARY</button></article>
  <article class="feature-card"><h3>DEFENSE LOADOUT</h3><p>Operator: <b>${state.defense}</b></p><button class="secondary" id="choose-defense">CHANGE DEFENDER</button><p>Secondary: <b>${state.secondary}</b></p><button class="secondary" id="choose-secondary">CHANGE SECONDARY</button></article>
 </div><div class="note">Starter roster: Scout, Medic and Breacher on attack; Gorilla and Doc on defense. The initial weapon pool is P90, SCAR and Pump Shotgun.</div>`);
$("open-shop").onclick=()=>renderPage("SHOP","QUARTERMASTER",`
 <div class="data-card"><div class="eyebrow">YOUR WALLET</div><h2>◈ ${profile?.coins??state.coins} SIEGE COINS</h2><p>Cosmetics, additional weapons and operators will be added here. The starter build includes a shop layout, but no paid items are invented yet.</p></div>
 <div class="section-title">COMING TO THE ARMORY</div><div class="cards"><article class="feature-card"><h3>WEAPONS</h3><p>Expand your available weapon collection.</p></article><article class="feature-card"><h3>OPERATORS</h3><p>Unlock additional attack and defense operators.</p></article><article class="feature-card"><h3>COSMETICS</h3><p>Customize your operator and equipment.</p></article></div>`);
$("back-home").onclick=goHome;
$("open-practice")?.addEventListener("click",()=>{});
document.addEventListener("click",e=>{
 if(e.target.id==="open-practice")renderPage("PRACTICE","TRAINING GROUNDS",`
  <div class="cards"><article class="feature-card"><div class="eyebrow">AIM TRAINING</div><h3>GUN RANGE</h3><p>Practice shooting, recoil control and reloads against target dummies.</p><button class="primary" id="start-range">ENTER GUN RANGE</button></article><article class="feature-card"><div class="eyebrow">COMBAT TRAINING</div><h3>BOT MATCH</h3><p>Fight AI opponents in a small training arena. This is a local practice match.</p><button class="primary" id="start-bots">START BOT MATCH</button></article></div>`);
 if(e.target.id==="start-range")startMatch("range");
 if(e.target.id==="start-bots")startMatch("bots");
 if(e.target.id==="find-match")joinPublicRoom();
 if(e.target.id==="choose-attack")choose("Attack operator",["Scout","Medic","Breacher"],v=>state.attack=v);
 if(e.target.id==="choose-defense")choose("Defense operator",["Gorilla","Doc"],v=>state.defense=v);
 if(e.target.id==="choose-primary")choose("Primary weapon",["P90","SCAR","Pump Shotgun"],v=>state.primary=v);
 if(e.target.id==="choose-secondary")choose("Secondary weapon",["P90","SCAR","Pump Shotgun"],v=>state.secondary=v);
});
function choose(title,options,cb){$("panel-title").textContent=title.toUpperCase();$("panel-content").innerHTML=options.map(x=>`<button class="row full secondary" data-choice="${x}">${x}</button>`).join("");$("side-panel").classList.remove("hidden");$("panel-content").querySelectorAll("[data-choice]").forEach(b=>b.onclick=()=>{cb(b.dataset.choice);$("side-panel").classList.add("hidden");toast("Loadout updated.")})}
document.querySelectorAll("[data-panel]").forEach(b=>b.onclick=()=>openPanel(b.dataset.panel));
$("close-panel").onclick=()=>$("side-panel").classList.add("hidden");
function openPanel(which){
 $("side-panel").classList.remove("hidden");
 if(which==="friends"){
  $("panel-title").textContent="FRIENDS";
  $("panel-content").innerHTML=`<p class="muted">Search for friends by username. Friend requests are saved when Supabase is connected.</p><input id="friend-search" placeholder="Search username"><button class="primary full" id="search-friend">SEARCH</button><div class="section-title">YOUR FRIENDS</div><div id="friends-list"><p class="muted">${demo?"Local demo has no saved friends yet.":"Connect Supabase to load your friends."}</p></div>`;
  $("search-friend").onclick=async()=>{const name=$("friend-search").value.trim();if(!name)return;if(!sb||!user){toast("Friend search needs a connected account.");return}const {data,error}=await sb.from("profiles").select("id,username,level").ilike("username",name).limit(10);if(error){toast(error.message);return}if(!data?.length){$("friends-list").textContent="No players found.";return}$("friends-list").innerHTML=data.filter(x=>x.id!==user.id).map(x=>`<div class="row"><span>${escapeHtml(x.username)}<small>Level ${x.level}</small></span><button class="secondary" data-add="${x.id}">ADD</button></div>`).join("");$("friends-list").querySelectorAll("[data-add]").forEach(btn=>btn.onclick=()=>sendFriendRequest(btn.dataset.add))};
 }else if(which==="chat"){
  $("panel-title").textContent="CHAT";
  $("panel-content").innerHTML=`<p class="muted">Global and friend chat will be available when the social tables are configured. Lobby chat appears inside a room.</p><div class="data-card">No active conversation selected.</div>`;
 }else{
  $("panel-title").textContent="SETTINGS";
  $("panel-content").innerHTML=`<div class="section-title">CONTROLS</div><p class="muted">WASD move · Mouse aim · Click shoot · R reload · 1/2 switch weapons · 3 gadget · 4/5 team markers · Space ability · Q/E melee</p><div class="section-title">ACCOUNT</div><button class="danger full" id="logout">LOG OUT</button>`;
  $("logout").onclick=async()=>{if(sb)await sb.auth.signOut();demo=false;showAuth()};
 }
}
async function sendFriendRequest(id){if(!sb||!user)return;const {error}=await sb.from("friend_requests").insert({sender_id:user.id,receiver_id:id});toast(error?error.message:"Friend request sent.")}

async function joinPublicRoom(){
 if(!sb||!user){toast("Public matchmaking requires a connected Supabase account. Demo supports practice.");return}
 toast("Searching for a public lobby…");
 try{
  const {data,error}=await sb.rpc("join_public_room");if(error)throw error;
  currentRoom=data;renderPage("PUBLIC LOBBY","MATCHMAKING",`<div class="data-card"><div class="eyebrow">ROOM STATUS</div><h2>WAITING FOR OPERATORS</h2><p>Room code: <b>${escapeHtml(data.room_code||"")}</b></p><h2 id="room-count">1 / 10</h2><p>Matchmaking countdown: <b id="room-timer">60</b> seconds</p><div id="room-roster" class="section-title">PLAYERS CONNECTING…</div><div class="section-title">LOBBY CHAT</div><div id="lobby-chat" class="data-card" style="min-height:100px"></div><div class="row"><input id="lobby-message" placeholder="Message the lobby"><button class="primary" id="send-lobby">SEND</button></div><button class="danger" id="leave-room">LEAVE LOBBY</button></div>`);
  await subscribeRoom(data.id);
 }catch(err){toast(err.message||"Could not join a room")}
}
async function subscribeRoom(id){
 if(!sb)return;
 roomChannel=sb.channel("room:"+id,{config:{presence:{key:user.id},broadcast:{self:false}}});
 roomChannel.on("presence",{event:"sync"},()=>{const p=roomChannel.presenceState();const count=Object.keys(p).length;$("room-count").textContent=count+" / 10";$("room-roster").textContent=Object.values(p).flat().map(x=>x.username||"Operator").join(" · ")});
 roomChannel.on("broadcast",{event:"chat"},({payload})=>{const line=document.createElement("div");line.textContent=payload.username+": "+payload.message;$("lobby-chat").appendChild(line)});
 await roomChannel.subscribe(async status=>{if(status==="SUBSCRIBED")await roomChannel.track({username:profile.username,online_at:new Date().toISOString()})});
 $("send-lobby").onclick=async()=>{const message=$("lobby-message").value.trim();if(message){await roomChannel.send({type:"broadcast",event:"chat",payload:{username:profile.username,message}});$("lobby-message").value=""}};
 $("leave-room").onclick=async()=>{if(roomChannel)await sb.removeChannel(roomChannel);roomChannel=null;currentRoom=null;goHome()};
}
document.querySelectorAll("[data-panel]").forEach(b=>b.addEventListener("click",()=>{}));

/* Lightweight top-down practice combat. The online lobby is real-time; authoritative 5v5 combat is the next implementation milestone. */
let game=null,raf=0;
const canvas=$("game-canvas"),ctx=canvas.getContext("2d");
function startMatch(mode){
 $("game-shell").classList.add("hidden");$("match-screen").classList.remove("hidden");
 $("match-mode-label").textContent=mode==="range"?"GUN RANGE":"BOT MATCH";
 game={mode,player:{x:600,y:380,hp:100,angle:0,ammo:30,reserve:90,reload:0,weapon:0,kills:0,ability:3,flash:0},keys:{},mouse:{x:600,y:380,down:false},bullets:[],bots:[],targets:[],last:0,round:1,coins:0};
 for(let i=0;i<(mode==="range"?8:5);i++){let a=i*Math.PI*2/Math.max(1,(mode==="range"?8:5));let x=600+Math.cos(a)*260,y=380+Math.sin(a)*190;(mode==="range"?game.targets:game.bots).push({x,y,hp:mode==="range"?1:75,alive:true,cd:Math.random()*1.5})}
 window.addEventListener("keydown",keyDown);window.addEventListener("keyup",keyUp);canvas.addEventListener("mousemove",mouseMove);canvas.addEventListener("mousedown",mouseDown);canvas.addEventListener("mouseup",mouseUp);
 $("leave-match").onclick=leaveMatch;tick(0);
}
function keyDown(e){if(!game)return;game.keys[e.key.toLowerCase()]=true;if(e.key.toLowerCase()==="r")reload();if(e.key==="1")game.player.weapon=0;if(e.key==="2")game.player.weapon=1;if(e.key===" ")useAbility();if(e.key.toLowerCase()==="q"||e.key.toLowerCase()==="e")melee()}
function keyUp(e){if(game)game.keys[e.key.toLowerCase()]=false}
function mouseMove(e){const r=canvas.getBoundingClientRect();game.mouse.x=(e.clientX-r.left)*canvas.width/r.width;game.mouse.y=(e.clientY-r.top)*canvas.height/r.height}
function mouseDown(){if(game)game.mouse.down=true}function mouseUp(){if(game)game.mouse.down=false}
function reload(){if(game&&game.player.ammo<30&&game.player.reserve>0)game.player.reload=1.15}
function useAbility(){if(!game)return;if(game.mode==="bots"){game.player.hp=Math.min(100,game.player.hp+15);toast("Medic-style practice heal: +15 HP")}else toast("Ability practice: operator abilities are being wired into the full roster.")}
function melee(){if(!game)return;for(const b of game.bots){if(b.alive&&Math.hypot(b.x-game.player.x,b.y-game.player.y)<58){b.hp-=45;if(b.hp<=0)killBot(b)}}}
function killBot(b){b.alive=false;game.player.kills++;game.coins+=25;$("match-kills").textContent="KILLS "+game.player.kills}
function tick(t){if(!game)return;const dt=Math.min(.04,(t-game.last)/1000||0);game.last=t;update(dt);draw();raf=requestAnimationFrame(tick)}
function update(dt){
 const p=game.player,k=game.keys,speed=190;
 let dx=(k.d?1:0)-(k.a?1:0),dy=(k.s?1:0)-(k.w?1:0),len=Math.hypot(dx,dy)||1;
 p.x=Math.max(35,Math.min(1165,p.x+dx/len*speed*dt));p.y=Math.max(35,Math.min(725,p.y+dy/len*speed*dt));
 p.angle=Math.atan2(game.mouse.y-p.y,game.mouse.x-p.x);
 if(p.reload>0){p.reload-=dt;if(p.reload<=0){let n=Math.min(30-p.ammo,p.reserve);p.ammo+=n;p.reserve-=n}}
 if(game.mouse.down&&p.reload<=0){p.fire=(p.fire||0)-dt;if(p.fire<=0&&p.ammo>0){p.ammo--;p.fire=game.mode==="range"?.105:.14;game.bullets.push({x:p.x+Math.cos(p.angle)*20,y:p.y+Math.sin(p.angle)*20,vx:Math.cos(p.angle)*650,vy:Math.sin(p.angle)*650,life:1.2,damage:game.mode==="range"?1:25})}}
 for(const b of game.bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;for(const target of (game.mode==="range"?game.targets:game.bots)){if(target.alive&&Math.hypot(target.x-b.x,target.y-b.y)<19){target.hp-=b.damage;b.life=0;if(target.hp<=0){if(game.mode==="bots")killBot(target);else target.alive=false}break}}}
 game.bullets=game.bullets.filter(b=>b.life>0&&b.x>0&&b.x<1200&&b.y>0&&b.y<760);
 for(const b of game.bots){if(!b.alive)continue;b.cd-=dt;let d=Math.hypot(p.x-b.x,p.y-b.y);if(d>120){b.x+=(p.x-b.x)/d*45*dt;b.y+=(p.y-b.y)/d*45*dt}else if(b.cd<=0){p.hp-=8;b.cd=1.1;if(p.hp<=0){p.hp=0;$("match-message").textContent="YOU WERE ELIMINATED — RESET PRACTICE";game.bots.forEach(x=>x.alive=false)}}}
 $("match-health").textContent=Math.ceil(p.hp)+" HP";$("match-ammo").textContent=p.ammo+" / "+p.reserve;
}
function draw(){
 ctx.clearRect(0,0,1200,760);ctx.fillStyle="#27332d";ctx.fillRect(0,0,1200,760);
 ctx.strokeStyle="#3c4b40";ctx.lineWidth=2;for(let x=0;x<1200;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,760);ctx.stroke()}for(let y=0;y<760;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1200,y);ctx.stroke()}
 // training obstacles and target lanes
 ctx.fillStyle="#5b6257";[[0,0,1200,22],[0,738,1200,22],[0,0,22,760],[1178,0,22,760],[360,180,80,24],[760,540,110,28],[180,520,30,100],[920,170,35,110]].forEach(r=>ctx.fillRect(...r));
 for(const t of game.targets){if(!t.alive)continue;ctx.fillStyle="#d7c6a0";ctx.beginPath();ctx.arc(t.x,t.y,18,0,Math.PI*2);ctx.fill();ctx.fillStyle="#a63f36";ctx.fillRect(t.x-5,t.y-12,10,24)}
 for(const b of game.bots){if(!b.alive)continue;ctx.fillStyle="#b84b43";ctx.beginPath();ctx.arc(b.x,b.y,17,0,Math.PI*2);ctx.fill();ctx.fillStyle="#111";ctx.fillRect(b.x-20,b.y-28,40,5);ctx.fillStyle="#8ec28e";ctx.fillRect(b.x-20,b.y-28,40*Math.max(0,b.hp/75),5)}
 for(const b of game.bullets){ctx.fillStyle="#ffd27b";ctx.beginPath();ctx.arc(b.x,b.y,4,0,Math.PI*2);ctx.fill()}
 const p=game.player;
 // visibility cone, with full 360 awareness but obstacles not yet occluding
 ctx.fillStyle="#e2c27a";ctx.beginPath();ctx.arc(p.x,p.y,17,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#161b18";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+Math.cos(p.angle)*28,p.y+Math.sin(p.angle)*28);ctx.stroke();
 ctx.fillStyle="#fff";ctx.font="14px Inter";ctx.fillText("PRACTICE ARENA",28,45);ctx.fillStyle="#c4d0c5";ctx.font="11px Inter";ctx.fillText(game.mode==="range"?"SHOOT THE TARGETS":"ELIMINATE THE BOTS",28,64);
}
function leaveMatch(){cancelAnimationFrame(raf);window.removeEventListener("keydown",keyDown);window.removeEventListener("keyup",keyUp);canvas.removeEventListener("mousemove",mouseMove);canvas.removeEventListener("mousedown",mouseDown);canvas.removeEventListener("mouseup",mouseUp);game=null;$("match-screen").classList.add("hidden");$("game-shell").classList.remove("hidden");toast("Returned to menu.")}
showAuth();
})();