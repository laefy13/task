$(document).ready(function () {
  exitModal();
});

function exitModal() {
  if (document.getElementById("successModal")) {
    setTimeout(() => {
      // console.log("should start sliding out");
      var modal = document.getElementById("successModal");
      var message = document.getElementById("success-message");
      message.style.animation = "slideOut 1s forwards";
      message.addEventListener(
        "animationend",
        function () {
          modal.style.display = "none";
          message.style.animation = "";
        },
        { once: true }
      );
      // console.log("sliding out done");
    }, 5000);
  }
}
