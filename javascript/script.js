document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. CONSTANTS & GLOBAL STATE
    // ==========================================
    // AzuraCast streamer names mapped to display data
    const SHEET_URL = 'https://opensheet.elk.sh/1OhiyukdiE9ZdmLHTI0nnnKosPXwnOXUJ4t5uh5c4HYE/Sheet1';
    const SHOW_DIRECTORY = {
        "cranking_the_meatcomputer": { host: "nike pittsburgh", show: "cranking the meatcomputer" },
        "leather_music": { host: "swagbert", show: "Leather Music" },
        "sangwich_show": { host: "bee suave", show: "The Sangwich Show" },
        "luca": { host: "luca", show: "siririca no bide" },
        "bee suave": { host: "bee suave", show: "The Sangwich Show" },
        "fodongophon": { host: "fodongophon", show: "Kraüt & Ruben" },
        "splenda": { host: "splenda", show: "wyd" },
    };
    
    let masterScheduleData = [];
    let currentMonday;
    

    // ==========================================
    // 2. INITIALIZATION
    // ==========================================

    init();
    setInterval(updateRadioData, 15000);

    function init() {
        initLinks();
        initAudioPlayer();
        updateRadioData();
        initSchedule();
        loadPastShows();
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
                setOfflineState();
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

        // Show the play button
        playButton.style.visibility = 'visible'; 
        statusLabel.textContent = "now playing";

        // Look up the account name in our dictionary
        const activeShow = SHOW_DIRECTORY[streamerAccount];

        if (activeShow) {
            mainText.textContent = `${activeShow.show} w/ ${activeShow.host}`.toLowerCase();
        } else {
            // Fallback if the DJ isn't in the directory
            mainText.textContent = `${streamerAccount}`.toLowerCase();
        }
    }

    function setOfflineState() {
        const playButton = document.getElementById('play-pause-btn');
        const audioStream = document.getElementById('radio-stream');
        const statusLabel = document.getElementById('status-label');
        const mainText = document.getElementById('main-player-text');
        if (!playButton || !audioStream || !statusLabel || !mainText) return;

        // Hide the play button
        playButton.style.visibility = 'hidden';
        
        // Force pause the audio if they were listening when the DJ logged off
        if (!audioStream.paused) {
            audioStream.pause();
            playButton.classList.remove('is-playing');
        }
        
        statusLabel.textContent = "offline";
        mainText.textContent = "check the schedule for upcoming shows";
    }

    // ==========================================
    // 4. SCHEDULE FUNCTIONS
    // ==========================================

    function initSchedule() {
        if (!document.getElementById('schedule-container')) return;

        currentMonday = getMonday(new Date());

        loadSchedule();
        
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
                
                // Format the date 
                const showDate = new Date(show.created_time);
                const formattedDate = showDate.toLocaleDateString('en-US', { 
                    month: 'long', day: 'numeric', year: 'numeric' 
                });

                const imageUrl = show.pictures.large;

                // Build the HTML for the specific show
                const showHtml = `
                    <a href="${show.url}" target="_blank" class="show-item">
                        <img src="${imageUrl}" alt="${show.name}">
                        <p>${show.name}</p>
                        <span class="show-date">${formattedDate}</span>
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
});