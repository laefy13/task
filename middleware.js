const xss = require("xss");
const validator = require("validator");
const bcrypt = require("bcrypt");
const hashPassword = async (plainPassword) => {
  const saltRounds = 10;
  try {
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
    return hashedPassword;
  } catch (error) {
    console.error("Error hashing password:", error);
    throw error;
  }
};

const comparePasswords = async (plainPassword, hashedPassword) => {
  try {
    const match = await bcrypt.compare(plainPassword, hashedPassword);
    return match;
  } catch (error) {
    console.error("Error comparing passwords:", error);
    throw error;
  }
};

const validateTaskId = (req, res, next) => {
  const rawTaskId = req.params.taskId;

  if (validator.isInt(rawTaskId)) {
    req.params.taskId = sanitizeInput(rawTaskId);
    next();
  } else {
    res.status(400).send("Invalid Task ID");
  }
};

const validateProjectName = (req, res, next) => {
  const projectName = req.body.projectName;
  if (projectName === null || projectName === undefined) {
    return res.status(400).json({ error: "Project Name is required" });
  } else if (typeof projectName !== "string")
    return res.status(400).json({ error: "Invalid input Project Name" });
  else {
    req.body.projectName = sanitizeInput(projectName);
    next();
  }
};

const validateAndSanitizeTask = (req, res, next) => {
  let taskFields = {};
  if (req.body.taskId) {
    const { title, description, due_date, priority, project, taskId } =
      req.body;
    taskFields = { title, description, due_date, priority, project, taskId };
  } else {
    const { title, description, due_date, priority, project } = req.body;
    taskFields = { title, description, due_date, priority, project };
  }

  const { title, description, due_date, priority, project, taskId } =
    taskFields;

  if (
    !title ||
    typeof title !== "string" ||
    !description ||
    typeof description !== "string" ||
    !validator.isISO8601(due_date) ||
    !validator.isInt(priority.toString()) ||
    !project ||
    typeof project !== "string" ||
    (taskId && !validator.isInt(taskId.toString()))
  ) {
    return res.status(400).json({ error: "Invalid input data" });
  }

  req.sanitizedBody = {
    title: sanitizeInput(title),
    description: sanitizeInput(description),
    due_date: sanitizeInput(due_date),
    priority: sanitizeInput(priority.toString()),
    project: sanitizeInput(project),
    taskId: taskId ? sanitizeInput(taskId.toString()) : null,
  };

  next();
};

const validateGetTasks = (req, res, next) => {
  const { sort, sortBy } = req.query;
  const projectName = req.params.projectName;
  if (projectName === null || projectName === undefined) {
    return res.status(400).json({ error: "Project Name is required" });
  } else if (
    typeof sort !== "string" ||
    typeof sortBy !== "string" ||
    typeof projectName !== "string"
  ) {
    return res.status(400).json({ error: "Invalid input data" });
  } else {
    req.query = { sort: sanitizeInput(sort), sortBy: sanitizeInput(sortBy) };
    req.params.projectName = sanitizeInput(projectName);
    next();
  }
};

const validateTasksUpdate = (req, res, next) => {
  const { taskProgress, taskId } = req.body;
  if (
    !validator.isInt(taskProgress.toString()) ||
    !validator.isInt(taskId.toString())
  ) {
    return res.status(400).json({ error: "Invalid input data" });
  } else {
    req.body = {
      taskProgress: sanitizeInput(taskProgress),
      taskId: sanitizeInput(taskId),
    };
    next();
  }
};

const validateUpdateProject = (req, res, next) => {
  const { inputs } = req.body;
  const sanitizedInputs = [];
  const userId = req.session.user.user_id;

  let deleteQuery = `DELETE FROM tblprojects WHERE accountsId = ${userId} AND (`;
  let updateQuery = `UPDATE tblprojects
    SET projectName = CASE `;

  if (!Array.isArray(inputs)) {
    return res.status(400).json({ error: "Invalid input data" });
  }
  req.body = { inputs: [] };
  inputs.forEach((input) => {
    let temp;
    const { title, checked, originalValue } = input;
    console.log(title, checked, originalValue, input);
    if (originalValue == "Main") return;

    if (typeof originalValue !== "string") {
      console.log("input not string");
      return res.status(400).json({ error: "Invalid input data" });
    }

    temp = sanitizeInput(originalValue);

    if (checked && checked != "true") {
      return res.status(400).json({ error: "Input not bool" });
    } else if (checked) {
      deleteQuery += `projectName = '${temp}' OR `;
      // temp["checked"] = true;
      // sanitizedInputs.push(temp);
      return;
    }

    if (title && typeof title !== "string") {
      return res.status(400).json({ error: "Invalid input data" });
    } else if (title) {
      updateQuery += `WHEN accountsId = ${userId} AND projectName = '${temp}' THEN '${title}'`;
      // temp["title"] = sanitizeInput(title);
    }

    // if (checked)
    // sanitizedInputs.push(temp);
  });

  deleteQuery = deleteQuery.slice(0, -3) + ")";
  updateQuery += " ELSE projectName END";
  // req.body.inputs = sanitizedInputs;
  // console.log(req.body);
  console.log(updateQuery);
  console.log(deleteQuery);
  req.updateQuery = updateQuery;
  req.deleteQuery = deleteQuery;
  next();
};

const requireAuth = (req, res, next) => {
  console.log("auth check", req.session);
  if (req.session.user) {
    next();
  } else {
    res.redirect("/");
  }
};

const checkAuth = (req, res, next) => {
  console.log("auth check", req.session);
  if (req.session.user) {
    res.redirect("/main");
  } else {
    next();
  }
};

const validateAccountInputs = (req, res, next) => {
  let inputFields;
  let errorMessage;
  if (req.body.email) {
    const { username, password, email } = req.body;
    inputFields = { username, password, email };
    errorMessage = "Username, password, and email are required.";
  } else {
    const { username, password } = req.body;
    inputFields = { username, password };
    errorMessage = `Username and password are required.username = ${username} | password = ${password} | obdy = ${req.body}`;
  }

  const { username, password, email } = inputFields;

  if (
    !username ||
    !password ||
    typeof username !== "string" ||
    typeof password !== "string" ||
    (email && typeof email !== "string")
  ) {
    // res.status(400).render("login", {
    //   error: errorMessage,
    // });
    res.status(400).json({ error: req.body });
    return;
  } else {
    req.body = {
      username: sanitizeInput(username),
      password: sanitizeInput(password),
      email: email ? sanitizeInput(email) : null,
    };
    console.log(req.body);
    next();
  }
};

const validateUpdateAccount = async (req, res, next) => {
  let taskFields = {};
  if (
    !(
      (req.body.username || req.body.password || req.body.email) &&
      req.body.current_password
    )
  ) {
    return res.status(400).render("login", {
      error: "Inputs missing",
    });
  }
  if (req.body.username) {
    const { username } = req.body;
    taskFields["username"] = username;
  }
  if (req.body.password) {
    const { password } = req.body;
    taskFields["password"] = password;
  }
  if (req.body.email) {
    const { email } = req.body;
    taskFields["email"] = email;
  }
  const { current_password } = req.body;

  const { username, password, email } = taskFields;

  if (
    (username && typeof username !== "string") ||
    (email && typeof email !== "string") ||
    (email && !email.includes("@")) ||
    (password && typeof password !== "string")
  ) {
    return res.status(400).json({ error: "Invalid input data" });
  }

  req.body = {
    username: username ? sanitizeInput(username) : null,
    password: password ? await hashPassword(password) : null,
    email: email ? sanitizeInput(email) : null,
    current_password: sanitizeInput(current_password),
  };

  next();
};

const validateCurrentPass = (req, res, next) => {
  const { current_password } = req.body;
  if (!current_password || typeof current_password !== "string") {
    return res.status(400).json({ error: "Missing Inputs" });
  }
  next();
};

const validateIndexQuery = (req, res, next) => {
  const { message } = req.query;

  if (message === null || message === undefined) {
    next();
  } else if (typeof message !== "string") {
    res.redirect("/");
    return;
  } else {
    req.query = { message: sanitizeInput(message) };
    next();
  }
};

const validateIds = (req, res, next) => {
  console.log(req.body);

  const { accountId, taskId } = req.body;
  if (
    accountId === null ||
    accountId === undefined ||
    taskId === null ||
    taskId === undefined
  ) {
    return res.status(400).json({ error: "Missing Inputs" });
  } else if (
    !validator.isInt(accountId.toString()) ||
    !validator.isInt(taskId.toString())
  ) {
    return res.status(400).json({ error: "Input error" });
  } else {
    req.body = {
      accountId: sanitizeInput(accountId),
      taskId: sanitizeInput(taskId),
    };
    next();
  }
};

const sanitizeInput = (input) => {
  return xss(input);
};
module.exports = {
  hashPassword,
  comparePasswords,
  validateTaskId,
  validateProjectName,
  validateAndSanitizeTask,
  validateGetTasks,
  validateTasksUpdate,
  validateUpdateProject,
  requireAuth,
  checkAuth,
  validateAccountInputs,
  validateUpdateAccount,
  validateIndexQuery,
  validateIds,
  sanitizeInput,
  validateCurrentPass,
};
