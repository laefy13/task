const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const port = 3000;
const session = require("express-session");
const mariadb = require("mariadb");
const MySQLStore = require("express-mysql-session")(session);
const bcrypt = require("bcryptjs");
const { Connection, Request } = require("tedious");
const SQLSessionStore = require("../sqlSession");
const middleware = require("../middleware");
require("dotenv").config();
// express-validator

// TODO: use .env here

const sql = require("mssql");

const config = {
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: 1433,
  options: {
    encrypt: true,
  },
};

const pool = new sql.ConnectionPool(config);

async function connectWithRetry(retryInterval = 5000) {
  try {
    await pool.connect();
    console.log("Connected to the database");
  } catch (err) {
    console.error("Error:", err);
    console.log(`Retrying in ${retryInterval / 1000} seconds...`);
    setTimeout(() => connectWithRetry(retryInterval), retryInterval);
  }
}

connectWithRetry();

app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");
app.use(bodyParser.json());
app.use(express.static("src"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.DB_SECRET,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
    store: new SQLSessionStore(),
    resave: false,
    saveUninitialized: false,
  })
);

app.get("/", middleware.validateIndexQuery, (req, res) => {
  const message = req.query.message;
  console.log(message);
  if (req.session.user) {
    res.redirect("/main");
  } else {
    res.render("index", { status: message ? message : "" });
  }
});

app.get("/main", middleware.requireAuth, (req, res) => {
  const username = req.session.user.username;
  res.render("main", { username });
});

app.get("/login", middleware.checkAuth, (req, res) => {
  res.render("login", { error: "" });
});

app.post(
  "/login",
  [middleware.checkAuth, middleware.validateAccountInputs],
  async (req, res) => {
    const isLogin = await loginUser(req.body.username, req.body.password);
    if (isLogin !== -1) {
      req.session.user = { username: req.body.username, user_id: isLogin };
      console.log("islogin:", isLogin);
      res.redirect("/");
    } else {
      res.status(400).render("login", {
        error: "Username and password does not match or exist.",
      });
      return;
    }
  }
);

app.get("/register", (req, res) => {
  res.render("register", { error: "" });
});

app.post(
  "/register",
  [middleware.checkAuth, middleware.validateAccountInputs],
  (req, res) => {
    middleware
      .hashPassword(req.body.password)
      .then((hashedPassword) => {
        pool
          .query(
            `SELECT * FROM tblaccounts WHERE accountUsername = '${req.body.username}' OR accountEmail = '${req.body.email}'`
          )
          .then((results) => {
            if (results.recordset.length > 0) {
              res.status(400).render("register", {
                error: "Username / Email already exists.",
              });
              return;
            }
            pool
              .query(
                `INSERT INTO tblaccounts (accountUsername, accountPassword, accountEmail) VALUES ('${req.body.username}', '${hashedPassword}', '${req.body.email}')`
              )
              .then(() => {
                const payloadData = {
                  message: "Registered successfully",
                };

                const queryParams = new URLSearchParams(payloadData).toString();

                res.redirect(`/?${queryParams}`);
                return;
              })
              .catch((error) => {
                console.error(error);
                res.status(400).render("register", {
                  error: "Error",
                });
              });
          })
          .catch((error) => {
            console.error(error);
            res.status(400).render("register", {
              error: "Error",
            });
          });
      })
      .catch((error) => {
        console.error(error);
        res.status(400).render("register", {
          error: "Password hashing error",
        });
      });
  }
);

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log("Failed to destroy session:", err);
      res.status(500).send("Failed to destroy session");
    } else {
      console.log("Session destroyed successfully");
      res.redirect("/");
    }
  });
});

// API
app.post("/api/tasks/update", middleware.validateTasksUpdate, (req, res) => {
  if (validataUser(req) === 0) {
    res.status(400).send("Invalid user id and user name");
  }

  pool
    .query(
      `UPDATE tbltasks SET taskProgress = ${req.body.taskProgress} WHERE taskId = ${req.body.taskId}`
    )
    .then((results) => {
      res.json({ status: "success" });
    })
    .catch((error) => {
      console.error(error);
    });

  return;
});
app.get("/api/tasks/:projectName", middleware.validateGetTasks, (req, res) => {
  if (validataUser(req) === 0) {
    res.status(400).send("Invalid user id and user name");
  }
  updateProgress();
  const sortOption = req.query.sort;
  var sortBy = req.query.sortBy;
  if (sortBy.startsWith("svg")) {
    switch (sortBy) {
      case "svg-desc":
        sortBy = "taskDescription";
        break;
      case "svg-status":
        sortBy = "taskProgress";
        break;
      case "svg-due":
        sortBy = "taskDue";
        break;
      case "svg-prio":
        sortBy = "taskPriority";
        break;
      default:
        sortBy = "taskName";
        break;
    }
  }
  let query1;
  let projectName = req.params.projectName;
  if (projectName === "0") {
    query1 = `
    SELECT t.taskId,t.taskName,t.taskDescription,t.taskProgress,t.taskDue,t.taskPriority,t.taskProject,a.accountUsername FROM tblsharedtables s 
    LEFT JOIN tbltasks t ON s.taskId=t.taskId LEFT JOIN tblaccounts a ON t.accountsId=a.accountId
    WHERE s.accountId =  ${req.session.user.user_id} AND CAST(taskDue AS DATE) `;
  } else {
    query1 = `SELECT * FROM tbltasks WHERE accountsId = ${req.session.user.user_id} AND taskProject = '${projectName}' AND CAST(taskDue AS DATE)`;
  }
  const query2 = `!= CAST(GETDATE() AS DATE) ORDER BY ${sortBy} ${sortOption.toUpperCase()};`;
  console.log(query1);
  console.log(`proj: ${projectName}`);
  console.log(query1 + query2);
  console.log(query1 + query2.slice(1));
  Promise.all([
    pool.query(query1 + query2),
    pool.query(query1 + query2.slice(1)),
  ])
    .then(([resultsOther, resultsToday]) => {
      res.json({
        today: resultsToday.recordset,
        other: resultsOther.recordset,
      });
    })
    .catch((error) => {
      console.error("Error:", error);
      res.status(500).json({ error: "An error occurred" });
    });
});

// app.get("/api/tasks/today", (req, res) => {
//   if (validataUser(req) === 0) {
//     res.status(400).send("Invalid user id and user name");
//   }
//   updateProgress();
//   const sortOption = req.query.sort;
//   var sortBy = req.query.sortBy;
//   if (sortBy.startsWith("svg")) {
//     switch (sortBy) {
//       case "svg-desc":
//         sortBy = "taskDescription";
//         break;
//       case "svg-status":
//         sortBy = "taskProgress";
//         break;
//       case "svg-due":
//         sortBy = "taskDue";
//         break;
//       case "svg-prio":
//         sortBy = "taskPriority";
//         break;
//       default:
//         sortBy = "taskName";
//         break;
//     }
//   }
//   let projectName = req.params.projectName;
//   var otherDaysTasks;
//   var todayTasks;
//   const query1 = `SELECT * FROM tbltasks WHERE accountsId =  ${req.session.user.user_id} AND taskProject = '${projectName}' AND DATE(taskDue) `;
//   const query2 = `!= CURRENT_DATE ORDER BY ${sortBy} ${sortOption.toUpperCase()} `;
//   // console.log(query);
//   pool
//     .query(query1 + query2)
//     .then((results) => {
//       // console.log(results);
//       otherDaysTasks = results;
//     })
//     .catch((error) => {
//       console.error(error);
//     });
//   pool
//     .query(query1 + query2.slice(1))
//     .then((results) => {
//       // console.log(results);
//       todayTasks = results;
//     })
//     .catch((error) => {
//       console.error(error);
//     });

//   res.json({ today: todayTasks, other: otherDaysTasks });
// });

app.get("/api/projects", (req, res) => {
  if (validataUser(req) === 0) {
    res.status(400).send("Invalid user id and user name");
  }
  pool
    .query(
      `SELECT p.projectName FROM  tblprojects p LEFT JOIN tblaccounts a on a.accountId=p.accountsId WHERE p.accountsId=0 OR a.accountId = ${req.session.user.user_id} `
    )
    .then((results) => {
      // console.log("resuts", results);
      res.json(results.recordset);
    })
    .catch((error) => {
      console.error(error);
    });

  return;
});
app.post("/api/project/add", middleware.validateProjectName, (req, res) => {
  if (validataUser(req) === 0) {
    res.status(400).send("Invalid user id and user name");
  }
  pool
    .query(
      `INSERT INTO tblprojects(accountsId,  projectName) VALUES ( ${req.session.user.user_id}, '${req.body.projectName}' )`
    )
    .then((results) => {
      res.json({ status: "Project added" });
      console.log("added project name, resuts", results);
      // res.json(results);
    })
    .catch((error) => {
      res.json({ error: "Project not added" });
      console.error(error);
    });

  return;
});

app.post(
  "/api/project/update",
  middleware.validateUpdateProject,
  (req, res) => {
    if (validataUser(req) === 0) {
      res.status(400).send("Invalid user id and user name");
    }
    let returnMessages = {};
    let promises = [];

    if (req.updateQuery && req.updateQuery.includes("WHEN")) {
      let updatePromise = pool
        .query(req.updateQuery)
        .then((results) => {
          returnMessages["update"] = "Projects updated";
        })
        .catch((error) => {
          console.log(error);
          returnMessages["update"] = "Projects not updated";
        });

      promises.push(updatePromise);
    }

    if (req.deleteQuery && req.deleteQuery.includes("projectName")) {
      let deletePromise = pool
        .query(req.deleteQuery)
        .then((results) => {
          returnMessages["delete"] = "Projects deleted";
        })
        .catch((error) => {
          console.log(error);
          returnMessages["delete"] = "Projects not deleted";
        });

      promises.push(deletePromise);
    }
    Promise.all(promises)
      .then(() => {
        console.log(returnMessages);
        res.json(returnMessages);
      })
      .catch((error) => {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      });
  }
);

app.post("/api/task/delete/:taskId", middleware.validateTaskId, (req, res) => {
  if (validataUser(req) === 0) {
    res.status(400).send("Invalid user id and user name");
  }
  pool
    .query(
      `DELETE FROM tbltasks WHERE accountsId = ${req.session.user.user_id} AND taskId = ${req.params.taskId}`
    )
    .then((results) => {
      console.log(`delete results: ${results}`);
    })
    .catch((error) => {
      console.error(error);
    });
  console.log("task deleted");
  res.json({ res: `task ${req.params.taskId}deleted ` });
  return;
});

app.post("/api/task/add", middleware.validateAndSanitizeTask, (req, res) => {
  if (validataUser(req) === 0) {
    res.status(400).json({ error: "Invalid user id and user name" });
  }
  const { title, description, due_date, priority, project } = req.sanitizedBody;
  console.log(`INSERT INTO tbltasks (accountsId, taskName, taskDescription,  taskDue, taskPriority, taskProject) VALUES (${
    req.session.user.user_id
  }, 
    '${title}' , '${description}' , '${due_date.replace(
    "T",
    " "
  )}' , ${priority} , '${project}')`);
  pool
    .query(
      `INSERT INTO tbltasks (accountsId, taskName, taskDescription,  taskDue, taskPriority, taskProject) VALUES (${
        req.session.user.user_id
      }, 
        '${title}' , '${description}' , '${due_date.replace(
        "T",
        " "
      )}' , ${priority} , '${project}')`
    )
    .then((results) => {
      console.log(`Added results: ${results}`);
      res.json({
        status: "Task added",
      });
      return;
    })
    .catch((error) => {
      res.json({
        error: "Task not added",
      });
      console.error(error);
    });
  console.log("task addedd");
});

app.post("/api/task/update", middleware.validateAndSanitizeTask, (req, res) => {
  if (validataUser(req) === 0) {
    res.status(400).json({ error: "Invalid user id and user name" });
  }

  const { title, description, due_date, priority, project, taskId } =
    req.sanitizedBody;

  pool
    .query(
      `UPDATE tbltasks SET taskName = '${title}', taskDescription = '${description}', taskDue = '${due_date.replace(
        "T",
        " "
      )}', taskPriority = ${priority}, taskProject = '${project}' WHERE taskId = ${taskId}`
    )
    .then((results) => {
      console.log(`updated results: ${results}`);
      res.json({ status: "Task updated" });
    })
    .catch((error) => {
      console.error(error);
      res.status(400).json({ error: "Task not updated" });
    });
});

//account endpoints
app.post(
  "/api/account/update",
  middleware.validateUpdateAccount,
  async (req, res) => {
    if (validataUser(req) === 0) {
      res.status(400).send("Invalid user id and user name");
    }
    const userId = await loginUser(
      req.session.user.username,
      req.body.current_password
    );
    // console.log(req.session.user.username, req.body.current_password, userId);
    if (userId === -1) {
      res.json({ error: "Username and password does not match" });
      return;
    } else {
      let query = "UPDATE tblaccounts SET ";
      let username;
      // console.log(req.body);
      if (req.body.username) {
        username = req.body.username;
        query += ` accountUsername = '${username}',`;
      }
      if (req.body.email) query += ` accountEmail = '${req.body.email}',`;
      if (req.body.password) {
        const password = req.body.password;
        query += ` accountPassword = '${password}',`;
      }
      query =
        query.slice(0, -1) + ` WHERE accountId = ${req.session.user.user_id}`;
      console.log(query);
      pool
        .query(query)
        .then((results) => {
          // console.log(`updated results: ${results}`);
          // console.log(username, " asda");
          if (username) req.session.user.username = username;
          res.json({ status: "success" });
        })
        .catch((error) => {
          console.error(error);
        });
    }
  }
);

app.post(
  "/api/account/delete",
  middleware.validateCurrentPass,
  async (req, res) => {
    if (validataUser(req) === 0) {
      res.status(400).send("Invalid user id and user name");
    }
    const userId = await loginUser(
      req.session.user.username,
      req.body.current_password
    );
    // console.log(req.session.user.username, req.body.current_password, userId);
    if (userId === -1) {
      res.json({ error: "Username and password does not match" });
      return;
    } else {
      pool
        .query(`DELETE FROM tblaccounts WHERE accountId = ${userId}`)
        .then((results) => {
          console.log(`deleted account: ${results}`);
          res.json({ status: "success" });
        })
        .catch((error) => {
          res.json({ error: "Username and password does not match" });
          console.log(error);
        });
    }
  }
);

app.post("/api/share", middleware.validateIds, (req, res) => {
  if (validataUser(req) === 0) {
    res.status(400).send("Invalid user id and user name");
  }
  pool
    .query(
      `INSERT INTO tblsharedtables (accountId,taskId) VALUES (${req.body.accountId},${req.body.taskId})`
    )
    .then((results) => {
      console.log(`shared results: ${results}`);
      res.json({ status: "success" });
    })
    .catch((error) => {
      res.json({ error: "Task not shared" });
    });
});

app.post("/api/share/delete", middleware.validateIds, (req, res) => {
  console.log("buh");
  if (validataUser(req) === 0) {
    res.status(400).send("Invalid user id and user name");
  }
  pool
    .query(
      `DELETE FROM tblsharedtables WHERE taskId = ${req.body.taskId} AND accountId = ${req.body.accountId}`
    )
    .then((results) => {
      console.log(`delete results: ${results}`);
      res.json({ status: "Account removed from shared task" });
    })
    .catch((error) => {
      res.json({ error: "Account not removed from shared task" });
      console.error(error);
    });
  console.log("task deleted");
  return;
});

app.get("/api/users/:taskId", middleware.validateTaskId, (req, res) => {
  if (validataUser(req) === 0) {
    res.status(400).send("Invalid user id and user name");
  }
  query = `SELECT a.accountId , a.accountUsername, s.taskId
  FROM tblaccounts a 
  LEFT JOIN tblsharedtables s ON a.accountId = s.accountId AND s.taskId = ${req.params.taskId}`;
  Promise.all([
    pool.query(
      query +
        ` WHERE s.taskId IS NULL AND a.accountId != ${req.session.user.user_id};`
    ),
    pool.query(query + ` WHERE s.taskId = ${req.params.taskId};`),
  ])
    .then(([notShared, shared]) => {
      res.json({ notShared: notShared, shared: shared });
    })
    .catch((error) => {
      console.error("Error:", error);
      res.status(500).json({ error: "An error occurred" });
    });
});

function validataUser(req) {
  pool
    .query(
      `SELECT * FROM tblaccounts WHERE accountUsername = '${req.session.user.username}' OR accountId = ${req.session.user.user_id}`
    )
    .then((results) => {
      if (results.recordset.length < 0) return 0;
      else return 1;
    })
    .catch((error) => {
      console.error(error);
    });
}

function loginUser(username, password) {
  return new Promise((resolve, reject) => {
    pool
      .query(`SELECT * FROM tblaccounts WHERE accountUsername = '${username}' `)
      .then((results) => {
        if (results.recordset.length > 0) {
          const user = results.recordset[0];
          bcrypt.compare(password, user.accountPassword, (err, isMatch) => {
            if (err) {
              console.log("not match");
              return reject(err);
            }
            if (isMatch) {
              resolve(user.accountId);
            } else {
              console.log("not match");
              resolve(-1);
            }
          });
        } else {
          console.log("not match", username, results);
          resolve(-1);
        }
      })
      .catch((error) => {
        console.error(error);
        reject(error);
      });
  });
}

function updateProgress() {
  pool.query("UPDATE tbltasks SET taskProgress = 2 WHERE taskDue < GETDATE();");
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

module.exports = app;
