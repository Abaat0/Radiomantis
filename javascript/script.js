document.addEventListener("DOMContentLoaded", function() {
    const btn = document.querySelector(".button");
    
    btn.addEventListener("click", function() {
        btn.classList.toggle("paused");
    });
});