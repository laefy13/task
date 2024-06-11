function getColor(priority) {
  switch (priority) {
    case 1:
      return "#9EA1D4";
    case 2:
      return "#A8D1D1";
    case 3:
      return "#F1F7B5";
    case 4:
      return "#ffb1b1";
    case 5:
      return "#FD8A8A";
  }
}

function taskGenerator(task) {
  const taskString = encodeURIComponent(JSON.stringify(task));
  return `
  <div class='tasks fadeIn' data-task-id='${
    task.taskId
  }' style='background-color: ${getColor(task.taskPriority)};'> 
    ${task.accountUsername ? task.accountUsername + "'s task" : ""}
    <h1>${task.taskName}</h1>
    <p>${task.taskDescription}</p> 
    <div class='tasks-footer flex flex-row space-between'>
      <div class='info-button' onclick='openMoreInfo("${
        task.taskId
      }")'><svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" stroke-linecap="round" stroke-width="5" d="M6 12h.01m6 0h.01m5.99 0h.01"/>
    </svg>
    </div>
      
      <div class='flex justify-center items-center'>
        <label id="labelProgress_${task.taskId}" for="cbProgress_${
    task.taskId
  }" class="checkbox-container">${progressString(
    task.taskProgress
  )}</label><input type="checkbox" id="cbProgress_${
    task.taskId
  }" onclick="updateProgress(this,${task.taskId})" ${
    task.taskProgress == 1
      ? "checked"
      : task.taskProgress == 0
      ? ""
      : "disabled"
  }></input>
      </div>
      </div>
    <div class='hidden-info flex flex-col' info-id='${task.taskId}'>
      
      <div class='flex flex-col ' >
      <div class='flex flex-row space-between' >
      <h4>Due:</h4> <span class="close" onclick='openMoreInfo("${
        task.taskId
      }")'>&times;</span></div>${stringDateTime(task.taskDue)}</div>
      <div class='flex flex-row mb-10'>
        <div><h4>Priority:</h4> ${stringPriority(task.taskPriority)}</div>
      </div>
      <div class='flex flex-row'>
        <button class='edit-button' onclick='openEditTaskModal("${taskString}")'>Edit</button>
        <button class='edit-button' onclick='openShareModal(${
          task.taskId
        })'>Share</button>
        <button class='edit-button' onclick='deleteTask(${
          task.taskId
        })'>Delete</button>
      </div>
      
    
     
    </div>
  </div>
  `;

  return `<tr class='task-row fadeIn' data-task-id='${task.taskId}'><td>${
    task.taskName
  }</td><td>${task.taskDescription}</td>
    <td><label id="labelProgress_${task.taskId}" for="cbProgress_${
    task.taskId
  }" class="checkbox-container">${progressString(
    task.taskProgress
  )}</label><input type="checkbox" id="cbProgress_${
    task.taskId
  }" onclick="updateProgress(this,${task.taskId})" ${
    task.taskProgress == 1
      ? "checked"
      : task.taskProgress == 0
      ? ""
      : "disabled"
  }></input></td><td>${task.taskDue}</td><td>${task.taskPriority}</td>
    <td><button class='delete-button' onclick='openEditTaskModal("${taskString}")'>Edit Task</button></td></tr>`;
}
function stringDateTime(date) {
  return new Date(date).toLocaleString(navigator.language, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
}
function stringPriority(priority) {
  switch (priority) {
    case 1:
      return "Low";
    case 2:
      return "Medium";
    case 3:
      return "High";
    case 4:
      return "Critical";
    case 5:
      return "Urgent";
  }
}
function openEditTaskModal(task) {
  // // console.log("tf");

  updateTaskModal("Update Task", task, updateTask);
  openTaskModal();
}
function updateTaskModal(title, task, func) {
  // console.log(task);
  if (typeof task === "string") {
    task = JSON.parse(decodeURIComponent(task));
    // // console.log(task);
  }
  // console.log(typeof task);
  document.getElementById("modal-title").textContent = title; //'Update Task'
  document.getElementById("title").value = task.taskName;
  document.getElementById("description").value = task.taskDescription;

  const date = new Date(task.taskDue);
  const formattedDateTimeLocal = `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(
    date.getHours()
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  document.getElementById("due_date").value = formattedDateTimeLocal;
  document.getElementById("priority").value = task.taskPriority;
  document.getElementById("project").value = task.taskProject;
  document.getElementById("task-button").onclick = func;
  document
    .getElementById("projectModal")
    .setAttribute("data-task-id", task.taskId);
}
function deleteTask(task_id) {
  // console.log("delete");
  $.post(`/api/task/delete/${task_id}`, function (data) {
    // console.log(data);

    $(".tasks[data-task-id='" + task_id + "']").remove();
  });
}
function progressString(progress) {
  switch (progress) {
    case 0:
      return "<h4 style='color:white'>In progress</h4>";
    case 1:
      return "<h4 style='color:green'>Completed</h4>";
    case 2:
      return "<h4 style='color:red'>Overdue</h4>";
  }
}
function updateTask(event) {
  event.preventDefault();
  var title = document.getElementById("title").value;
  var description = document.getElementById("description").value;
  var due_date = document.getElementById("due_date").value;
  var priority = document.getElementById("priority").value;
  var project = document.getElementById("project").value;
  var task_id = document
    .getElementById("projectModal")
    .getAttribute("data-task-id");
  $.post(
    "/api/task/update",
    {
      title: title,
      description: description,
      due_date: due_date,
      priority: priority,
      project: project,
      taskId: task_id,
    },
    function (data) {
      if (data.status) {
        closeTaskModal();
        successModal(data.status);
        resetTable();
        getTasks(project, "asc", "taskId");
      } else if (data.error) updateError("task-error", data.error);
      else updateError("task-error", "Task not updated");
    }
  );
}
function addTask(event) {
  event.preventDefault();
  var title = document.getElementById("title").value;
  var description = document.getElementById("description").value;
  var due_date = document.getElementById("due_date").value;
  var priority = document.getElementById("priority").value;
  var project = document.getElementById("project").value;

  if (due_date == "" || new Date() > new Date(due_date)) {
    updateError("task-error", "Due Date cannot be empty/past date");
    return;
  }
  // // console.log(due_date);

  // // console.log("add");
  $.post(
    "/api/task/add",
    {
      title: title,
      description: description,
      due_date: due_date,
      priority: priority,
      project: project,
    },
    function (data) {
      // console.log(data);
      if (data.status) {
        updateProject(project, 0);
        // getTasks(project, "asc", "taskId");
        closeTaskModal();

        updateTaskModal(
          "Add Task",
          {
            taskName: "",
            taskDescription: "",
            taskDue: "",
            taskPriority: 1,
            taskProject: "Main",
          },
          addTask
        );
        successModal("Task Added");
      } else if (data.error) {
        updateError("task-error", data.error);
      } else {
        updateError("task-error", "Task not added");
      }
    }
  );
}
function addProject(event) {
  event.preventDefault();
  var projectName = document.getElementById("projectName").value;

  // console.log("add");
  $.post(
    "/api/project/add",
    {
      projectName: projectName,
    },
    function (data) {
      // console.log(data);
      if (data.status) {
        closeProjectModal();
        getProjects();
        successModal("Project Name Added");
      } else if (data.error) {
        // console.log("should update error");
        updateError("project-error", data.error);
      } else {
        // console.log("should update error");
        updateError("project-error", "Project not added");
      }
    }
  );
}
function newRow(data) {
  var tasks_container = $(".tasks-container");
  var no_tasks = $(".tasks-other");
  no_tasks.empty();
  tasks_container.empty();
  if (data.length === 0)
    no_tasks.append('<h1 class="no-tasks">No tasks found</h1>');
  else {
    no_tasks.append('<h1 class="no-tasks">Tasks for other days</h1>');
    data.forEach((task) => {
      // // console.log(task);
      tasks_container.append(taskGenerator(task));
    });
  }
}

function newRowToday(data) {
  var tasks_container = $(".tasks-container-today");
  var no_tasks_today = $(".tasks-today");
  no_tasks_today.empty();
  tasks_container.empty();
  if (data.length === 0)
    no_tasks_today.append('<h1 class="no-tasks">No tasks Today found</h1>');
  else {
    no_tasks_today.append('<h1 class="no-tasks">Tasks for today</h1>');
    data.forEach((task) => {
      tasks_container.append(taskGenerator(task));
    });
  }
}

function getTasks(projectName, sortOption, sortBy) {
  const el = document.getElementById("main-box");
  if (el.getAttribute("loading") !== "1") {
    el.setAttribute("loading", "1");

    document.getElementById("loading-div").style.display = "flex";

    $.get(
      `/api/tasks/${projectName}?sort=${sortOption}&sortBy=${sortBy}`,
      function (data) {
        // console.log("tasks", data);

        el.setAttribute("loading", "0");
        document.getElementById("loading-div").style.display = "none";

        newRowToday(data.today);
        newRow(data.other);
        return;
      }
    );
  }
}
function getProjects() {
  $.get("/api/projects", function (data) {
    projectSelect = document.getElementById("project");
    projectSidebar = document.getElementById("projects");
    projectEditList = document.getElementById("project-list");

    projectSelect.innerHTML = "";
    projectSidebar.innerHTML =
      '<li  onclick="openProjectModal()">Add New Project</li>';
    projectEditList.innerHTML = "";

    data.forEach((project) => {
      projectSelect.options[projectSelect.options.length] = new Option(
        project.projectName,
        project.projectName
      );
      projectSidebar.innerHTML += `<li  onclick ='updateProject("${project.projectName}",1)' data-project-id='${project.projectName}'>${project.projectName}</li>`;

      if (project.projectName !== "Main") {
        projectEditList.innerHTML += `
      <div class='project-edit-container flex flex-row space-between'>
        <input 
        class="input project-edit-input"
        class="rounded"
        type="text"
        id="title"
        name="title" 
        value="${project.projectName}"
        original-value="${project.projectName}"
        />
        <div class='project-delete-check'>
          <label for="${project.projectName}" >${trashSVG()}</label>
          <input type="checkbox" id="${
            project.projectName
          }" class='project-delete-input' />
        </div>
      </div>`;
      }
    });
    if (projectEditList.innerHTML === "") {
      projectEditList.innerHTML = `<h1>No Projects</h1>`;
    }

    // console.log(data);
    return;
  });
}
function resetTable() {
  $(".tasks").remove();
}
function updateProject(projectName, triggerSideBar) {
  document.getElementById("buttons").setAttribute("project-name", projectName);
  resetTable();
  getTasks(projectName, "asc", "taskId");
  if (triggerSideBar === 1) sidebar();
}
$(document).ready(getTasks("Main", "asc", "taskId"), getProjects());
function sidebar() {
  let screenWidth;
  try {
    screenWidth = window.innerWidth;
  } catch {
    screenWidth = 1000;
  }
  // console.log(screenWidth);
  // console.log(`sidebar:${document.getElementById("mySidebar").offsetWidth}`);
  // console.log(document.getElementById("main").style.width);
  // console.log(document.getElementById("main").style);

  if (
    document.getElementById("mySidebar").offsetWidth < 150 &&
    screenWidth > 768 &&
    (document.getElementById("sidebar-contents").style.visibility ===
      "hidden" ||
      document.getElementById("sidebar-contents").style.visibility === "")
  ) {
    document.getElementById("mySidebar").style.width = "150px";
    document.getElementById("main").style.marginLeft = "150px";
    document.getElementById("sidebar-contents").style.visibility = "visible";
  } else if (
    document.getElementById("mySidebar").offsetWidth >= 150 &&
    screenWidth > 768 &&
    document.getElementById("sidebar-contents").style.visibility === "visible"
  ) {
    document.getElementById("mySidebar").style.width = "75px";
    document.getElementById("main").style.marginLeft = "0";
    document.getElementById("sidebar-contents").style.visibility = "hidden";
  } else if (
    document.getElementById("mySidebar").offsetWidth <= 40 &&
    screenWidth <= 768 &&
    (document.getElementById("sidebar-contents").style.visibility ===
      "hidden" ||
      document.getElementById("sidebar-contents").style.visibility === "")
  ) {
    document.getElementById("mySidebar").style.width = "125px";
    document.getElementById("main").style.marginLeft = "125px";
    document.getElementById("main").style.width = "calc(100% - 125px)";
    // console.log(`edited: ${document.getElementById("main").style.width}`);
    document.getElementById("sidebar-contents").style.visibility = "visible";
  } else {
    document.getElementById("mySidebar").style.width = "40px";
    document.getElementById("main").style.marginLeft = "0";
    document.getElementById("main").style.width = "100%";
    document.getElementById("sidebar-contents").style.visibility = "hidden";
  }
}

function openTaskModal() {
  updateError("task-error", "");
  var modal = document.getElementById("taskModal");
  modal.style.display = "flex";
}

function closeTaskModal() {
  var modal = document.getElementById("taskModal");
  modal.style.display = "none";
}
function openProjectModal() {
  updateError("project-error", "");
  var modal = document.getElementById("projectModal");
  modal.style.display = "flex";
}

function closeProjectModal() {
  document.getElementById("projectName").value = "";
  var modal = document.getElementById("projectModal");
  modal.style.display = "none";
}

function openShareModal(taskId) {
  updateError("share-error", "");
  getUsers(taskId);
  document.getElementById("shareModal").setAttribute("data-task-id", taskId);
  var modal = document.getElementById("shareModal");
  modal.style.display = "flex";
}

function closeShareModal() {
  var modal = document.getElementById("shareModal");
  modal.style.display = "none";
}

function getUsers(taskId) {
  $.get(`/api/users/${taskId}`, function (data) {
    // console.log(data);
    if (data.notShared && data.shared) {
      accountIdSelect = document.getElementById("share_with");
      sharedList = document.getElementById("current_shared");
      accountIdSelect.innerHTML = "";
      sharedList.innerHTML = "";

      data.notShared.recordset.forEach((account) => {
        accountIdSelect.options[accountIdSelect.options.length] = new Option(
          account.accountUsername,
          account.accountId
        );
      });
      data.shared.recordset.forEach((account) => {
        sharedList.innerHTML += `<div class="shared-user flex space-between "><li>${
          account.accountUsername
        }</li><button onclick="removeUser(event,${account.accountId},${
          account.taskId
        })" class="remove-user">${trashSVG()}</button></div>`;
      });
    } else {
      // console.log("hu");
    }
  });
}

function removeUser(event, accountId, taskId) {
  // console.log(accountId, taskId);
  event.preventDefault();
  $.post(
    "/api/share/delete",
    {
      accountId: accountId,
      taskId: taskId,
    },
    function (data) {
      // console.log(data);
      if (data.status) {
        getUsers(taskId);
        successModal("User removed");
      } else if (data.error) {
        updateError("share-error", data.error);
      } else {
        updateError("share-error", "Something went wrong");
      }
    }
  );
}

function shareTask(event) {
  event.preventDefault();
  var taskId = document
    .getElementById("shareModal")
    .getAttribute("data-task-id");
  var accountId = document.getElementById("share_with").value;
  $.post(
    "/api/share",
    {
      taskId: taskId,
      accountId: accountId,
    },
    function (data) {
      // console.log(data);
      if (data.status) getUsers(taskId);
      else updateError("share-error", data.error);
    }
  );
}

function sortTable(sortBy) {
  const el = document.getElementById("main-box");
  if (el.getAttribute("loading") !== "1") {
    const sortElement = document.getElementById(sortBy);

    const projectName = document
      .getElementById("buttons")
      .getAttribute("project-name");

    resetSortButtons(sortBy);
    resetTable();
    switch (sortElement.getAttribute("sort")) {
      case "desc": {
        sortElement.setAttribute(
          "d",
          "M5.575 13.729C4.501 15.033 5.43 17 7.12 17h9.762c1.69 0 2.618-1.967 1.544-3.271l-4.881-5.927a2 2 0 0 0-3.088 0l-4.88 5.927Z"
        );

        sortElement.setAttribute("sort", "asc");
        getTasks(projectName, "asc", sortBy);
        break;
      }
      default: {
        sortElement.setAttribute(
          "d",
          "M18.425 10.271C19.499 8.967 18.57 7 16.88 7H7.12c-1.69 0-2.618 1.967-1.544 3.271l4.881 5.927a2 2 0 0 0 3.088 0l4.88-5.927Z"
        );
        sortElement.setAttribute("sort", "desc");
        getTasks(projectName, "desc", sortBy);
        break;
      }
    }
  }
  // down
  // up
  // neutral
}

function resetSortButtons(sortBy) {
  var sortButtons = [
    "svg-title",
    "svg-desc",
    "svg-status",
    "svg-due",
    "svg-prio",
  ];
  // sortButtons.splice(sortBy, 1);
  sortButtons.forEach((button) => {
    if (button !== sortBy) {
      const sortElement = document.getElementById(button);
      sortElement.setAttribute(
        "d",
        "M12.832 3.445a1 1 0 0 0-1.664 0l-4 6A1 1 0 0 0 8 11h8a1 1 0 0 0 .832-1.555l-4-6Zm-1.664 17.11a1 1 0 0 0 1.664 0l4-6A1 1 0 0 0 16 13H8a1 1 0 0 0-.832 1.555l4 6Z"
      );
      sortElement.setAttribute("sort", "neutral");
    }
  });
}

function sortButton(sortName) {
  return `
          <button onclick="sortTable('${sortName}')">
            <svg
              class="w-6 h-6 text-gray-800 dark:text-white"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                id='${sortName}'
                fill-rule="evenodd"
                d="M12.832 3.445a1 1 0 0 0-1.664 0l-4 6A1 1 0 0 0 8 11h8a1 1 0 0 0 .832-1.555l-4-6Zm-1.664 17.11a1 1 0 0 0 1.664 0l4-6A1 1 0 0 0 16 13H8a1 1 0 0 0-.832 1.555l4 6Z"
                clip-rule="evenodd"
                sort="neutral"
              />
            </svg>
          </button>`;
}

function updateProgress(checkbox, taskId) {
  var taskProgress = 0;
  if (checkbox.checked) {
    taskProgress = 1;
  }
  // console.log(`updating cbProgress_${taskId}`);
  var progressStringElement = document.getElementById(
    `labelProgress_${taskId}`
  );
  progressStringElement.innerHTML = progressString(taskProgress);
  $.post("/api/tasks/update", {
    taskId: taskId,
    taskProgress: taskProgress,
  });
}

function openMoreInfo(taskId) {
  // console.log(taskId);
  const infoElement = document.querySelector(
    `.hidden-info[info-id='${taskId}']`
  );
  infoElement.classList.toggle("show");
}
function hideMoreInfo(taskId) {
  // console.log(taskId);
  const infoElement = document.querySelector(
    `.hidden-info[info-id='${taskId}']`
  );
  infoElement.classList.toggle("show");
}

function successModal(message) {
  var modal = document.getElementById("successModal");
  // console.log(`display: ${modal.style.display}`);
  if (modal.style.display === "flex") {
    document.getElementById("success-message").innerText = message;
    return;
  }
  modal.style.display = "flex";
  document.getElementById("success-message").innerText = message;
  // console.log("close in 2000");
  setTimeout(closeSuccessModal, 5000);
  // console.log("erm");
}

function closeSuccessModal() {
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
  // modal.style.display = "none";
}
function updateError(elementId, message) {
  document.getElementById(elementId).innerText = message;
}

function trashSVG() {
  return `<svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 7h14m-9 3v8m4-8v8M10 3h4a1 1 0 0 1 1 1v3H9V4a1 1 0 0 1 1-1ZM6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Z"/>
</svg>
`;
}

function openProjectEditModal() {
  updateError("project-edit-error", "");
  var modal = document.getElementById("projectEditModal");
  modal.style.display = "flex";
}

function closeProjectEditModal() {
  var modal = document.getElementById("projectEditModal");
  modal.style.display = "none";
}

function editProjects(event) {
  event.preventDefault();
  const rows = document.querySelectorAll(".project-edit-container");

  projects = [];
  rows.forEach((row) => {
    const titleInput = row.querySelector('input[type="text"]');

    const checkbox = row.querySelector('input[type="checkbox"]');

    const originalValue = titleInput.getAttribute("original-value");
    const currentValue = titleInput.value;
    const isChecked = checkbox.checked;
    let objectInput = {};

    if (originalValue !== currentValue) {
      objectInput["originalValue"] = originalValue;
      objectInput["title"] = currentValue;
    }
    if (isChecked) {
      objectInput["originalValue"] = originalValue;
      objectInput["checked"] = isChecked;
    }

    if (Object.keys(objectInput).length > 0) {
      projects.push(objectInput);
    }
  });
  // console.log(projects);
  if (projects.length > 0) {
    $.post("/api/project/update", { inputs: projects }, function (data) {
      // console.log("data", data);
      let errorMessages = "";
      if (data.update) {
        errorMessages += data.update;
      }
      if (data.delete) {
        if (errorMessages !== "") {
          errorMessages += "\n";
        }
        errorMessages += data.delete;
      }

      updateError("project-edit-error", errorMessages);
      getProjects();
    });
  }
  // send projects
}
