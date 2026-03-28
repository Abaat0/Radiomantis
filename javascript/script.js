document.addEventListener('DOMContentLoaded', () => {
    const playButton = document.getElementById('play-pause-btn');
    const audioStream = document.getElementById('radio-stream');
    const streamUrl = audioStream.src; 

    playButton.addEventListener('click', () => {
        if (audioStream.paused) {
            audioStream.play();
            playButton.classList.add('is-playing'); 
        } else {
            audioStream.pause();
            playButton.classList.remove('is-playing');
            
            audioStream.src = ''; 
            audioStream.src = streamUrl; 
            audioStream.load(); 
        }
    });
    // --- NEW WORK IN PROGRESS CODE ---
    // 1. Grab every link with the 'wip-link' class
    const wipLinks = document.querySelectorAll('.wip-link');
    
    // 2. Loop through each one and attach a click listener
    wipLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            // Stop the link from actually trying to load the missing HTML page
            event.preventDefault(); 
            
            // Trigger the standard browser popup
            alert('Work in progress! Check back later.'); 
        });
    });
});


const showDirectory = {
    // "azuracast_username": { host: "DJ Name", show: "Show Name", image: "filename.png" }
    "unknown": { 
        host: "unknown", 
        show: "unknown", 
        image: "default.png" 
    },
    "sangwich_show": { 
        host: "botond", 
        show: "The Sangwich Show", 
        image: "botond.png" 
    },
    "leather_music": { 
        host: "swagbert", 
        show: "Leather Music", 
        image: "swagbert." 
    },
    "bee_suave": { 
        host: "bee suave", 
        show: "The Sangwich Show", 
        image: "bee\ suave.jpg" 
    }
    
};
// get info from the API and update the website with it
/*
async function updateRadioData() {
    try {
        const response = await fetch('https://radiomantis.com/api/nowplaying/2');
        const radioData = await response.json();

        const currentSong = radioData.now_playing.song.title || "Unknown Track"; 
        const currentArtist = radioData.now_playing.song.artist || "Unknown Artist"; 
        const streamerAccount = radioData.live.streamer_name || "unknown"; 

        const mainPlayerText = document.getElementById('main-player-text');
        const tvPlayerText = document.getElementById('tv-player-text');
        const tvStatusText = document.getElementById('tv-status-text');
        const pictureDiv = document.getElementById('picturebox');

        if (radioData.live.is_live) {
            
            // Look up the account name in our dictionary
            const activeShow = showDirectory[streamerAccount];
            tvStatusText.textContent = "Live Now    "; 

            if (activeShow) {
                const formattedText = `${activeShow.show} w/ ${activeShow.host}`.toLowerCase();
                
                playerTextDiv = formattedText;
                tvTextDiv.textContent = formattedText;
                
                
                pictureDiv.style.backgroundImage = `url(css/pictures/${activeShow.image})`;
                //pictureDiv.style.backgroundImage = "url(css/pictures/default.jpg)";

            }
            // if there is no show in the dictionary 
            else {
                const fallbackText = `live w/ ${streamerAccount}`.toLowerCase();
                
                playerTextDiv.textContent = fallbackText;
                tvTextDiv.textContent = fallbackText;
                pictureDiv.style.backgroundImage = `url(css/pictures/${activeShow.image})`;
                //pictureDiv.style.backgroundImage = `url(css/pictures/default.jpg)`; 
                console.log(`Live streamer detected: ${streamerAccount}, but no show info found. Displaying fallback text and default image.`);
            }

        } else {
            // AutoDJ Mode
            tvStatusText.textContent = "Offline    ";
            
            mainPlayerText.innerHTML = `${currentSong.toLowerCase()} <br> By ${currentArtist.toLowerCase()} <br> offline playing from playlist`;
            tvPlayerText.textContent = `${currentSong.toLowerCase()}`;
            pictureDiv.style.backgroundImage = "url(css/pictures/default.jpg)";
            console.log("No live streamer detected. Displaying AutoDJ info.");
        } 

    } catch (error) {
        console.error("Oops, couldn't fetch the radio data:", error);
    }
}

updateRadioData();

setInterval(updateRadioData, 15000);*/