document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. DOM ELEMENTS & VARIABLES
    // ==========================================
    // Radio Player Elements
    const playButton = document.getElementById('play-pause-btn');
    const audioStream = document.getElementById('radio-stream');
    const statusLabel = document.getElementById('status-label');
    const mainText = document.getElementById('main-player-text');
    const wipLinks = document.querySelectorAll('.wip-link');
    const streamUrl = audioStream?.src;

    // Schedule Page Elements
    const scheduleContainer = document.getElementById('schedule-container');
    const prevBtn = document.getElementById('prev-week-btn');
    const nextBtn = document.getElementById('next-week-btn');
    const weekLabel = document.getElementById('week-label');

    // AzuraCast streamer names mapped to display data
    const showDirectory = {
        "cranking_the_meatcomputer": { host: "nike pittsburgh", show: "cranking the meatcomputer" },
        "leather_music": { host: "swagbert", show: "Leather Music" },
        "sangwich_show": { host: "bee suave", show: "The Sangwich Show" }
    };

    // Schedule data
    const SHEET_URL = 'https://opensheet.elk.sh/1OhiyukdiE9ZdmLHTI0nnnKosPXwnOXUJ4t5uh5c4HYE/Sheet1';
    let masterScheduleData = [];
    let currentMonday = scheduleContainer ? getMonday(new Date()) : null;

    // ==========================================
    // 2. INITIALIZATION
    // ==========================================
    if (playButton && audioStream) {
        initAudioPlayer();
        updateRadioData();
        setInterval(updateRadioData, 15000);
    }

    if (scheduleContainer) {
        loadSchedule();
    }

    // ==========================================
    // 3. RADIO PLAYER FUNCTIONS
    // ==========================================

    function initAudioPlayer() {
        playButton.addEventListener('click', () => {
            if (audioStream.paused) {
                // 1. Re-attach the stream URL right BEFORE playing to guarantee the live edge
                audioStream.src = streamUrl;
                audioStream.load(); 
                audioStream.play();
                playButton.classList.add('is-playing'); 
            } else {
                // 2. Pause the stream
                audioStream.pause();
                playButton.classList.remove('is-playing');
                
                // 3. Completely wipe the source so the browser stops downloading dead data
                audioStream.removeAttribute('src'); 
                audioStream.load(); 
            }
        });
    }

    async function updateRadioData() {
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
        // Show the play button
        playButton.style.visibility = 'visible'; 
        statusLabel.textContent = "now playing";

        // Look up the account name in our dictionary
        const activeShow = showDirectory[streamerAccount];

        if (activeShow) {
            mainText.textContent = `${activeShow.show} w/ ${activeShow.host}`.toLowerCase();
        } else {
            // Fallback if the DJ isn't in the directory
            mainText.textContent = `live w/ ${streamerAccount}`.toLowerCase();
        }
    }

    function setOfflineState() {
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

    async function loadSchedule() {
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
                            <div class="schedule-info">${show.Show} w/ ${show.DJ}</div>
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

    // Button Listeners for Time Travel
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentMonday.setDate(currentMonday.getDate() - 7);
            renderWeek();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentMonday.setDate(currentMonday.getDate() + 7);
            renderWeek();
        });
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

});