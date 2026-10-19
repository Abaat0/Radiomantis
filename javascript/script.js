document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. CONSTANTS & GLOBAL STATE
    // ==========================================
    // The Google Doc schedule is the single source of truth for show/DJ names.
    const SHEET_URL = 'https://opensheet.elk.sh/1OhiyukdiE9ZdmLHTI0nnnKosPXwnOXUJ4t5uh5c4HYE/Sheet1';

    const SCHEDULE_MAX_AGE_MS = 10 * 60 * 1000; // re-fetch the sheet at most every 10 minutes
    const PAST_SHOWS_PAGE = 24;                  // how many Mixcloud shows to load at a time

    let masterScheduleData = [];
    let scheduleFetchedAt = 0;
    let schedulePromise = null;
    let scheduleError = false;
    let chatInitialized = false;
    // Past shows are cached for the whole visit, so going back to the page doesn't refetch.
    let pastShows = [];
    let pastShowsNext = 'https://api.mixcloud.com/radiomantis/cloudcasts/?limit=' + PAST_SHOWS_PAGE;
    let pastShowsLoading = false;
    let pastShowsPromise = null;


    // ==========================================
    // 2. INITIALIZATION
    // ==========================================

    initOnce();
    init();

    // Poll now-playing every 15s, but not while the tab is in the background.
    setInterval(() => {
        if (document.visibilityState === 'visible') updateRadioData();
    }, 15000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') updateRadioData();
    });

    // Things outside #app-frame (strip, header, footer, chat): set up once per visit
    function initOnce() {
        initLinks(document.querySelector('.site-header'));
        initLinks(document.querySelector('.site-footer'));
        initMenu();
        initAudioPlayer();
        initChat();
        updateRadioData();
    }

    // Things inside #app-frame: set up again after every page change
    function init() {
        initLinks(document.getElementById('app-frame'));
        setCurrentNav();
        setTimezoneNote();
        loadGlobalSchedule();
        loadPastShows();
        loadLatestShows();
    }

    // Underline the menu link for the page we're on
    function setCurrentNav() {
        const here = normalizePath(window.location.pathname);
        document.querySelectorAll('.site-nav a.nav-link[href^="/"]').forEach((link) => {
            if (normalizePath(new URL(link.href).pathname) === here) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
    }
    function normalizePath(path) {
        return path.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/(.)\/$/, '$1') || '/';
    }

    // Mobile menu
    function initMenu() {
        const toggle = document.getElementById('menu-toggle');
        const nav = document.getElementById('site-nav');
        if (!toggle || !nav) return;
        toggle.addEventListener('click', () => setMenuOpen(!nav.classList.contains('is-open')));
        nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenuOpen(false); });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenuOpen(false); toggle.focus(); }
        });
    }
    function setMenuOpen(open) {
        const toggle = document.getElementById('menu-toggle');
        const nav = document.getElementById('site-nav');
        if (!toggle || !nav) return;
        nav.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.textContent = open ? 'close' : 'menu';
    }

    // ==========================================
    // 3. RADIO PLAYER FUNCTIONS
    // ==========================================

    function initAudioPlayer() {
        const playButton = document.getElementById('play-pause-btn');
        const audioStream = document.getElementById('radio-stream');
        if (!playButton || !audioStream) return;

        // Remember the stream URL across SPA navigations, since pausing removes the src attribute
        if (audioStream.src) audioStream.dataset.stream = audioStream.src;
        const streamUrl = audioStream.dataset.stream;

        syncPlayButton();
        
        playButton.addEventListener('click', () => {
            if (audioStream.paused) {
                // 1. Re-attach the stream URL right BEFORE playing to guarantee the live edge
                audioStream.src = streamUrl;
                audioStream.load(); 
                audioStream.play()
                    .catch((err) => console.error("Couldn't start the stream:", err))
                    .finally(syncPlayButton);
            } else {
                // 2. Pause the stream
                audioStream.pause();
                
                // 3. Completely wipe the source so the browser stops downloading dead data
                audioStream.removeAttribute('src'); 
                audioStream.load(); 
            }
            syncPlayButton();
        });
    }

    // Keep the button's look and its screen-reader label in step with the audio
    function syncPlayButton() {
        const playButton = document.getElementById('play-pause-btn');
        const audioStream = document.getElementById('radio-stream');
        if (!playButton || !audioStream) return;
        const playing = !audioStream.paused;
        playButton.classList.toggle('is-playing', playing);
        // Lets the page react while the stream plays (the mantis dances, the colours drift)
        document.documentElement.toggleAttribute('data-playing', playing);
        playButton.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    }

    async function updateRadioData() {
        if (!document.getElementById('onair')) return;
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

    // The strip's colour and dot follow the state: live, standby or offline
    function setStripState(state, label, text) {
        const strip = document.getElementById('onair');
        const playButton = document.getElementById('play-pause-btn');
        const statusLabel = document.getElementById('status-label');
        const mainText = document.getElementById('main-player-text');
        if (!strip || !playButton || !statusLabel || !mainText) return;
        strip.dataset.state = state;
        playButton.hidden = state === 'offline';
        if (statusLabel.textContent !== label) statusLabel.textContent = label;
        mainText.textContent = text;
        mainText.title = text;
    }

    function setOnlineState(streamerAccount) {
        // Look up whatever show is scheduled for right now in the Google Doc.
        // Fall back to the raw AzuraCast streamer handle if nothing matches.
        const activeShow = getCurrentShow();
        const host = (activeShow && activeShow.DJ) ? activeShow.DJ : streamerAccount;
        const title = (activeShow && activeShow.Show) ? activeShow.Show : host;

        const text = (activeShow && activeShow.Show) ? `${activeShow.Show} w/ ${host}` : `${host}`;
        setStripState('live', 'live', text.toLowerCase());

        // add the player info to lock screen
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: activeShow ? host : "Radiomantis",
                artwork: [
                    { src: '/css/pictures/maskable-icon.png', sizes: '512x512', type: 'image/png' }
                ]
            });
        }
    }

    function setOfflineState() {
        const audioStream = document.getElementById('radio-stream');
        // Force pause the audio if they were listening when the DJ logged off
        if (audioStream && !audioStream.paused) {
            audioStream.pause();
            audioStream.removeAttribute('src');
            audioStream.load();
        }
        syncPlayButton();

        const next = getUpcomingShows(1).find((o) => o.start > new Date());
        const text = next
            ? `next: ${showLabel(next.show)}, ${formatWhen(next.start)}`
            : 'off air for now';
        setStripState('offline', 'off air', text.toLowerCase());
    }

    function setStandbyState() {
        setStripState('standby', 'standby', 'new set starting soon…');
    }

    // "sangwich show w/ splenda", or just the DJ when there's no show name
    function showLabel(show) {
        return show.Show ? `${show.Show} w/ ${show.DJ || ''}`.trim() : (show.DJ || '');
    }

    // "today 18:00", "tomorrow 21:00", "friday 20:00" in the listener's timezone
    function formatWhen(date) {
        const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, numberingSystem: 'latn' });
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const that = new Date(date); that.setHours(0, 0, 0, 0);
        const days = Math.round((that - today) / 86400000);
        if (days === 0) return `today ${time}`;
        if (days === 1) return `tomorrow ${time}`;
        return `${date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()} ${time}`;
    }

    // ==========================================
    // 4. SCHEDULE FUNCTIONS
    // ==========================================
    // Fetches the sheet once and reuses it across page changes; refreshes when older
    // than SCHEDULE_MAX_AGE_MS. Concurrent callers share one request.
    function loadGlobalSchedule() {
        const fresh = scheduleFetchedAt && (Date.now() - scheduleFetchedAt < SCHEDULE_MAX_AGE_MS);
        if (fresh) {
            renderScheduleViews();
            return Promise.resolve(masterScheduleData);
        }
        if (!schedulePromise) {
            schedulePromise = fetch(SHEET_URL)
                .then((response) => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                })
                .then((rows) => {
                    masterScheduleData = Array.isArray(rows) ? rows : [];
                    scheduleFetchedAt = Date.now();
                    scheduleError = false;
                    // The player may have checked before the sheet arrived; name the show now
                    updateRadioData();
                })
                .catch((error) => {
                    scheduleError = true;
                    console.error("Schedule fetch error:", error);
                })
                .finally(() => { schedulePromise = null; });
        }
        return schedulePromise.then(() => {
            // Draw whatever schedule views this page has, now that we have data
            renderScheduleViews();
            return masterScheduleData;
        });
    }

    function renderScheduleViews() {
        if (document.getElementById('up-next-list')) renderUpNext();
    }

    // Every scheduled slot from yesterday to a week ahead, as real moments in time,
    // sorted. Sheet times are Copenhagen wall-clock (see cphWallToDate).
    function getUpcomingShows(limit = 3) {
        const now = new Date();
        const cph = getNowInCopenhagen();
        const occurrences = [];
        for (let offset = -1; offset <= 7; offset++) {
            const day = new Date(cph.getFullYear(), cph.getMonth(), cph.getDate() + offset);
            const y = day.getFullYear(), m = day.getMonth(), d = day.getDate();
            const dayName = day.toLocaleDateString('en-US', { weekday: 'long' });
            const dateString = localDateString(day);
            masterScheduleData.forEach((show) => {
                if (!show.Start || !show.End) return;
                const dated = show.Date && show.Date.trim() !== '';
                if (dated ? show.Date !== dateString : show.Day !== dayName) return;
                const [sh, sm] = show.Start.split(':').map(Number);
                const [eh, em] = show.End.split(':').map(Number);
                const start = cphWallToDate(y, m, d, sh, sm);
                const end = (eh === 0 && em === 0) ? cphWallToDate(y, m, d + 1, 0, 0) : cphWallToDate(y, m, d, eh, em);
                if (end > now) occurrences.push({ show, start, end, live: start <= now });
            });
        }
        occurrences.sort((a, b) => a.start - b.start);
        return occurrences.slice(0, limit);
    }

    // Home: the next five shows (this is the whole schedule now)
    function renderUpNext() {
        const list = document.getElementById('up-next-list');
        if (!list) return;
        list.textContent = '';
        const upcoming = getUpcomingShows(5);
        if (!upcoming.length) {
            const li = document.createElement('li');
            li.className = 'up-next-empty';
            li.textContent = scheduleError
                ? "Couldn't load the schedule. Try again in a minute."
                : 'Nothing scheduled this week yet. Follow us on Instagram for new shows.';
            list.appendChild(li);
            return;
        }
        upcoming.forEach(({ show, start, live }) => {
            const li = document.createElement('li');
            li.className = 'up-next-item' + (live ? ' is-live' : '');
            const when = document.createElement('span');
            when.className = 'up-next-when';
            when.textContent = live ? 'now' : formatWhen(start);
            const what = document.createElement('span');
            what.className = 'up-next-what';
            what.textContent = show.Show || show.DJ || '';
            if (show.Show && show.DJ) {
                const dj = document.createElement('span');
                dj.className = 'up-next-dj';
                dj.textContent = ` w/ ${show.DJ}`;
                what.appendChild(dj);
            }
            li.append(when, what);
            list.appendChild(li);
        });
    }

    // Under "up next": say which timezone the times are in
    function setTimezoneNote() {
        const tzNote = document.getElementById('tz-note');
        if (!tzNote) return;
        const abbr = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
        tzNote.textContent = `Times are in your timezone (${abbr}).`;
    }

    // ==========================================
    // 5. UTILITY FUNCTIONS
    // ==========================================

    // "2026-04-06" from a Date's local fields
    function localDateString(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // The schedule sheet's Start/End are Europe/Copenhagen wall-clock times. These helpers
    // convert them to the viewer's local timezone, correctly across DST (CET vs CEST).

    // Minutes to ADD to a UTC instant to get the wall-clock time in `tz`.
    function tzOffsetMinutes(date, tz) {
        const dtf = new Intl.DateTimeFormat('en-US', {
            timeZone: tz, hour12: false,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        const p = {};
        for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
        const hour = p.hour === '24' ? 0 : Number(p.hour);
        const asUTC = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), hour, Number(p.minute), Number(p.second));
        return (asUTC - date.getTime()) / 60000;
    }

    // Absolute Date for a Copenhagen wall-clock time on a given calendar day.
    function cphWallToDate(year, monthIndex, day, hh, mm) {
        const guessUTC = Date.UTC(year, monthIndex, day, hh, mm);
        const offset = tzOffsetMinutes(new Date(guessUTC), 'Europe/Copenhagen');
        return new Date(guessUTC - offset * 60000);
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

        // `now` holds Copenhagen wall-clock time in local fields, so format those fields
        // directly; toISOString() would convert to UTC and give the wrong day near midnight.
        const dateStringToday = localDateString(now);
        const dateStringYesterday = localDateString(yesterday);

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

    window.addEventListener("popstate", () => loadPage({ focus: false }));

    // Swap #app-frame for the new page's, so the <audio> and chat outside it keep going.
    async function loadPage({ focus = true } = {}) {
        const url = window.location.href;
        let newDocument;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            newDocument = new DOMParser().parseFromString(html, 'text/html');
        } catch (error) {
            // Anything unexpected: fall back to a normal page load
            window.location.href = url;
            return;
        }
        const newFrame = newDocument.querySelector("#app-frame");
        if (newFrame === null) {
            window.location.href = url;
            return;
        }
        const oldFrame = document.querySelector("#app-frame");
        oldFrame.replaceWith(document.importNode(newFrame, true));
        document.title = newDocument.title;
        document.documentElement.dataset.page = newDocument.documentElement.dataset.page || '';
        init();

        if (focus) {
            window.scrollTo(0, 0);
            // Move keyboard / screen-reader focus to the new page's heading
            const heading = document.querySelector('#app-frame h1') || document.getElementById('app-frame');
            if (heading) {
                heading.setAttribute('tabindex', '-1');
                heading.focus({ preventScroll: true });
            }
        }
    }

    // ==========================================
    // 7. PAST SHOWS (MIXCLOUD API)
    // ==========================================

    function loadPastShows() {
        const container = document.getElementById('past-shows-container');
        // Only run if we are on the past shows page
        if (!container) return; 

        container.textContent = '';
        if (pastShows.length) {
            pastShows.forEach((show) => container.appendChild(buildShowCard(show)));
            renderMoreButton(container);
        } else {
            const loading = document.createElement('p');
            loading.className = 'past-shows-loading';
            loading.textContent = 'Loading transmissions...';
            container.appendChild(loading);
            fetchMorePastShows(container);
        }
    }

    // Fetch the next page from Mixcloud into the cache. Returns the new shows.
    function fetchPastShowsPage() {
        if (!pastShowsNext) return Promise.resolve([]);
        if (pastShowsPromise) return pastShowsPromise;
        pastShowsLoading = true;
        pastShowsPromise = fetch(pastShowsNext)
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then((mixcloudData) => {
                const batch = Array.isArray(mixcloudData.data) ? mixcloudData.data : [];
                pastShowsNext = (mixcloudData.paging && mixcloudData.paging.next) || null;
                pastShows = pastShows.concat(batch);
                return batch;
            })
            .finally(() => { pastShowsLoading = false; pastShowsPromise = null; });
        return pastShowsPromise;
    }

    async function fetchMorePastShows(container) {
        if (pastShowsLoading || !pastShowsNext) return;
        const button = document.getElementById('past-shows-more');
        if (button) { button.disabled = true; button.textContent = 'loading…'; }
        try {
            const batch = await fetchPastShowsPage();
            // The page may have changed while we waited
            if (document.getElementById('past-shows-container') === container) {
                const loading = container.querySelector('.past-shows-loading');
                if (loading) loading.remove();
                batch.forEach((show) => container.appendChild(buildShowCard(show)));
                if (!pastShows.length) {
                    const p = document.createElement('p');
                    p.textContent = 'No past transmissions yet.';
                    container.appendChild(p);
                }
                renderMoreButton(container);
            }
        } catch (error) {
            console.error("Couldn't fetch past shows from Mixcloud:", error);
            if (!pastShows.length && document.getElementById('past-shows-container') === container) {
                container.textContent = '';
                const p = document.createElement('p');
                p.textContent = "Couldn't load past shows. Listen back on our Mixcloud page instead.";
                container.appendChild(p);
            }
        } finally {
            const btn = document.getElementById('past-shows-more');
            if (btn) { btn.disabled = false; btn.textContent = 'load more'; }
        }
    }

    // Home: the four newest shows
    async function loadLatestShows() {
        const container = document.getElementById('latest-shows');
        if (!container) return;
        try {
            if (!pastShows.length) await fetchPastShowsPage();
        } catch (error) {
            console.error("Couldn't fetch latest shows from Mixcloud:", error);
        }
        if (document.getElementById('latest-shows') !== container) return;
        container.textContent = '';
        if (!pastShows.length) {
            const p = document.createElement('p');
            p.textContent = 'Listen back to past shows on our Mixcloud page.';
            container.appendChild(p);
            return;
        }
        pastShows.slice(0, 4).forEach((show) => container.appendChild(buildShowCard(show)));
    }

    // One card, built with textContent so show names can't inject HTML
    function buildShowCard(show) {
        // Names look like "Show name - date"; split off the date if there is one
        const [showName, ...rest] = (show.name || '').split(' - ');
        const showDate = rest.join(' - ');

        const link = document.createElement('a');
        link.className = 'show-item';
        link.href = show.url;
        link.target = '_blank';
        link.rel = 'noopener';

        const img = document.createElement('img');
        img.src = show.pictures ? show.pictures.large : '';
        img.alt = showName;
        img.loading = 'lazy';
        const title = document.createElement('p');
        title.textContent = showName;
        link.append(img, title);

        if (showDate) {
            const date = document.createElement('span');
            date.className = 'show-date';
            date.textContent = showDate;
            link.appendChild(date);
        }
        return link;
    }

    function renderMoreButton(container) {
        const old = document.getElementById('past-shows-more');
        if (old) old.remove();
        if (!pastShowsNext) return;
        const button = document.createElement('button');
        button.id = 'past-shows-more';
        button.type = 'button';
        button.className = 'nav-btn past-shows-more';
        button.textContent = 'load more';
        button.addEventListener('click', () => fetchMorePastShows(container));
        container.after(button);
    }

    function initLinks(root) {
        if (!root) return;
        root.querySelectorAll('a[href^="/"]').forEach((link) => {
            link.addEventListener("click", (e) => {
                // Let the browser handle new-tab / new-window clicks and downloads
                if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                if (link.target && link.target !== '_self') return;
                e.preventDefault();
                if (link.href === window.location.href) return; // already here
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
                // Viewer's local timezone, 24h, Latin digits — ts is absolute.
                time.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, numberingSystem: 'latn' });
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
            document.getElementById('chat-title').textContent = nick ? `chat as ${nick}` : 'chat';
        }
        function setNick(value) {
            const v = value.trim().slice(0, 24);
            if (!v) return false;
            nick = v;
            localStorage.setItem(NICK_KEY, nick);
            applyNickState();
            if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'join', nick }));
            return true;
        }
        function logout() {
            nick = '';
            localStorage.removeItem(NICK_KEY);
            applyNickState(); // reopens the "pick a name" gate
            if (nickInput) nickInput.focus();
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

        // ---- mobile keyboard: keep the drawer sized to the visible viewport so the
        // input sits just above the on-screen keyboard (a fixed 100dvh element would
        // otherwise be overlapped, hiding the input and showing the page behind it) ----
        function fitViewport() {
            const vv = window.visualViewport;
            if (!vv) return;
            if (drawer.classList.contains('open')) {
                drawer.style.height = vv.height + 'px';
                drawer.style.top = vv.offsetTop + 'px';
                log.scrollTop = log.scrollHeight;
            } else {
                drawer.style.height = '';
                drawer.style.top = '';
            }
        }
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', fitViewport);
            window.visualViewport.addEventListener('scroll', fitViewport);
        }

        // ---- events ----
        // `inert` keeps keyboard focus out of the drawer while it's slid off-screen
        function setDrawerOpen(open) {
            drawer.classList.toggle('open', open);
            drawer.setAttribute('aria-hidden', String(!open));
            drawer.inert = !open;
            toggle.setAttribute('aria-expanded', String(open));
            fitViewport();
            if (open) (nick ? msgInput : nickInput).focus();
        }
        drawer.inert = !drawer.classList.contains('open');

        toggle.addEventListener('click', () => {
            setDrawerOpen(!drawer.classList.contains('open'));
        });
        closeBtn.addEventListener('click', () => {
            setDrawerOpen(false);
            toggle.focus();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && drawer.classList.contains('open')) {
                setDrawerOpen(false);
                toggle.focus();
            }
        });
        nickForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (setNick(nickInput.value)) msgInput.focus();
        });
        msgForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = msgInput.value.trim();
            if (!text) return;
            msgInput.value = '';

            // Self-service commands, handled locally (never sent as chat)
            if (text === '/logout') { logout(); return; }
            const rename = text.match(/^\/nick\s+(.+)$/i);
            if (rename) {
                if (setNick(rename[1])) addSystem(`you're now ${nick}`);
                return;
            }

            if (!nick) return;
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'msg', text }));
            }
        });

        // Discoverability hint for the self-service commands (injected so the drawer
        // markup stays identical across pages)
        const nickGate = document.getElementById('chat-nick-gate');
        if (nickGate && !nickGate.querySelector('.chat-hint')) {
            const hint = document.createElement('p');
            hint.className = 'chat-hint';
            hint.textContent = 'change it later with /nick <name>, or /logout to reset';
            nickGate.appendChild(hint);
        }

        applyNickState();
        connect();
    }
});
