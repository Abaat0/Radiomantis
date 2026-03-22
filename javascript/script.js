document.addEventListener('DOMContentLoaded', () => {
    const playButton = document.querySelector('.button');
    const audioStream = document.getElementById('radio-stream');

    playButton.addEventListener('click', () => {
        if (audioStream.paused) {
            audioStream.play();
            playButton.classList.add('paused'); 
        } else {
            audioStream.pause();
            playButton.classList.remove('paused');
            
            // Reset the source so when they hit play again, it catches up to live
            audioStream.src = audioStream.src; 
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    
    const aboutBtn = document.querySelector('.about_usbox');
    const residentsBtn = document.querySelector('.residentsbox');
    const scheduleBtn = document.querySelector('.schedulebox');
    const donateBtn = document.querySelector('.donatebox');

    const contentContainer = document.getElementById('content-container');
    const allPanels = document.querySelectorAll('.content-panel');

    function openPanel(panelId) {
        contentContainer.classList.add('show');
        allPanels.forEach(panel => {
            panel.classList.remove('active');
        });

        document.getElementById(panelId).classList.add('active');
        contentContainer.scrollIntoView({ behavior: 'smooth' });
    }

    aboutBtn.addEventListener('click', () => openPanel('about-panel'));
    residentsBtn.addEventListener('click', () => openPanel('residents-panel'));
    scheduleBtn.addEventListener('click', () => openPanel('schedule-panel'));

    donateBtn.addEventListener('click', () => {
        window.open('https://buymeacoffee.com/radiomantis', '_blank'); 
    });

});
const showDirectory = {
    // "azuracast_username": { dj: "DJ Name", show: "Show Name", image: "filename.png" }
    "sangwich_show": { 
        dj: "botond", 
        show: "The Sangwich Show", 
        image: "botond.png" 
    },
    "leather_music": { 
        dj: "swagbert", 
        show: "Leather Music", 
        image: "swagbert.png" 
    },
    "bee_suave": { 
        dj: "bee suave", 
        show: "The Sangwich Show", // Whatever Bee Suave's show is called!
        image: "beesuave.png" 
    }
};
// get info from the API and update the website with it
async function updateRadioData() {
    try {
        const response = await fetch('https://radiomantis.com/api/nowplaying/2');
        const radioData = await response.json();

        const currentSong = radioData.now_playing.song.title || "Unknown Track"; 
        
        const streamerAccount = radioData.live.streamer_name; 

        const playerTextDiv = document.querySelector('.infobox .playertext p');
        const tvTextDiv = document.querySelector('.insidetvbox .playertext');
        const pictureDiv = document.querySelector(".picturebox");

        if (radioData.live.is_live) {
            
            // Look up the account name in our dictionary
            const activeShow = showDirectory[streamerAccount];

            if (activeShow) {
                const formattedText = `${activeShow.show} w/ ${activeShow.dj}`.toLowerCase();
                
                playerTextDiv.textContent = formattedText;
                tvTextDiv.textContent = formattedText;
                
                //pictureDiv.style.backgroundImage = `url(pictures/${activeShow.image})`;
                pictureDiv.style.backgroundImage = `url(pictures/pictures/botond.png)`; 

            } else {
                const fallbackText = `live w/ ${streamerAccount}`.toLowerCase();
                
                playerTextDiv.textContent = fallbackText;
                tvTextDiv.textContent = fallbackText;
                pictureDiv.style.backgroundImage = `url(pictures/botond.png)`; 
                console.log(`Live streamer detected: ${streamerAccount}, but no show info found. Displaying fallback text and default image.`);
            }

        } else {
            // When NOBODY is live (AutoDJ is playing)
            console.log("No live streamer detected. Displaying current song from AutoDJ.");
            playerTextDiv.textContent = currentSong.toLowerCase();
            tvTextDiv.textContent = currentSong.toLowerCase();
            pictureDiv.style.backgroundImage = `url(pictures/pictures/botond.png)`; 
        } 

    } catch (error) {
        console.error("Oops, couldn't fetch the radio data:", error);
    }
}

updateRadioData();

setInterval(updateRadioData, 15000);