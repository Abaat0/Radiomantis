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