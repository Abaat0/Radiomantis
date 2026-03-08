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