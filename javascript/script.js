document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. DOM ELEMENTS & VARIABLES
    // ==========================================
    const playButton = document.getElementById('play-pause-btn');
    const audioStream = document.getElementById('radio-stream');
    const statusLabel = document.getElementById('status-label');
    const mainText = document.getElementById('main-player-text');
    const wipLinks = document.querySelectorAll('.wip-link');
    
    const streamUrl = audioStream.src; 

    // AzuraCast streamer names mapped to display data
    const showDirectory = {
        "cranking_the_meatcomputer": { host: "nike pittsburgh", show: "cranking the meatcomputer" },
        "leather_music": { host: "swagbert", show: "Leather Music" },
        "sangwich_show": { host: "bee suave", show: "The Sangwich Show" }
    };

    // ==========================================
    // 2. INITIALIZATION
    // ==========================================
    initAudioPlayer();
    
    // Fetch API immediately on load, then check every 15 seconds
    updateRadioData();
    setInterval(updateRadioData, 15000);

    // ==========================================
    // 3. CORE FUNCTIONS
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

    // ==========================================
    // 4. UI STATE MANAGERS
    // ==========================================

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

});