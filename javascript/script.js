document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. CONSTANTS & GLOBAL STATE
    // ==========================================
    // The Google Doc schedule is the single source of truth for show/DJ names.
    const SHEET_URL = 'https://opensheet.elk.sh/1OhiyukdiE9ZdmLHTI0nnnKosPXwnOXUJ4t5uh5c4HYE/Sheet1';

    let masterScheduleData = [];
    let currentMonday;
    let chatInitialized = false;


    // ==========================================
    // 2. INITIALIZATION
    // ==========================================

    init();
    setInterval(updateRadioData, 15000);

    function init() {
        initLinks();
        initAudioPlayer();
        updateRadioData();
        loadGlobalSchedule();
        initSchedule();
        loadPastShows();
        initChat();
    }

    // ==========================================
    // 3. RADIO PLAYER FUNCTIONS
    // ==========================================

    function initAudioPlayer() {
        const playButton = document.getElementById('play-pause-btn');
        const audioStream = document.getElementById('radio-stream');
        if (!playButton || !audioStream) return;
        const streamUrl = audioStream.src;

        playButton.classList.toggle('is-playing', !audioStream.paused);
        
        playButton.addEventListener('click', () => {
            if (audioStream.paused) {
                // 1. Re-attach the stream URL right BEFORE playing to guarantee the live edge
                audioStream.src = streamUrl;
                audioStream.load(); 
                audioStream.play();
            } else {
                // 2. Pause the stream
                audioStream.pause();
                
                // 3. Completely wipe the source so the browser stops downloading dead data
                audioStream.removeAttribute('src'); 
                audioStream.load(); 
            }
            playButton.classList.toggle('is-playing', !audioStream.paused);
        });
    }

    async function updateRadioData() {
        if (!document.getElementById('play-pause-btn')) return;
        try {
            const response = await fetch('https://radiomantis.com/api/nowplaying/2', { cache: 'no-store' });            
            const radioData = await response.json();

            // Check if a DJ is actively broadcasting
            if (radioData.live && radioData.live.is_live) {
                const streamerAccount = radioData.live.streamer_name || "unknown";
                setOnlineState(streamerAccount);
            } else {
                if (shouldBeWaiting()) {
                    setStandbyState();
                } else {
                    setOfflineState();
                }
            }

        } catch (error) {
            console.error("Couldn't fetch radio data. Defaulting to offline.", error);
            setOfflineState(); 
        }
    }

    function setOnlineState(streamerAccount) {
        const playButton = document.getElementById('play-pause-btn');
        const statusLabel = document.getElementById('status-label');
        const mainText = document.getElementById('main-player-text');
        if (!playButton || !statusLabel || !mainText) return;

        playButton.style.visibility = 'visible';
        statusLabel.textContent = "now playing";

        // Look up whatever show is scheduled for right now in the Google Doc.
        // Fall back to the raw AzuraCast streamer handle if nothing matches.
        const activeShow = getCurrentShow();
        const host = (activeShow && activeShow.DJ) ? activeShow.DJ : streamerAccount;
        const title = (activeShow && activeShow.Show) ? activeShow.Show : host;

        if (activeShow && activeShow.Show) {
            mainText.textContent = `${activeShow.Show} w/ ${host}`.toLowerCase();
        } else {
            mainText.textContent = `${host}`.toLowerCase();
        }
        // add the player info to lock screen
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: activeShow ? host : "Radiomantis",
                artwork: [
                    { src: 'css/pictures/maskable-icon.png', sizes: '512x512', type: 'image/webp' }
                ]
            });
        }
    }

    function setOfflineState() {
        const playButton = document.getElementById('play-pause-btn');
        const audioStream = document.getElementById('radio-stream');
        const statusLabel = document.getElementById('status-label');
        const mainText = document.getElementById('main-player-text');
        if (!playButton || !audioStream || !statusLabel || !mainText) return;

        playButton.style.visibility = 'hidden';
        
        // Force pause the audio if they were listening when the DJ logged off
        if (!audioStream.paused) {
            audioStream.pause();
            playButton.classList.remove('is-playing');
        }
        
        statusLabel.textContent = "offline";
        mainText.textContent = "check the schedule for upcoming shows";
    }

    function setStandbyState() {
        const playButton = document.getElementById('play-pause-btn');
        const statusLabel = document.getElementById('status-label');
        const mainText = document.getElementById('main-player-text');
        if (!playButton || !statusLabel || !mainText) return;

        playButton.style.visibility = 'visible'; 
        
        statusLabel.textContent = "standby";
        mainText.textContent = "new set starting soon...";
    }

    // ==========================================
    // 4. SCHEDULE FUNCTIONS
    // ==========================================
    async function loadGlobalSchedule() {
        try {
            const response = await fetch(SHEET_URL);
            masterScheduleData = await response.json();
            
            // If they happen to be on the schedule page, draw it now that we have data
            if (document.getElementById('schedule-container')) {
                renderWeek();
            }
        } catch (error) {
            console.error("Schedule fetch error:", error);
        }
    }

    function initSchedule() {
        if (!document.getElementById('schedule-container')) return;

        currentMonday = getMonday(new Date());
        
        const prevBtn = document.getElementById('prev-week-btn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                currentMonday.setDate(currentMonday.getDate() - 7);
                renderWeek();
            });
        }

        const nextBtn = document.getElementById('next-week-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                currentMonday.setDate(currentMonday.getDate() + 7);
                renderWeek();
            });
        }
    }

    async function loadSchedule() {
        const scheduleContainer = document.getElementById('schedule-container');
        if (!scheduleContainer) return;

        try {
            const response = await fetch(SHEET_URL);
            masterScheduleData = await response.json();
            renderWeek();
        } catch (error) {
            scheduleContainer.innerHTML = "<p>Couldn't load the schedule. Please try again later.</p>";
            console.error("Schedule fetch error:", error);
        }
    }

    function renderWeek() {
        const scheduleContainer = document.getElementById('schedule-container');
        const weekLabel = document.getElementById('week-label');
        if (!scheduleContainer || !weekLabel) return;

        scheduleContainer.innerHTML = ''; // Clear out the old HTML
        
        // Calculate the Sunday of this week for the label
        const currentSunday = new Date(currentMonday);
        currentSunday.setDate(currentMonday.getDate() + 6);
        
        // Format label: e.g., "Apr 6 - Apr 12"
        const formatOptions = { month: 'short', day: 'numeric' };
        weekLabel.textContent = `${currentMonday.toLocaleDateString('en-US', formatOptions)} - ${currentSunday.toLocaleDateString('en-US', formatOptions)}`;

        // Loop through 7 days of the week (0 = Monday, 6 = Sunday)
        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(currentMonday);
            currentDate.setDate(currentMonday.getDate() + i);
            
            // Get string formats for matching ("Monday" and "2026-04-06")
            const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            const dateString = `${year}-${month}-${day}`

            // Filter the master data for shows happening on this specific date
            const daysShows = masterScheduleData.filter(show => {
                // Rule 1: Does it have a specific Date that matches today?
                if (show.Date && show.Date === dateString) return true;
                // Rule 2: Does it have NO specific date, but the Day matches?
                if ((!show.Date || show.Date.trim() === "") && show.Day === dayName) return true;
                return false;
            });

            // If there are shows today, sort them by start time and build the HTML
            if (daysShows.length > 0) {
                
                // Sort by start time (e.g., "12:00" comes before "16:00")
                daysShows.sort((a, b) => a.Start.localeCompare(b.Start));

                // Create the Day Header
                let dayHtml = `
                    <div class="schedule-day-group">
                        <div class="schedule-day-title">${dayName}, ${currentDate.toLocaleDateString('en-US', formatOptions)}</div>
                `;
               
                // Add each show row
                daysShows.forEach(show => {
                    dayHtml += `
                        <div class="schedule-row">
                            <div class="schedule-time">${show.Start} - ${show.End}</div>
                            <div class="schedule-info">${show.Show ? `${show.Show} w/ ` : ''}${show.DJ}</div>
                        </div>
                    `;
                });

                dayHtml += `</div>`; // Close the group
                scheduleContainer.insertAdjacentHTML('beforeend', dayHtml);
            }
        }
        
        // If the entire week is completely empty
        if (scheduleContainer.innerHTML === '') {
            scheduleContainer.innerHTML = '<p style="font-size: 24px; text-align: center; margin-top: 40px;">No shows scheduled for this week.</p>';
        }
    }

    // ==========================================
    // 5. UTILITY FUNCTIONS
    // ==========================================

    // Find the Monday of whatever Date is passed to it
    function getMonday(d) {
        d = new Date(d);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        return new Date(d.setDate(diff));
    }
// The current time in the radio's timezone. Both schedule lookups key off this.
    function getNowInCopenhagen() {
        return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Copenhagen" }));
    }

    // Resolves a schedule row into concrete { startTime, endTime } Date objects for
    // the occurrence relevant to `now` — today, or yesterday for overnight shows that
    // run past midnight. Returns null if the row isn't airing on either of those days.
    function getShowWindow(show, now) {
        if (!show.Start || !show.End) return null;

        const currentDayName = now.toLocaleDateString('en-US', { weekday: 'long' });

        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayName = yesterday.toLocaleDateString('en-US', { weekday: 'long' });

        const dateStringToday = now.toISOString().split('T')[0];
        const dateStringYesterday = yesterday.toISOString().split('T')[0];

        let showDateObj = null;
        if ((show.Date && show.Date === dateStringToday) ||
            ((!show.Date || show.Date.trim() === "") && show.Day === currentDayName)) {
            showDateObj = new Date(now); // Base it on today
        } else if ((show.Date && show.Date === dateStringYesterday) ||
                   ((!show.Date || show.Date.trim() === "") && show.Day === yesterdayName)) {
            showDateObj = new Date(yesterday); // Base it on yesterday (overnight show)
        }

        if (!showDateObj) return null;

        const [startH, startM] = show.Start.split(':').map(Number);
        const [endH, endM] = show.End.split(':').map(Number);

        const startTime = new Date(showDateObj);
        startTime.setHours(startH, startM, 0, 0);

        const endTime = new Date(showDateObj);
        if (endH === 0 && endM === 0) {
            endTime.setDate(endTime.getDate() + 1); // Midnight end = next day
        } else {
            endTime.setHours(endH, endM, 0, 0);
        }

        return { startTime, endTime };
    }

    // Returns the schedule row currently on air, or null. Used to name the live show.
    function getCurrentShow() {
        if (!masterScheduleData || masterScheduleData.length === 0) return null;

        const now = getNowInCopenhagen();
        for (const show of masterScheduleData) {
            const window = getShowWindow(show, now);
            if (window && now >= window.startTime && now <= window.endTime) {
                return show;
            }
        }
        return null;
    }

    // True if a show is on air, or is within 15 minutes of starting or having ended.
    function shouldBeWaiting() {
        if (!masterScheduleData || masterScheduleData.length === 0) return false;

        const now = getNowInCopenhagen();
        for (const show of masterScheduleData) {
            const window = getShowWindow(show, now);
            if (!window) continue;

            const minsUntilStart = (window.startTime - now) / (1000 * 60);
            const minsSinceEnd = (now - window.endTime) / (1000 * 60);

            const isDuringShow = now >= window.startTime && now <= window.endTime;
            const isStartingSoon = minsUntilStart <= 15 && minsUntilStart > 0;
            const justEnded = minsSinceEnd <= 15 && minsSinceEnd >= 0;

            if (isDuringShow || isStartingSoon || justEnded) {
                return true;
            }
        }
        return false;
    }
 
    // ==========================================
    // 6. NAVIGATION
    // ==========================================

    window.addEventListener("popstate", loadPage);

    async function loadPage() {
        const newDocument = await new Promise((res, rej) => {
            const req = new XMLHttpRequest();
            req.open("GET", window.location.href);
            req.responseType = "document";
            req.onreadystatechange = () => {
                if (req.readyState !== XMLHttpRequest.DONE) return;
                if (req.status < 200 || 300 <= req.status) {
                    history.go();
                    rej();
                }
                res(req.responseXML);
            };
            req.send();
        });
        const newFrame = newDocument.querySelector("#app-frame");
        if (newFrame === null) {
            history.go();
            return;
        }
        const oldFrame = document.querySelector("#app-frame");
        oldFrame.replaceWith(newFrame);
        document.title = newDocument.title;
        init();
    }

    // ==========================================
    // 7. PAST SHOWS (MIXCLOUD API)
    // ==========================================

    async function loadPastShows() {
        const container = document.getElementById('past-shows-container');
        // Only run if we are on the past shows page
        if (!container) return; 

        try {
            // limited to 200 most recent this can be upped though
            const response = await fetch('https://api.mixcloud.com/radiomantis/cloudcasts/?limit=200');
            const mixcloudData = await response.json();

            container.innerHTML = ''; 

            // Loop through the shows Mixcloud gives us
            mixcloudData.data.forEach(show => {

                const imageUrl = show.pictures.large;
                //removes date from the end if there
                showName = show.name.split(' - ')[0]
                showDate = show.name.split(' - ')[1]
                
                
                // Build the HTML for the specific show
                const showHtml = `
                    <a href="${show.url}" target="_blank" class="show-item">
                        <img src="${imageUrl}" alt="${showName}" loading="lazy">
                        <p>${showName}</p>
                        <span class="show-date">${showDate}</span>
                    </a>
                `;

                container.insertAdjacentHTML('beforeend', showHtml);
            });

        } catch (error) {
            console.error("Couldn't fetch past shows from Mixcloud:", error);
            container.innerHTML = "<p>Couldn't load past shows. Please check our Mixcloud page directly.</p>";
        }
    }

    function initLinks() {
        document.querySelectorAll('a[href^="/"]').forEach((link) => {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                history.pushState(null, "", link.href);
                loadPage();
            });
        });
    }

    // ==========================================
    // 8. LIVE CHAT (WebSocket)
    // ==========================================
    // The drawer lives outside #app-frame, so it survives SPA page-swaps. This runs
    // once (guarded by chatInitialized, declared with the top-level state) and keeps a
    // single WebSocket alive across navigation.

    function initChat() {
        if (chatInitialized) return; // don't re-bind / reconnect on every page nav
        const drawer = document.getElementById('chat-drawer');
        const toggle = document.getElementById('chat-toggle');
        if (!drawer || !toggle) return;
        chatInitialized = true;

        const NICK_KEY = 'radiomantis-chat-nick';
        const log = document.getElementById('chat-log');
        const status = document.getElementById('chat-status');
        const msgForm = document.getElementById('chat-form');
        const msgInput = document.getElementById('chat-input');
        const nickForm = document.getElementById('chat-nick-form');
        const nickInput = document.getElementById('chat-nick-input');
        const closeBtn = document.getElementById('chat-close');

        // Moderator access: visit the site with ?admin=<token> once; it's kept in
        // sessionStorage so it survives SPA navigation (which drops the query string).
        const ADMIN_KEY = 'radiomantis-chat-admin';
        const urlAdmin = new URLSearchParams(location.search).get('admin');
        if (urlAdmin) sessionStorage.setItem(ADMIN_KEY, urlAdmin);
        const adminToken = sessionStorage.getItem(ADMIN_KEY);

        const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
        const base = isLocal
            ? `ws://${location.hostname}:8081/chat`
            : `wss://${location.host}/chat`;
        const CHAT_URL = adminToken ? `${base}?token=${encodeURIComponent(adminToken)}` : base;

        let ws = null;
        let nick = localStorage.getItem(NICK_KEY) || '';
        let reconnectDelay = 1000;

        // ---- rendering (always textContent — never innerHTML — so messages can't inject) ----
        function atBottom() {
            return log.scrollHeight - log.scrollTop - log.clientHeight < 40;
        }
        function trimLog() {
            while (log.childNodes.length > 200) log.removeChild(log.firstChild);
        }
        function addMessage(nickName, text, ts) {
            const stick = atBottom();
            const row = document.createElement('div');
            row.className = 'chat-msg';
            const time = document.createElement('span');
            time.className = 'chat-msg-time';
            if (ts) {
                const d = new Date(ts);
                // Formatted in the VIEWER's local timezone — the ts is absolute.
                time.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                time.title = d.toLocaleString();
            }
            const who = document.createElement('span');
            who.className = 'chat-msg-nick';
            if (nickName === nick) who.classList.add('chat-msg-nick--me'); 
            who.textContent = nickName + ":";
            const body = document.createElement('span');
            body.className = 'chat-msg-text';
            body.textContent = text;
            row.append(time, who, body);
            log.appendChild(row);
            trimLog();
            if (stick) log.scrollTop = log.scrollHeight;
        }
        function addSystem(text) {
            const stick = atBottom();
            const row = document.createElement('div');
            row.className = 'chat-msg chat-msg--system';
            row.textContent = text;
            log.appendChild(row);
            trimLog();
            if (stick) log.scrollTop = log.scrollHeight;
        }

        // ---- nickname gate ----
        function applyNickState() {
            drawer.classList.toggle('needs-nick', !nick);
            document.getElementById('chat-title').textContent = nick ? `Chat · ${nick}` : 'chat';
        }

        // ---- connection ----
        function connect() {
            status.textContent = 'connecting…';
            try {
                ws = new WebSocket(CHAT_URL);
            } catch (err) {
                scheduleReconnect();
                return;
            }
            ws.addEventListener('open', () => {
                reconnectDelay = 1000;
                status.textContent = '';
                status.classList.add('is-hidden');
                if (nick) ws.send(JSON.stringify({ type: 'join', nick }));
            });
            ws.addEventListener('message', (e) => {
                let data;
                try { data = JSON.parse(e.data); } catch { return; }
                if (data.type === 'history' && Array.isArray(data.messages)) {
                    log.textContent = '';
                    data.messages.forEach((m) => addMessage(m.nick, m.text, m.ts));
                    log.scrollTop = log.scrollHeight;
                } else if (data.type === 'msg') {
                    addMessage(data.nick, data.text, data.ts);
                } else if (data.type === 'system') {
                    addSystem(data.text);
                } else if (data.type === 'clear') {
                    log.textContent = '';
                }
            });
            ws.addEventListener('close', scheduleReconnect);
            ws.addEventListener('error', () => { try { ws.close(); } catch (e) {} });
        }
        function scheduleReconnect() {
            status.classList.remove('is-hidden');
            status.textContent = 'reconnecting…';
            setTimeout(connect, reconnectDelay);
            reconnectDelay = Math.min(reconnectDelay * 2, 15000);
        }

        // ---- events ----
        toggle.addEventListener('click', () => {
            const open = drawer.classList.toggle('open');
            drawer.setAttribute('aria-hidden', String(!open));
            toggle.setAttribute('aria-expanded', String(open));
            if (open) (nick ? msgInput : nickInput).focus();
        });
        closeBtn.addEventListener('click', () => {
            drawer.classList.remove('open');
            drawer.setAttribute('aria-hidden', 'true');
            toggle.setAttribute('aria-expanded', 'false');
        });
        nickForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const value = nickInput.value.trim().slice(0, 24);
            if (!value) return;
            nick = value;
            localStorage.setItem(NICK_KEY, nick);
            applyNickState();
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'join', nick }));
            }
            msgInput.focus();
        });
        msgForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = msgInput.value.trim();
            if (!text || !nick) return;
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'msg', text }));
            }
            msgInput.value = '';
        });

        applyNickState();
        connect();
    }
});
