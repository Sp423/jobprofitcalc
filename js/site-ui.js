(function(){
  var btn = document.getElementById("menuBtn");
  var menu = document.getElementById("mobileMenu");
  if (!btn || !menu) return;
  btn.addEventListener("click", function(e) {
    e.stopPropagation();
    var open = menu.classList.toggle("open");
    btn.setAttribute("aria-expanded", open);
    btn.querySelector(".menu-icon").textContent = open ? "✕" : "☰";
  });
  document.addEventListener("click", function() {
    menu.classList.remove("open");
    btn.setAttribute("aria-expanded","false");
    btn.querySelector(".menu-icon").textContent = "☰";
  });
  menu.querySelectorAll("a").forEach(function(a){
    a.addEventListener("click", function(){
      menu.classList.remove("open");
      btn.setAttribute("aria-expanded","false");
      btn.querySelector(".menu-icon").textContent = "☰";
    });
  });
})();
