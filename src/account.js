function updateEmailUsername(event) {
  event.preventDefault();
  updateStatus("pending", "Account being updated");
  var username = document.getElementById("username").value;
  var email = document.getElementById("email").value;
  var current_password = document.getElementById(
    "general_current_password"
  ).value;
  if ((email == "" && username == "") || current_password == "") {
    updateStatus(
      "error",
      "Please fill either of the email or username, and the current password"
    );
    return;
  } else if (email !== "" && !email.includes("@")) {
    updateStatus("error", "Email is not valid");
    return;
  }
  $.post(
    "/api/account/update",
    {
      username: username,
      email: email,
      current_password: current_password,
    },
    function (data) {
      if (data.status == "success") {
        updateStatus("ok", "Account updated");
      } else if (data.error) {
        updateStatus("error", data.error);
      } else {
        updateStatus("error", "Account not updated");
      }
    }
  );
}
function updatePassword(event) {
  event.preventDefault();
  updateStatus("pending", "Account being updated");
  var password = document.getElementById("password").value;
  var current_password = document.getElementById(
    "password_current_password"
  ).value;

  $.post(
    "/api/account/update",
    {
      password: password,
      current_password: current_password,
    },
    function (data) {
      if (data.status == "success") {
        updateStatus("ok", "Account updated");
      } else if (data.error) {
        updateStatus("error", data.error);
      } else {
        updateStatus("error", "Account not updated");
      }
    }
  );
}
function deleteAccount() {
  var current_password = document.getElementById(
    "delete_current_password"
  ).value;
  $.post(
    "/api/account/delete",
    {
      current_password: current_password,
    },
    function (data) {
      // console.log(data);
      if (data.status == "success") {
        window.location.href = "/logout";
      } else if (data.error) {
        updateStatus("error", data.error);
      } else {
        updateStatus("error", "Account not deleted");
      }
    }
  );
}
function changeTab(tabNum) {
  resetInputs();
  updateStatus("pending", "None");
  tabs = ["general-tab", "password-tab", "delete-tab"];
  document.getElementById(tabs[tabNum]).style.display = "flex";
  tabs.splice(tabNum, 1);
  tabs.forEach((tab) => {
    document.getElementById(tab).style.display = "none";
  });
}

function resetInputs() {
  document.getElementById("email").value = "";
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
  document.getElementById("delete_current_password").value = "";
  document.getElementById("general_current_password").value = "";
  document.getElementById("password_current_password").value = "";
}

function openAccountModal() {
  var modal = document.getElementById("accountModal");
  modal.style.display = "flex";
}

function closeAccountModal() {
  resetInputs();
  var modal = document.getElementById("accountModal");
  modal.style.display = "none";
}
function updateStatus(status, message) {
  document.getElementById("status").innerHTML =
    "Status: " + '<div class="' + status + '">' + message + "</div>";
}
